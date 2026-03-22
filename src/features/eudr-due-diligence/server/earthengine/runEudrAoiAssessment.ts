/**
 * Valutazione AOI allineata al contesto EUDR (Reg. UE 2023/1115):
 * - Cut-off 31/12/2020: nessuna messa a mercato se deforestazione/degrado dopo quella data.
 * - Definizione "foresta" come da regolamento → JRC GFC2020 V3 (10 m, band Map=1).
 * - Hansen GFC: stand-replacement loss annuale ~30 m — utile ma non provato per analisi areali rigorose.
 *
 * Logica consigliata (non vincolante, come da FAQ JRC):
 * 1) Intersecare loss post-2020 (Hansen lossyear ≥ 21) con foresta al 2020 (JRC).
 * 2) Contare solo pixel/ha di loss su area che era foresta al cut-off → evidenza più diretta
 *    di conversione post-2020 su suolo forestale.
 * 3) Soglia minima area (default 0,5 ha, coerente con definizione foresta >0,5 ha) per ridurre
 *    falsi positivi da commission error.
 * 4) Se JRC non disponibile o errore EE → fallback screening Hansen-only (comportamento precedente).
 */

import { ensureEarthEngineInitialized } from './initialize'
import { HANSEN_ASSET, PIXEL_AREA_M2 } from './runForestLossForAoi'
import type { LossYearHistogram } from '../../types/due-diligence-run'

const HANSEN_SCALE_M = 30
/** JRC GFC2020 V3 — foresta al 31/12/2020, definizione EUDR/FAO-FRA. */
export const JRC_GFC2020_ASSET = 'JRC/GFC2020/V3'
/** JRC forest types 2020 V1 — primary / naturally regenerating / planted (contesto degrado EUDR). */
export const JRC_GFC2020_SUBTYPES_ASSET = 'JRC/GFC2020_subtypes/V1'
/** Pixel 10 m → 100 m² */
const SUBTYPES_PIXEL_M2 = 100
/** Hansen lossyear band ≥ 21 → anno calendario ≥ 2021. */
export const HANSEN_POST_EUDR_MIN_BAND = 21

function getInfoPromise(computed: {
  getInfo: (cb: (result: unknown, error?: Error) => void) => void
}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    computed.getInfo((result: unknown, error?: Error) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

function parseHistogramFromReduceRegion(histDict: Record<string, unknown>, bandName: string): LossYearHistogram {
  let histogram: LossYearHistogram = {}
  for (const v of Object.values(histDict)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, number>
      const keys = Object.keys(o)
      if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
        histogram = o
        break
      }
    }
  }
  if (Object.keys(histogram).length === 0 && histDict[bandName] && typeof histDict[bandName] === 'object') {
    histogram = histDict[bandName] as LossYearHistogram
  }
  return histogram
}

function sumHistogram(h: LossYearHistogram): number {
  let n = 0
  for (const c of Object.values(h)) n += Number(c) || 0
  return n
}

export interface EudrAoiAssessmentResult {
  /** Dataset Hansen usato per lossyear */
  hansen_dataset_id: string
  /** Dataset JRC usato per foresta 2020 */
  jrc_gfc2020_dataset_id: string
  /** Area AOI (ha) */
  aoi_area_ha: number
  /** Area classificata foresta JRC al 2020 nell'AOI (ha, scale 10 m) */
  forest_2020_ha_in_aoi: number | null
  /** % AOI coperta da foresta 2020 */
  forest_2020_pct_aoi: number | null
  /** Istogramma Hansen completo (tutti gli anni di loss) — come prima */
  lossyear_histogram_all: LossYearHistogram
  loss_pixel_count_all: number
  /**
   * Istogramma loss SOLO dove JRC foresta 2020 = sì, SOLO band ≥ 21 (post cut-off).
   * Se null, JRC non applicato (fallback Hansen-only).
   */
  lossyear_histogram_on_forest_2020: LossYearHistogram | null
  loss_pixel_count_on_forest_2020_post_eudr: number | null
  /** ha di loss post-2020 su foresta 2020 (pixel * 900 m²) */
  loss_on_forest_2020_post_eudr_ha: number | null
  /** true se assessment JRC è stato calcolato senza errore */
  jrc_assessment_ok: boolean
  /** messaggio se JRC fallito */
  jrc_assessment_error?: string
  /**
   * Contesto degrado: ripartizione tipi foresta al 2020 nell'AOI (solo dove foresta JRC).
   * Valori Map: 1 = naturally regenerating, 10 = primary, 20 = planted. Snapshot, nessun anno di degrado.
   */
  forest_types_2020?: {
    dataset_id: string
    ha_naturally_regenerating: number | null
    ha_primary: number | null
    ha_planted: number | null
    ha_forest_typed_total: number | null
    ok: boolean
    error?: string
  }
}

