'use server'

import { createClient } from '@/utils/supabase/server'
import type { Json } from '@/types/supabase'
import { validateSessionAccess } from '@/actions/questions'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { randomUUID } from 'crypto'
import { aoiGeoJsonPath, ddReportJsonPath } from '@/features/eudr-due-diligence/storage/paths'
import { buildDdReportPayload } from '@/features/eudr-due-diligence/storage/buildDdReportPayload'
import { runEudrAoiAssessment } from '@/features/eudr-due-diligence/server/earthengine/runEudrAoiAssessment'
import { getHansenLossTilesForAoi } from '@/features/eudr-due-diligence/server/earthengine/getHansenLossTiles'
import { getJrcForest2020TilesForAoi } from '@/features/eudr-due-diligence/server/earthengine/getJrcForest2020Tiles'
import { getSentinel2YearCompositeTilesForAoi } from '@/features/eudr-due-diligence/server/earthengine/getSentinel2YearCompositeTiles'
import { ensureEarthEngineInitialized, isEarthEngineConfigured } from '@/features/eudr-due-diligence/server/earthengine/initialize'
import type { RunMetadata } from '@/features/eudr-due-diligence/types/due-diligence-run'
import { normalizeAoiInput } from '@/features/eudr-due-diligence/server/earthengine/normalizeAoi'
import { buildDdLastRunSnapshot } from '@/features/eudr-due-diligence/aoiRiskGate'
import { removePreviousDueDiligenceRuns } from '@/features/eudr-due-diligence/storage/cleanupSessionRuns'
import { HANSEN_ASSET } from '@/features/eudr-due-diligence/server/earthengine/runForestLossForAoi'
import { JRC_GFC2020_ASSET } from '@/features/eudr-due-diligence/server/earthengine/runEudrAoiAssessment'
import { COLOR_POST_CUT, COLOR_POST_EU_ONLY, HANSEN_EUDR_MIN_BAND } from '@/features/eudr-due-diligence/constants/hansen-visual'
import { HANSEN_LOSSYEAR_MAX_BAND } from '@/features/eudr-due-diligence/constants/hansen-version'

const EUDR_CUTOFF = '2020-12-31' // informational; align with reg guidance when publishing
const DEFAULT_POINT_BUFFER_METERS = 500

/** Minimum seconds between completed runs per session (anti-spam / EE load). */
const DD_ANALYSIS_COOLDOWN_SEC = 90

const AOI_MAP_RENDER_FILENAME = 'aoi_map_render.png'

type EeImage = {
  getThumbURL: (params: Record<string, unknown>, cb: (url: string | null, error?: Error) => void) => void
  select: (bands: string[] | string) => EeImage
  visualize: (params: Record<string, unknown>) => unknown
  eq: (value: number) => EeImage
  selfMask: () => EeImage
  clip: (geom: unknown) => EeImage
  buffer: (meters: number) => EeImage
  union: (other: unknown, maxError: number) => EeImage
  gt: (value: number) => EeImage
  gte: (value: number) => EeImage
  lt: (value: number) => EeImage
  and: (other: unknown) => EeImage
  updateMask: (mask: unknown) => EeImage
  where: (cond: unknown, value: number) => EeImage
  blend: (img: unknown) => EeImage
  byte: () => EeImage
  paint: (fc: unknown, color: number, width: number) => EeImage
  bounds?: (maxError: number) => unknown
}

type EeImageCollection = {
  filterBounds: (geom: unknown) => EeImageCollection
  filterDate: (start: unknown, end: unknown) => EeImageCollection
  filter: (filter: unknown) => EeImageCollection
  median: () => unknown
}

type EeModule = {
  Image: (image?: unknown) => EeImage
  Geometry: (geom: unknown) => EeImage
  Date: { fromYMD: (year: number, month: number, day: number) => unknown }
  Filter: { lt: (field: string, value: number) => unknown }
  ImageCollection: (id: string) => EeImageCollection
  Feature: (geom: unknown) => unknown
  FeatureCollection: (items: unknown[]) => unknown
}

function getEe(): EeModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@google/earthengine') as unknown as EeModule
}

