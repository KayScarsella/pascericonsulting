/**
 * Valutazione AOI allineata al contesto EUDR (Reg. UE 2023/1115):
 * - Cut-off 31/12/2020: nessuna messa a mercato se deforestazione/degrado dopo quella data.
 * - Definizione "foresta" come da regolamento → JRC GFC2020 V3 (10 m, band Map=1).
 * - Hansen GFC: stand-replacement loss annuale ~30 m — utile ma non provato per analisi areali rigorose.
 *
 * Logica:
 * 1) Intersecare loss post-2020 (Hansen lossyear ≥ 21) con foresta al 2020 (JRC).
 * 2) Contare solo pixel/ha di loss su area che era foresta al cut-off.
 * 3) Soglia minima area (default 0,5 ha) per ridurre falsi positivi.
 * 4) Il calcolo è per particella (reduceRegions), senza unire le geometrie e senza reproject.
 *    Se un batch JRC fallisce anche dopo lo split, l'analisi va in errore: niente esito solo Hansen.
 */

import { ensureEarthEngineInitialized } from './initialize'
import { HANSEN_ASSET, PIXEL_AREA_M2 } from './runForestLossForAoi'
import type { LossYearHistogram } from '../../types/due-diligence-run'
import { batchAoiGeometries, type AoiGeometry } from '../../prepareAoiGeometry'

type EarthEngineComputed = {
  getInfo: (cb: (result: unknown, error?: Error) => void) => void
}

type EarthEngineImage = {
  select: (band: string) => EarthEngineImage
  gt: (value: number) => EarthEngineImage
  gte: (value: number) => EarthEngineImage
  eq: (value: number) => EarthEngineImage
  and: (value: unknown) => EarthEngineImage
  multiply: (value: unknown) => EarthEngineImage
  updateMask: (mask: unknown) => EarthEngineImage
  rename: (name: string) => EarthEngineImage
  reduceRegions: (opts: Record<string, unknown>) => EarthEngineComputed
}

type EarthEngineClient = {
  Geometry: (value: unknown) => unknown
  Feature: (geom: unknown) => unknown
  FeatureCollection: (features: unknown[]) => unknown
  Image: ((value?: unknown) => EarthEngineImage) & { pixelArea: () => EarthEngineImage }
  Reducer: {
    frequencyHistogram: () => unknown
    sum: () => unknown
  }
}

const HANSEN_SCALE_M = 30
const JRC_SCALE_M = 10
const TILE_SCALE = 4
/** JRC GFC2020 V3 — foresta al 31/12/2020, definizione EUDR/FAO-FRA. */
export const JRC_GFC2020_ASSET = 'JRC/GFC2020/V3'
/** JRC forest types 2020 V1 — primary / naturally regenerating / planted (contesto degrado EUDR). */
export const JRC_GFC2020_SUBTYPES_ASSET = 'JRC/GFC2020_subtypes/V1'
/** Pixel 10 m → 100 m² */
const SUBTYPES_PIXEL_M2 = 100
/** Hansen lossyear band ≥ 21 → anno calendario ≥ 2021. */
export const HANSEN_POST_EUDR_MIN_BAND = 21

type BatchSums = {
  areaM2: number
  histAll: LossYearHistogram
  forestM2: number
  histRefined: LossYearHistogram
}