/**
 * Esegue reduceRegion su foresta JRC in AOI (scale 10 m) + histogram Hansen filtrato da maschera foresta 2020.
 */
export async function runEudrAoiAssessment(aoiGeometry: unknown): Promise<EudrAoiAssessmentResult> {
  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as any

  const geometry = ee.Geometry(aoiGeometry)

  const gf = ee.Image(HANSEN_ASSET)
  const lossyear = gf.select('lossyear')
  const hasLoss = lossyear.gt(0)
  const maskedAll = lossyear.updateMask(hasLoss)

  // AOI area ha
  let aoi_area_ha = 0
  try {
    const areaResult = await getInfoPromise(geometry.area({ maxError: 1 }))
    aoi_area_ha = Number(areaResult) / 10000
    if (!Number.isFinite(aoi_area_ha)) aoi_area_ha = 0
  } catch {
    aoi_area_ha = 0
  }

  // Histogram all loss years (unchanged behaviour baseline)
  const histAllImage = maskedAll.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry,
    scale: HANSEN_SCALE_M,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 2,
  })
  let histAllDict: Record<string, unknown> = {}
  try {
    const raw = await getInfoPromise(histAllImage)
    if (raw && typeof raw === 'object') histAllDict = raw as Record<string, unknown>
  } catch {
    histAllDict = {}
  }
  const lossyear_histogram_all = parseHistogramFromReduceRegion(histAllDict, 'lossyear')
  const loss_pixel_count_all = sumHistogram(lossyear_histogram_all)

  // JRC GFC2020 V3 — forest mask reprojected to Hansen grid
  let forest_2020_ha_in_aoi: number | null = null
  let forest_2020_pct_aoi: number | null = null
  let lossyear_histogram_on_forest_2020: LossYearHistogram | null = null
  let loss_pixel_count_on_forest_2020_post_eudr: number | null = null
  let jrc_assessment_ok = false
  let jrc_assessment_error: string | undefined

  try {
    const jrc = ee.Image(JRC_GFC2020_ASSET).select('Map')
    const forest2020 = jrc.eq(1)

    // Forest area in AOI at 10 m
    const forestAreaImage = forest2020.multiply(ee.Image.pixelArea()).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 2,
    })
    const forestAreaRaw = await getInfoPromise(forestAreaImage)
    if (forestAreaRaw && typeof forestAreaRaw === 'object') {
      const o = forestAreaRaw as Record<string, unknown>
      // reduceRegion su singola band restituisce spesso chiave "Map" o prima numerica
      const sumKey =
        Object.keys(o).find((k) => k.toLowerCase() === 'map') ??
        Object.keys(o).find((k) => typeof o[k] === 'number')
      const m2 = sumKey != null ? Number(o[sumKey]) : 0
      if (Number.isFinite(m2) && m2 >= 0) {
        forest_2020_ha_in_aoi = m2 / 10000
        if (aoi_area_ha > 0) forest_2020_pct_aoi = (forest_2020_ha_in_aoi / aoi_area_ha) * 100
      }
    }

    // Reproject forest mask to Hansen projection so pixel alignment is consistent
    const hansenProj = lossyear.projection()
    const forestOnHansen = forest2020.reproject({
      crs: hansenProj,
      scale: HANSEN_SCALE_M,
    })

    // Loss post EUDR (band >= 21) only where forest 2020
    const postEudrLoss = lossyear.gte(HANSEN_POST_EUDR_MIN_BAND).and(hasLoss)
    const maskedRefined = lossyear.updateMask(postEudrLoss).updateMask(forestOnHansen)

    const histRefinedImage = maskedRefined.reduceRegion({
      reducer: ee.Reducer.frequencyHistogram(),
      geometry,
      scale: HANSEN_SCALE_M,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 2,
    })
    const rawRefined = await getInfoPromise(histRefinedImage)
    if (rawRefined && typeof rawRefined === 'object') {
      const dict = rawRefined as Record<string, unknown>
      lossyear_histogram_on_forest_2020 = parseHistogramFromReduceRegion(dict, 'lossyear')
      loss_pixel_count_on_forest_2020_post_eudr = sumHistogram(lossyear_histogram_on_forest_2020)
      jrc_assessment_ok = true
    }
  } catch (e) {
    jrc_assessment_error = e instanceof Error ? e.message : String(e)
    lossyear_histogram_on_forest_2020 = null
    loss_pixel_count_on_forest_2020_post_eudr = null
  }

  const loss_on_forest_2020_post_eudr_ha =
    loss_pixel_count_on_forest_2020_post_eudr != null
      ? (loss_pixel_count_on_forest_2020_post_eudr * PIXEL_AREA_M2) / 10000
      : null

  // Forest types 2020 (JRC subtypes V1) — solo contesto degrado, non gate
  let forest_types_2020: EudrAoiAssessmentResult['forest_types_2020'] = {
    dataset_id: JRC_GFC2020_SUBTYPES_ASSET,
    ha_naturally_regenerating: null,
    ha_primary: null,
    ha_planted: null,
    ha_forest_typed_total: null,
    ok: false,
  }
  try {
    const subtypes = ee.Image(JRC_GFC2020_SUBTYPES_ASSET).select('Map')
    const histSub = subtypes.reduceRegion({
      reducer: ee.Reducer.frequencyHistogram(),
      geometry,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 2,
    })
    const rawSub = await getInfoPromise(histSub)
    const histMap = rawSub && typeof rawSub === 'object'
      ? parseHistogramFromReduceRegion(rawSub as Record<string, unknown>, 'Map')
      : {}
    const c1 = Number(histMap['1']) || 0
    const c10 = Number(histMap['10']) || 0
    const c20 = Number(histMap['20']) || 0
    const toHa = (n: number) => (n * SUBTYPES_PIXEL_M2) / 10000
    const total = c1 + c10 + c20
    forest_types_2020 = {
      dataset_id: JRC_GFC2020_SUBTYPES_ASSET,
      ha_naturally_regenerating: total > 0 ? toHa(c1) : null,
      ha_primary: total > 0 ? toHa(c10) : null,
      ha_planted: total > 0 ? toHa(c20) : null,
      ha_forest_typed_total: total > 0 ? toHa(total) : null,
      ok: true,
    }
  } catch (e) {
    forest_types_2020 = {
      ...forest_types_2020,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  return {
    hansen_dataset_id: HANSEN_ASSET,
    jrc_gfc2020_dataset_id: JRC_GFC2020_ASSET,
    aoi_area_ha,
    forest_2020_ha_in_aoi,
    forest_2020_pct_aoi,
    lossyear_histogram_all,
    loss_pixel_count_all,
    lossyear_histogram_on_forest_2020,
    loss_pixel_count_on_forest_2020_post_eudr,
    loss_on_forest_2020_post_eudr_ha,
    jrc_assessment_ok,
    ...(jrc_assessment_error ? { jrc_assessment_error } : {}),
    forest_types_2020,
  }
}
