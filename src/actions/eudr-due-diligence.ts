'use server'

import { createClient } from '@/utils/supabase/server'
import type { Json } from '@/types/supabase'
import { validateSessionAccess } from '@/actions/questions'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { randomUUID } from 'crypto'
import {
  aoiGeoJsonSessionPath,
  ddReportJsonSessionPath,
  aoiMapRenderSessionPath,
  AOI_MAP_RENDER_FILENAME,
} from '@/features/eudr-due-diligence/storage/paths'
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
import { composeAoiPosterEeImage } from '@/features/eudr-due-diligence/server/earthengine/aoiMapLayerSpecs'
import { point, multiPoint, polygon, multiPolygon, buffer as turfBuffer, featureCollection } from '@turf/turf'
import type { SupabaseClient } from '@supabase/supabase-js'

const EUDR_CUTOFF = '2020-12-31'
const MAX_POINT_BUFFER_HA = 4
const DD_ANALYSIS_COOLDOWN_SEC = 90
/** After this, an orphaned in-progress flag is ignored (crash / timeout). */
const DD_ANALYSIS_LOCK_STALE_MS = 20 * 60 * 1000
/** EE getThumbURL max dimension — lower = faster PNG + PDF embed; still fine for A4. */
const AOI_MAP_THUMB_PX = 1920

type EeImage = {
  getThumbURL: (params: Record<string, unknown>, cb: (url: string | null, error?: Error) => void) => void
  union: (other: unknown, maxError: number) => EeImage
  buffer: (meters: number) => EeImage
  bounds?: (maxError: number) => unknown
}

type EeModule = {
  Image: (image?: unknown) => EeImage
  Geometry: (geom: unknown) => EeImage
}

function getEe(): EeModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@google/earthengine') as unknown as EeModule
}

