/**
 * Run Hansen GFC lossyear histogram inside AOI (Earth Engine).
 * Dataset: UMD/hansen/global_forest_change_2024_v1_12 — loss + lossyear (1–24 = 2001–2024).
 * Aggiornare l'asset quando sarà disponibile una versione con anni successivi al 2024 (vedi hansen-version.ts).
 * Older IDs like UMD/HANSEN/GFC2023/v1.11 are removed/renamed; use catalog snippet.
 *
 * Note: ee.data.computeValue invokes getInfo callback as (result, error) — not (error, result).
 * Passing only one argument treats EE failures as "null result".
 */

import { ensureEarthEngineInitialized } from './initialize'
import type { LossYearHistogram } from '../../types/due-diligence-run'

/** Public catalog asset — must match EE Data Catalog (case-sensitive path). */
const HANSEN_ASSET = 'UMD/hansen/global_forest_change_2024_v1_12'
const SCALE_M = 30
const PIXEL_AREA_M2 = SCALE_M * SCALE_M

export interface ForestLossRunResult {
  lossyear_histogram: LossYearHistogram
  loss_pixel_count: number
  aoi_area_ha: number
  dataset_id: string
}

/** Promisify EE getInfo — callback signature is (result, error). */
function getInfoPromise(computed: { getInfo: (cb: (result: unknown, error?: Error) => void) => void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    computed.getInfo((result: unknown, error?: Error) => {
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    })
  })
}

/**
 * Compute frequency histogram of lossyear (pixels where loss > 0) inside AOI.
 */
export async function runForestLossHistogramForAoi(aoiGeometry: unknown): Promise<ForestLossRunResult> {
  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as any

  const geometry = ee.Geometry(aoiGeometry)
  const gf = ee.Image(HANSEN_ASSET)
  const lossyear = gf.select('lossyear')
  // Hansen v1.4+: "Loss corresponds to nonzero values of loss year" — mask where lossyear > 0
  // (avoids relying on separate loss band; stand-replacement loss only, per GLAD definition)
  const masked = lossyear.updateMask(lossyear.gt(0))

  const histImage = masked.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry,
    scale: SCALE_M,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 2,
  })

  let histDict: Record<string, unknown>
  try {
    const raw = await getInfoPromise(histImage)
    if (raw == null || typeof raw !== 'object') {
      // Valid "no data" case: no loss pixels in AOI
      histDict = {}
    } else {
      histDict = raw as Record<string, unknown>
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Earth Engine reduceRegion failed: ${msg}`)
  }

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
  if (Object.keys(histogram).length === 0 && histDict.lossyear && typeof histDict.lossyear === 'object') {
    histogram = histDict.lossyear as LossYearHistogram
  }

  let loss_pixel_count = 0
  for (const c of Object.values(histogram)) {
    loss_pixel_count += Number(c) || 0
  }

  let aoi_area_ha: number
  try {
    const areaResult = await getInfoPromise(geometry.area({ maxError: 1 }))
    aoi_area_ha = Number(areaResult) / 10000
    if (!Number.isFinite(aoi_area_ha)) aoi_area_ha = 0
  } catch {
    aoi_area_ha = 0
  }

  return {
    lossyear_histogram: histogram,
    loss_pixel_count,
    aoi_area_ha,
    dataset_id: HANSEN_ASSET,
  }
}

export { PIXEL_AREA_M2, HANSEN_ASSET }