function getInfoPromise(computed: EarthEngineComputed): Promise<unknown> {
  return new Promise((resolve, reject) => {
    computed.getInfo((result: unknown, error?: Error) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

function emptyHistogram(): LossYearHistogram {
  return {}
}

function addHistogram(target: LossYearHistogram, extra: LossYearHistogram): void {
  for (const [band, count] of Object.entries(extra)) {
    target[band] = (target[band] || 0) + (Number(count) || 0)
  }
}

function sumHistogram(histogram: LossYearHistogram): number {
  let n = 0
  for (const count of Object.values(histogram)) n += Number(count) || 0
  return n
}

function featureProperties(feature: unknown): Record<string, unknown> {
  if (!feature || typeof feature !== 'object') return {}
  const properties = (feature as { properties?: unknown }).properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}
  return properties as Record<string, unknown>
}

function featuresOf(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const features = (raw as { features?: unknown }).features
  return Array.isArray(features) ? features : []
}

const AREA_KEYS = ['area_m2', 'forest_m2', 'area', 'sum', 'Map']

/** reduceRegions nomina i m² come banda (`area`, `Map`) oppure come output del reducer (`sum`). */
export function readSumM2(properties: Record<string, unknown>): number {
  for (const key of AREA_KEYS) {
    const value = Number(properties[key])
    if (Number.isFinite(value) && value > 0) return value
  }
  for (const value of Object.values(properties)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return 0
}

function histogramFromUnknown(value: unknown): LossYearHistogram | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const histogram: LossYearHistogram = {}
  let found = false
  for (const [key, countRaw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+(\.\d+)?$/.test(key)) continue
    const count = Number(countRaw)
    if (!Number.isFinite(count) || count <= 0) continue
    const band = String(Math.round(Number(key)))
    histogram[band] = (histogram[band] || 0) + count
    found = true
  }
  return found ? histogram : null
}

/**
 * L'istogramma può stare in `histogram`, nel nome banda (`lossyear`, `Map`)
 * oppure sulle proprietà stesse. Una chiave non intera non azzera le altre.
 */
export function readHistogram(properties: Record<string, unknown>): LossYearHistogram {
  for (const key of ['histogram', 'lossyear', 'Map']) {
    const parsed = histogramFromUnknown(properties[key])
    if (parsed) return parsed
  }
  for (const value of Object.values(properties)) {
    const parsed = histogramFromUnknown(value)
    if (parsed) return parsed
  }
  return histogramFromUnknown(properties) ?? {}
}

function sumFeatureAreas(raw: unknown): number {
  let total = 0
  for (const feature of featuresOf(raw)) total += readSumM2(featureProperties(feature))
  return total
}

function sumFeatureHistograms(raw: unknown): LossYearHistogram {
  const histogram = emptyHistogram()
  for (const feature of featuresOf(raw)) addHistogram(histogram, readHistogram(featureProperties(feature)))
  return histogram
}

function requireFeatures(raw: unknown, label: string): void {
  if (featuresOf(raw).length === 0) {
    throw new Error(`JRC GFC2020 non disponibile: ${label} senza risultati.`)
  }
}

function mergeSums(left: BatchSums, right: BatchSums): BatchSums {
  const histAll = { ...left.histAll }
  const histRefined = { ...left.histRefined }
  addHistogram(histAll, right.histAll)
  addHistogram(histRefined, right.histRefined)
  return {
    areaM2: left.areaM2 + right.areaM2,
    histAll,
    forestM2: left.forestM2 + right.forestM2,
    histRefined,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
  /** Istogramma Hansen completo (tutti gli anni di loss) */
  lossyear_histogram_all: LossYearHistogram
  loss_pixel_count_all: number
  /**
   * Istogramma loss SOLO dove JRC foresta 2020 = sì, SOLO band ≥ 21 (post cut-off).
   * Valorizzato solo se il JRC è stato calcolato: altrimenti l'analisi fallisce.
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

function featureCollection(ee: EarthEngineClient, geometries: AoiGeometry[]): unknown {
  return ee.FeatureCollection(geometries.map((geometry) => ee.Feature(ee.Geometry(geometry))))
}

async function reduceBatch(ee: EarthEngineClient, geometries: AoiGeometry[]): Promise<BatchSums> {
  const regions = featureCollection(ee, geometries)
  const lossyear = ee.Image(HANSEN_ASSET).select('lossyear')
  const hasLoss = lossyear.gt(0)
  const maskedAll = lossyear.updateMask(hasLoss).rename('lossyear')
  const forest2020 = ee.Image(JRC_GFC2020_ASSET).select('Map').eq(1)
  const forestArea = forest2020.multiply(ee.Image.pixelArea()).rename('forest_m2')
  const postEudrLoss = lossyear.gte(HANSEN_POST_EUDR_MIN_BAND).and(hasLoss)
  const maskedRefined = lossyear.updateMask(postEudrLoss).updateMask(forest2020).rename('lossyear')
  const regionOptions = { collection: regions, tileScale: TILE_SCALE }

  // Chiamate separate: un Dictionary unico restituiva le feature senza ettari né istogramma,
  // e la mappa (tile) mostrava la loss che i numeri azzeravano.
  const [areaRaw, histAllRaw, forestRaw, histRefinedRaw] = await Promise.all([
    getInfoPromise(
      ee.Image.pixelArea().rename('area_m2').reduceRegions({
        ...regionOptions,
        reducer: ee.Reducer.sum(),
        scale: HANSEN_SCALE_M,
      })
    ),
    getInfoPromise(
      maskedAll.reduceRegions({
        ...regionOptions,
        reducer: ee.Reducer.frequencyHistogram(),
        scale: HANSEN_SCALE_M,
      })
    ),
    getInfoPromise(
      forestArea.reduceRegions({
        ...regionOptions,
        reducer: ee.Reducer.sum(),
        scale: JRC_SCALE_M,
      })
    ),
    getInfoPromise(
      maskedRefined.reduceRegions({
        ...regionOptions,
        reducer: ee.Reducer.frequencyHistogram(),
        scale: HANSEN_SCALE_M,
      })
    ),
  ])
  requireFeatures(areaRaw, 'area AOI')
  requireFeatures(histAllRaw, 'istogramma Hansen')
  requireFeatures(forestRaw, 'foresta JRC')
  requireFeatures(histRefinedRaw, 'loss su foresta 2020')
  return {
    areaM2: sumFeatureAreas(areaRaw),
    histAll: sumFeatureHistograms(histAllRaw),
    forestM2: sumFeatureAreas(forestRaw),
    histRefined: sumFeatureHistograms(histRefinedRaw),
  }
}

/** Se il batch è troppo pesante, lo divide a metà finché resta una sola particella. */
async function reduceBatchOrSplit(ee: EarthEngineClient, geometries: AoiGeometry[]): Promise<BatchSums> {
  try {
    return await reduceBatch(ee, geometries)
  } catch (error) {
    if (geometries.length <= 1) {
      throw new Error(`JRC GFC2020 non disponibile: ${errorMessage(error)}`)
    }
    const mid = Math.ceil(geometries.length / 2)
    const left = await reduceBatchOrSplit(ee, geometries.slice(0, mid))
    const right = await reduceBatchOrSplit(ee, geometries.slice(mid))
    return mergeSums(left, right)
  }
}

async function reduceSubtypes(
  ee: EarthEngineClient,
  geometries: AoiGeometry[]
): Promise<Record<string, number>> {
  const regions = featureCollection(ee, geometries)
  const raw = await getInfoPromise(
    ee.Image(JRC_GFC2020_SUBTYPES_ASSET).select('Map').reduceRegions({
      collection: regions,
      reducer: ee.Reducer.frequencyHistogram(),
      scale: JRC_SCALE_M,
      tileScale: TILE_SCALE,
    })
  )
  return sumFeatureHistograms(raw)
}

/**
 * Ettari e istogrammi sommati per particella.
 * L'area è la somma dei pixel (non un dissolve): particelle sovrapposte vengono contate due volte.
 */
export async function runEudrAoiAssessment(aoiGeometries: AoiGeometry[]): Promise<EudrAoiAssessmentResult> {
  const geometries = aoiGeometries.filter(
    (geometry) => geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
  )
  if (geometries.length === 0) {
    throw new Error('JRC GFC2020 non disponibile: nessuna geometria poligonale da analizzare.')
  }

  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as EarthEngineClient

  let sums: BatchSums = {
    areaM2: 0,
    histAll: {},
    forestM2: 0,
    histRefined: {},
  }
  const subtypeCounts: Record<string, number> = {}
  let subtypesOk = true
  let subtypesError: string | undefined

  for (const batch of batchAoiGeometries(geometries)) {
    const part = await reduceBatchOrSplit(ee, batch)
    sums = mergeSums(sums, part)
    if (!subtypesOk) continue
    try {
      addHistogram(subtypeCounts, await reduceSubtypes(ee, batch))
    } catch (error) {
      subtypesOk = false
      subtypesError = errorMessage(error)
    }
  }

  const aoi_area_ha = sums.areaM2 / 10000
  const forest_2020_ha_in_aoi = sums.forestM2 / 10000
  const forest_2020_pct_aoi = aoi_area_ha > 0 ? (forest_2020_ha_in_aoi / aoi_area_ha) * 100 : null
  const loss_pixel_count_all = sumHistogram(sums.histAll)
  const loss_pixel_count_on_forest_2020_post_eudr = sumHistogram(sums.histRefined)
  const loss_on_forest_2020_post_eudr_ha =
    (loss_pixel_count_on_forest_2020_post_eudr * PIXEL_AREA_M2) / 10000

  const c1 = Number(subtypeCounts['1']) || 0
  const c10 = Number(subtypeCounts['10']) || 0
  const c20 = Number(subtypeCounts['20']) || 0
  const toHa = (n: number) => (n * SUBTYPES_PIXEL_M2) / 10000
  const typedTotal = c1 + c10 + c20
  const forest_types_2020: EudrAoiAssessmentResult['forest_types_2020'] = subtypesOk
    ? {
        dataset_id: JRC_GFC2020_SUBTYPES_ASSET,
        ha_naturally_regenerating: typedTotal > 0 ? toHa(c1) : null,
        ha_primary: typedTotal > 0 ? toHa(c10) : null,
        ha_planted: typedTotal > 0 ? toHa(c20) : null,
        ha_forest_typed_total: typedTotal > 0 ? toHa(typedTotal) : null,
        ok: true,
      }
    : {
        dataset_id: JRC_GFC2020_SUBTYPES_ASSET,
        ha_naturally_regenerating: null,
        ha_primary: null,
        ha_planted: null,
        ha_forest_typed_total: null,
        ok: false,
        ...(subtypesError ? { error: subtypesError } : {}),
      }

  return {
    hansen_dataset_id: HANSEN_ASSET,
    jrc_gfc2020_dataset_id: JRC_GFC2020_ASSET,
    aoi_area_ha,
    forest_2020_ha_in_aoi,
    forest_2020_pct_aoi,
    lossyear_histogram_all: sums.histAll,
    loss_pixel_count_all,
    lossyear_histogram_on_forest_2020: sums.histRefined,
    loss_pixel_count_on_forest_2020_post_eudr,
    loss_on_forest_2020_post_eudr_ha,
    jrc_assessment_ok: true,
    forest_types_2020,
  }
}