function getThumbUrlPromise(image: unknown, params: Record<string, unknown>): Promise<string> {
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

function isAnalysisLockStale(startedAt: unknown): boolean {
  if (typeof startedAt !== 'string') return true
  const t = Date.parse(startedAt)
  if (!Number.isFinite(t)) return true
  return Date.now() - t > DD_ANALYSIS_LOCK_STALE_MS
}

async function clearDdAnalysisLock(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const { data } = await supabase
    .from('assessment_sessions')
    .select('metadata')
    .eq('id', sessionId)
    .single()
  const m = { ...((data?.metadata as Record<string, unknown>) || {}) }
  delete m.dd_analysis_in_progress
  delete m.dd_analysis_started_at
  delete m.dd_analysis_run_id
  await supabase.from('assessment_sessions').update({ metadata: m as Json }).eq('id', sessionId)
}

function hasPointGeometries(geometries: Array<{ type: string }>): boolean {
  return geometries.some((g) => g.type === 'Point' || g.type === 'MultiPoint')
}

function radiusMetersFromAreaHa(areaHa: number): number {
  return Math.sqrt((areaHa * 10000) / Math.PI)
}

function buildStorageFeatureCollection(
  geometries: Array<{
    type: 'Polygon' | 'MultiPolygon' | 'Point' | 'MultiPoint'
    coordinates: unknown
  }>,
  pointBufferAreaHa: number | null
): unknown {
  if (!hasPointGeometries(geometries)) {
    return featureCollection(
      geometries.map((g) => {
        if (g.type === 'Polygon') return polygon(g.coordinates as number[][][])
        return multiPolygon(g.coordinates as number[][][][])
      }) as GeoJSON.Feature[]
    )
  }

  const radiusKm = Math.sqrt((pointBufferAreaHa! * 10000) / Math.PI) / 1000
  return featureCollection(
    geometries.flatMap((g) => {
      if (g.type === 'Point') {
        return [turfBuffer(point(g.coordinates as number[]), radiusKm, { units: 'kilometers' })]
      }
      if (g.type === 'MultiPoint') {
        return [turfBuffer(multiPoint(g.coordinates as number[][]), radiusKm, { units: 'kilometers' })]
      }
      if (g.type === 'Polygon') return [polygon(g.coordinates as number[][][])]
      return [multiPolygon(g.coordinates as number[][][][])]
    }) as GeoJSON.Feature[]
  )
}

async function renderAoiMapPng(
  aoiEe: unknown,
  cuttingDateIso: string,
  sentinel2Year: number
): Promise<Buffer | null> {
  try {
    await ensureEarthEngineInitialized()
    const ee = getEe()
    const geometry = ee.Geometry(aoiEe)
    const buffered = geometry.buffer(800)
    const bounds = buffered.bounds?.(1)
    if (!bounds) return null

    const poster = composeAoiPosterEeImage({
      aoiGeometry: aoiEe,
      exportBounds: bounds,
      cuttingDateIso,
      sentinel2Year,
    })

    const thumbUrl = await getThumbUrlPromise(poster, {
      region: bounds,
      dimensions: AOI_MAP_THUMB_PX,
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
 * Same EE recipe as the interactive tiles, but persisted asynchronously so the action can return
 * immediately with tile URLs. Patches dd_report.json only if run_id still matches (avoids races).
 */
function schedulePersistAoiMapPng(
  supabase: SupabaseClient,
  params: {
    reportPath: string
    pngPath: string
    runId: string
    aoiEe: unknown
    cuttingDateIso: string
    sentinel2Year: number
  }
): void {
  const { reportPath, pngPath, runId, aoiEe, cuttingDateIso, sentinel2Year } = params
  void (async () => {
    try {
      const renderBuf = await renderAoiMapPng(aoiEe, cuttingDateIso, sentinel2Year)
      if (!renderBuf) return
      const { error: renderUpErr } = await supabase.storage.from('user-uploads').upload(pngPath, renderBuf, {
        contentType: 'image/png',
        upsert: true,
      })
      if (renderUpErr) return

      const { data: fileData, error: dlErr } = await supabase.storage.from('user-uploads').download(reportPath)
      if (dlErr || !fileData) return
      const report = JSON.parse(await fileData.text()) as { run_id?: string; has_snapshot?: boolean; snapshot_storage_filename?: string }
      if (report.run_id !== runId) return

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
}

/**
 * Run Hansen forest loss histogram for AOI; saves AOI GeoJSON + dd_report + PNG to user-uploads (flat per session).
 */
export async function runDueDiligenceAoiAnalysis(
  sessionId: string,
  aoi: unknown,
  cuttingDateIso?: string | null,
  pointBufferAreaHa?: number | null
): Promise<{
  runId?: string
  error?: string
  metadata?: RunMetadata
  lossTiles?: { tilesUrlTemplate: string; attribution: string; dualClassMode?: boolean }
  forest2020Tiles?: { tilesUrlTemplate: string; attribution: string }
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
        "Data di taglio obbligatoria: inserire una data valida (YYYY-MM-DD) prima di eseguire l'analisi.",
    }
  }
  const cuttingDate = cuttingDateRaw
  const hasPoints = hasPointGeometries(normalized.geometries)
  let validPointBufferAreaHa: number | null = null
  if (hasPoints) {
    if (pointBufferAreaHa == null || !Number.isFinite(pointBufferAreaHa)) {
      return {
        error: `Per geometrie Point/MultiPoint indicare la superficie di analisi in ettari (max ${MAX_POINT_BUFFER_HA} ha).`,
      }
    }
    if (pointBufferAreaHa <= 0 || pointBufferAreaHa > MAX_POINT_BUFFER_HA) {
      return {
        error: `Superficie non valida: inserire un valore tra 0 e ${MAX_POINT_BUFFER_HA} ha.`,
      }
    }
    validPointBufferAreaHa = pointBufferAreaHa
  }

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

  const { data: sessionRow0 } = await supabase
    .from('assessment_sessions')
    .select('metadata')
    .eq('id', sessionId)
    .single()

  const meta0 = (sessionRow0?.metadata as Record<string, unknown>) || {}
  const inProgress = meta0.dd_analysis_in_progress === true
  const startedAt = meta0.dd_analysis_started_at
  if (inProgress && !isAnalysisLockStale(startedAt)) {
    return {
      error:
        "Un'analisi AOI è già in corso per questa sessione. Attendere il completamento o riprovare tra qualche minuto.",
    }
  }

  const ddLastRunCooldown = meta0.dd_last_run as { completed_at?: string } | undefined
  if (ddLastRunCooldown?.completed_at) {
    const lastCompleted = Date.parse(ddLastRunCooldown.completed_at)
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

  const lockStarted = new Date().toISOString()
  const lockRunId = randomUUID()
  await supabase
    .from('assessment_sessions')
    .update({
      metadata: {
        ...meta0,
        dd_analysis_in_progress: true,
        dd_analysis_started_at: lockStarted,
        dd_analysis_run_id: lockRunId,
      } as Json,
    })
    .eq('id', sessionId)

  let runId: string | undefined

  try {
    await removePreviousDueDiligenceRuns(supabase, user.id, sessionId)

    runId = randomUUID()
    const userId = user.id
    const aoiPath = aoiGeoJsonSessionPath(userId, sessionId)
    const reportPath = ddReportJsonSessionPath(userId, sessionId)
    const pngPath = aoiMapRenderSessionPath(userId, sessionId)

    const aoiFeatureCollection = buildStorageFeatureCollection(normalized.geometries, validPointBufferAreaHa)

    const { error: uploadAoiError } = await supabase.storage
      .from('user-uploads')
      .upload(aoiPath, JSON.stringify(aoiFeatureCollection), {
        contentType: 'application/geo+json',
        upsert: true,
      })
    if (uploadAoiError) {
      await clearDdAnalysisLock(supabase, sessionId)
      return { error: uploadAoiError.message }
    }

    const ee = getEe()
    await ensureEarthEngineInitialized()
    const parts = normalized.geometries.map((g) => {
      const geom = ee.Geometry(g)
      if (g.type === 'Point' || g.type === 'MultiPoint') {
        const radiusMeters = radiusMetersFromAreaHa(validPointBufferAreaHa!)
        return geom.buffer(radiusMeters)
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

    const sentinel2YearForPoster =
      sentinel2YearTilesResolved?.years?.length &&
      sentinel2YearTilesResolved.years[sentinel2YearTilesResolved.years.length - 1]?.year != null
        ? sentinel2YearTilesResolved.years[sentinel2YearTilesResolved.years.length - 1].year
        : 2024

    const completedMeta: RunMetadata = {
      run_id: runId,
      session_id: sessionId,
      user_id: userId,
      status: 'completed',
      created_at: lockStarted,
      completed_at: new Date().toISOString(),
      aoi_area_ha: assessment.aoi_area_ha,
      loss_pixel_count: assessment.loss_pixel_count_all,
      lossyear_histogram: assessment.lossyear_histogram_all,
      dataset_id: assessment.hansen_dataset_id,
      eudr_cutoff_date: EUDR_CUTOFF,
      pixel_area_m2: 900,
      artifact_paths: {
        aoi_geojson: aoiPath,
        metadata_json: reportPath,
      },
      cutting_date_iso: cuttingDate,
      eudr_refined: {
        jrc_gfc2020_dataset_id: assessment.jrc_gfc2020_dataset_id,
        forest_2020_ha_in_aoi: assessment.forest_2020_ha_in_aoi,
        forest_2020_pct_aoi: assessment.forest_2020_pct_aoi,
        loss_on_forest_2020_post_eudr_ha: assessment.loss_on_forest_2020_post_eudr_ha,
        loss_pixel_count_on_forest_2020_post_eudr:
          assessment.loss_pixel_count_on_forest_2020_post_eudr,
        jrc_assessment_ok: assessment.jrc_assessment_ok,
        ...(assessment.lossyear_histogram_on_forest_2020
          ? { lossyear_histogram_on_forest_2020: assessment.lossyear_histogram_on_forest_2020 }
          : {}),
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
    }

    const ddSnapshot = buildDdLastRunSnapshot(completedMeta)
    const reportPayload = buildDdReportPayload(
      completedMeta,
      ddSnapshot,
      Boolean(lossTiles?.dualClassMode),
      { hasSnapshot: false }
    )

    await supabase.storage.from('user-uploads').upload(reportPath, JSON.stringify(reportPayload), {
      contentType: 'application/json',
      upsert: true,
    })

    schedulePersistAoiMapPng(supabase, {
      reportPath,
      pngPath,
      runId,
      aoiEe,
      cuttingDateIso: cuttingDate,
      sentinel2Year: sentinel2YearForPoster,
    })

    const { data: sessionRow } = await supabase
      .from('assessment_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single()
    const prevMeta = (sessionRow?.metadata as Record<string, unknown>) || {}
    const {
      dd_analysis_in_progress: _p,
      dd_analysis_started_at: _s,
      dd_analysis_run_id: _r,
      ...prevWithoutLock
    } = prevMeta

    await supabase
      .from('assessment_sessions')
      .update({
        metadata: {
          ...prevWithoutLock,
          dd_last_run: ddSnapshot,
          ...(!ddSnapshot.triggers_non_accettabile
            ? {
                aoi_gate_triggered: false,
                aoi_gate_reasons: [],
              }
            : {}),
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
    await clearDdAnalysisLock(supabase, sessionId)
    return { runId, error: err instanceof Error ? err.message : String(err) }
  }
}

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