function getThumbUrlPromise(
  image: unknown,
  params: Record<string, unknown>
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      getEe().Image(image).getThumbURL(params, (url: string | null, error?: Error) => {
        if (error) reject(error)
        else if (!url) reject(new Error('Earth Engine getThumbURL returned empty url'))
        else resolve(url)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function parseCuttingYearBand(iso: string): number | null {
  if (!iso || !/^\d{4}/.test(iso)) return null
  const y = parseInt(iso.slice(0, 4), 10)
  if (!Number.isFinite(y)) return null
  const band = y - 2000
  if (band < 1 || band > HANSEN_LOSSYEAR_MAX_BAND) return null
  return band
}

async function renderAoiMapPng(aoiEe: unknown, cuttingDateIso: string): Promise<Buffer | null> {
  try {
    await ensureEarthEngineInitialized()
    const ee = getEe()

    const geometry = ee.Geometry(aoiEe)
    // Render area: buffered AOI bounds so the output is centered with margin (like a "fit bounds" view).
    // We buffer in meters to work at any latitude.
    const buffered = geometry.buffer(800)
    const bounds = buffered.bounds?.(1)
    if (!bounds) return null

    // Use a single Sentinel-2 year for background to keep render stable/fast.
    // We pick the latest year we know is available in this project context (2024).
    const year = 2024
    const start = ee.Date.fromYMD(year, 1, 1)
    const end = ee.Date.fromYMD(year, 12, 31)

    const s2Median = ee
      .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(bounds)
      .filterDate(start, end)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
      .median()
    const s2Rgb = ee
      .Image(s2Median)
      .select(['B4', 'B3', 'B2'])
      .visualize({ bands: ['B4', 'B3', 'B2'], min: 0, max: 3500, gamma: 1.15 })

    // JRC forest 2020 overlay (green)
    const jrcForest = ee.Image(JRC_GFC2020_ASSET).select('Map').eq(1).selfMask()
    const forestVis = jrcForest.visualize({ min: 1, max: 1, palette: ['#15803d'], opacity: 0.35 })

    // Hansen loss overlay (blue/red) masked to post-EUDR only; optionally classify by cutting year band
    const gf = ee.Image(HANSEN_ASSET).clip(bounds)
    const lossyear = gf.select('lossyear')
    const hasLoss = lossyear.gt(0)
    const postEu = lossyear.gte(HANSEN_EUDR_MIN_BAND).and(hasLoss)
    const cutBand = parseCuttingYearBand(cuttingDateIso)

    let lossVis: unknown
    if (cutBand != null) {
      const postCut = lossyear.gte(cutBand).and(hasLoss)
      const postEuOnly = postEu.and(lossyear.lt(cutBand))
      const classified = ee.Image(0).where(postEuOnly, 1).where(postCut, 2).updateMask(postEu)
      lossVis = ee.Image(classified).visualize({
        min: 1,
        max: 2,
        palette: [COLOR_POST_EU_ONLY, COLOR_POST_CUT],
        opacity: 0.80,
      })
    } else {
      const masked = lossyear.updateMask(postEu)
      lossVis = ee.Image(masked).visualize({
        min: HANSEN_EUDR_MIN_BAND,
        max: HANSEN_LOSSYEAR_MAX_BAND,
        palette: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#172554'],
        opacity: 0.80,
      })
    }

    // AOI outline (dark blue)
    const outlineFc = ee.FeatureCollection([ee.Feature(geometry)])
    const outline = ee.Image().byte().paint(outlineFc, 1, 2)
    const outlineVis = outline.visualize({ min: 0, max: 1, palette: ['#1e3a8a'], opacity: 0.95 })

    const poster = ee.Image(s2Rgb).blend(forestVis).blend(lossVis).blend(outlineVis)

    const thumbUrl = await getThumbUrlPromise(poster, {
      region: bounds,
      dimensions: 1400,
      format: 'png',
    })

    const res = await fetch(thumbUrl)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    const buf = Buffer.from(ab)
    if (buf.length < 2000) return null
    return buf
  } catch {
    return null
  }
}

/**
 * Run Hansen forest loss histogram for AOI; saves AOI GeoJSON + metadata to user-uploads.
 */
export async function runDueDiligenceAoiAnalysis(
  sessionId: string,
  aoi: unknown,
  /** Obbligatorio: ISO date YYYY-MM-DD — data di taglio; senza non si esegue l'analisi */
  cuttingDateIso?: string | null
): Promise<{
  runId?: string
  error?: string
  metadata?: RunMetadata
  lossTiles?: { tilesUrlTemplate: string; attribution: string; dualClassMode?: boolean }
  forest2020Tiles?: { tilesUrlTemplate: string; attribution: string }
  /** Compositi Sentinel-2 per anno (zoom elevato, confronto temporale) */
  sentinel2YearTiles?: { years: Array<{ year: number; tilesUrlTemplate: string }>; attribution: string }
}> {
  if (!isEarthEngineConfigured()) {
    return {
      error:
        'Earth Engine non configurato. Impostare EARTH_ENGINE_PRIVATE_KEY_JSON (o _B64) con il JSON del service account.',
    }
  }
  const normalized = normalizeAoiInput(aoi)
  if (!normalized) {
    return {
      error:
        'AOI non valida: incolla GeoJSON Point/MultiPoint/Polygon/MultiPolygon, oppure Feature/FeatureCollection (WGS84).',
    }
  }

  const cuttingDateRaw = cuttingDateIso?.trim()
  if (!cuttingDateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(cuttingDateRaw)) {
    return {
      error:
        'Data di taglio obbligatoria: inserire una data valida (YYYY-MM-DD) prima di eseguire l\'analisi.',
    }
  }
  const cuttingDate = cuttingDateRaw

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Accesso negato' }
  }

  // Cooldown: avoid spamming Earth Engine / storage (one analysis per session should be enough in short window)
  const { data: sessionForCooldown } = await supabase
    .from('assessment_sessions')
    .select('metadata')
    .eq('id', sessionId)
    .single()
  const metaCooldown = (sessionForCooldown?.metadata as Record<string, unknown>) || {}
  const ddLastRun = metaCooldown.dd_last_run as { completed_at?: string } | undefined
  if (ddLastRun?.completed_at) {
    const lastCompleted = Date.parse(ddLastRun.completed_at)
    if (Number.isFinite(lastCompleted)) {
      const elapsedSec = (Date.now() - lastCompleted) / 1000
      if (elapsedSec < DD_ANALYSIS_COOLDOWN_SEC) {
        const waitSec = Math.ceil(DD_ANALYSIS_COOLDOWN_SEC - elapsedSec)
        return {
          error: `Analisi eseguita di recente. Attendere circa ${waitSec}s prima di rilanciare (limite anti-spam).`,
        }
      }
    }
  }

  // One run per session in storage: delete previous run folders before creating a new runId
  await removePreviousDueDiligenceRuns(supabase, user.id, sessionId)

  const runId = randomUUID()
  const userId = user.id
  const aoiPath = aoiGeoJsonPath(userId, sessionId, runId)
  const reportPath = ddReportJsonPath(userId, sessionId, runId)

  const aoiFeatureCollection = normalized.featureCollection

  const { error: uploadAoiError } = await supabase.storage
    .from('user-uploads')
    .upload(aoiPath, JSON.stringify(aoiFeatureCollection), {
      contentType: 'application/geo+json',
      upsert: true,
    })
  if (uploadAoiError) return { error: uploadAoiError.message }

  const pendingMeta: RunMetadata = {
    run_id: runId,
    session_id: sessionId,
    user_id: userId,
    status: 'running',
    created_at: new Date().toISOString(),
    dataset_id: 'UMD/hansen/global_forest_change_2024_v1_12',
    eudr_cutoff_date: EUDR_CUTOFF,
    pixel_area_m2: 900,
    artifact_paths: {
      aoi_geojson: aoiPath,
      metadata_json: reportPath,
    },
    cutting_date_iso: cuttingDate,
  }

  try {
    // Earth Engine: build a single AOI geometry (polygonal union) from mixed inputs.
    const ee = getEe()
    await ensureEarthEngineInitialized()
    const parts = normalized.geometries.map((g) => {
      const geom = ee.Geometry(g)
      if (g.type === 'Point' || g.type === 'MultiPoint') {
        return geom.buffer(DEFAULT_POINT_BUFFER_METERS)
      }
      return geom
    })
    let aoiEe = parts[0]
    for (let i = 1; i < parts.length; i++) {
      aoiEe = aoiEe.union(parts[i], 1)
    }

    const assessmentPromise = runEudrAoiAssessment(aoiEe)
    const lossTilesPromise = getHansenLossTilesForAoi(aoiEe, cuttingDate).catch(() => null)
    const forest2020TilesPromise = getJrcForest2020TilesForAoi(aoiEe).catch(() => null)
    const sentinel2YearTilesPromise = (async () => {
      try {
        const cuttingYear = parseInt(cuttingDate.slice(0, 4), 10)
        const minS2Year = Number.isFinite(cuttingYear) ? cuttingYear : 2020
        const s2Years = [2020, 2021, 2022, 2023, 2024].filter((y) => y >= minS2Year)
        const res = await getSentinel2YearCompositeTilesForAoi(aoiEe, s2Years.length > 0 ? s2Years : [2024])
        return res.years.length > 0 ? res : null
      } catch {
        return null
      }
    })()

    const [assessment, lossTiles, forest2020TilesResolved, sentinel2YearTilesResolved] = await Promise.all([
      assessmentPromise,
      lossTilesPromise,
      forest2020TilesPromise,
      sentinel2YearTilesPromise,
    ])
    const completedMeta: RunMetadata = {
      ...pendingMeta,
      status: 'completed',
      completed_at: new Date().toISOString(),
      aoi_area_ha: assessment.aoi_area_ha,
      loss_pixel_count: assessment.loss_pixel_count_all,
      lossyear_histogram: assessment.lossyear_histogram_all,
      dataset_id: assessment.hansen_dataset_id,
      eudr_refined: {
        jrc_gfc2020_dataset_id: assessment.jrc_gfc2020_dataset_id,
        forest_2020_ha_in_aoi: assessment.forest_2020_ha_in_aoi,
        forest_2020_pct_aoi: assessment.forest_2020_pct_aoi,
        loss_on_forest_2020_post_eudr_ha: assessment.loss_on_forest_2020_post_eudr_ha,
        loss_pixel_count_on_forest_2020_post_eudr:
          assessment.loss_pixel_count_on_forest_2020_post_eudr,
        jrc_assessment_ok: assessment.jrc_assessment_ok,
        ...(assessment.jrc_assessment_error
          ? { jrc_assessment_error: assessment.jrc_assessment_error }
          : {}),
      },
      ...(assessment.forest_types_2020
        ? {
            forest_types_2020: {
              dataset_id: assessment.forest_types_2020.dataset_id,
              ha_naturally_regenerating: assessment.forest_types_2020.ha_naturally_regenerating,
              ha_primary: assessment.forest_types_2020.ha_primary,
              ha_planted: assessment.forest_types_2020.ha_planted,
              ha_forest_typed_total: assessment.forest_types_2020.ha_forest_typed_total,
              ok: assessment.forest_types_2020.ok,
              ...(assessment.forest_types_2020.error
                ? { error: assessment.forest_types_2020.error }
                : {}),
            },
          }
        : {}),
      cutting_date_iso: cuttingDate,
    }

    const ddSnapshot = buildDdLastRunSnapshot(completedMeta)

    // Storage: AOI geojson + dd_report.json (tutto per PDF/replica senza GEE) + PNG snapshot per PDF.
    // Prefer server-side render (no CORS/taint). Client snapshot is best-effort fallback.
    const reportPayload = buildDdReportPayload(
      completedMeta,
      ddSnapshot,
      Boolean(lossTiles?.dualClassMode)
    )

    await supabase.storage.from('user-uploads').upload(reportPath, JSON.stringify(reportPayload), {
      contentType: 'application/json',
      upsert: true,
    })

    // Fire-and-forget: generate a stable map PNG server-side (same conceptual layers: S2 + JRC + Hansen)
    // We intentionally do NOT await this to keep the analysis response fast.
    void (async () => {
      try {
        const renderBuf = await renderAoiMapPng(aoiEe, cuttingDate)
        if (!renderBuf) return
        const pngPath = `${userId}/eudr-due-diligence/${sessionId}/${runId}/${AOI_MAP_RENDER_FILENAME}`
        const { error: renderUpErr } = await supabase.storage.from('user-uploads').upload(pngPath, renderBuf, {
          contentType: 'image/png',
          upsert: true,
        })
        if (renderUpErr) return

        // Update dd_report.json with snapshot info (best-effort)
        const { data: fileData, error: dlErr } = await supabase.storage.from('user-uploads').download(reportPath)
        if (dlErr || !fileData) return
        const report = JSON.parse(await fileData.text()) as {
          has_snapshot?: boolean
          snapshot_storage_filename?: string
        }
        report.has_snapshot = true
        report.snapshot_storage_filename = AOI_MAP_RENDER_FILENAME
        await supabase.storage.from('user-uploads').upload(reportPath, JSON.stringify(report), {
          contentType: 'application/json',
          upsert: true,
        })
      } catch {
        /* ignore */
      }
    })()

    // Persist AOI run summary on session so finalize/risultato can apply hard gate (non accettabile)
    const { data: sessionRow } = await supabase
      .from('assessment_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single()
    const prevMeta = (sessionRow?.metadata as Record<string, unknown>) || {}
    await supabase
      .from('assessment_sessions')
      .update({
        metadata: {
          ...prevMeta,
          dd_last_run: ddSnapshot,
        } as Json,
      })
      .eq('id', sessionId)

    return {
      runId,
      metadata: completedMeta,
      ...(lossTiles ? { lossTiles } : {}),
      ...(forest2020TilesResolved ? { forest2020Tiles: forest2020TilesResolved } : {}),
      ...(sentinel2YearTilesResolved ? { sentinel2YearTiles: sentinel2YearTilesResolved } : {}),
    }
  } catch (err) {
    // Nessun file "failed" su storage — solo risposta errore (evita orphan inutili)
    return { runId, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Signed URL to download AOI GeoJSON for map display.
 */
export async function getDueDiligenceArtifactUrl(
  sessionId: string,
  storagePath: string
): Promise<{ signedUrl?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)
  } catch {
    return { error: 'Accesso negato' }
  }

  if (!storagePath.includes(user.id) || !storagePath.includes('eudr-due-diligence')) {
    return { error: 'Percorso non valido' }
  }

  const { data, error } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(storagePath, 3600, { download: false })

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}

// (Client-side AOI map screenshots have been deprecated; rely on server-rendered PNG only.)
