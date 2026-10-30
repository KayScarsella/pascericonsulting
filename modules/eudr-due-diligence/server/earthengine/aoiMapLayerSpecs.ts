/**
 * Single source of truth for AOI map layers: same EE images + vis params as tile getMapId,
 * reused for server-side poster PNG (aligned with interactive map tile recipe).
 */

import { maskS2SrHarmonizedClouds } from './s2SrHarmonizedCloudMask'
import { HANSEN_ASSET } from './runForestLossForAoi'
import { JRC_GFC2020_ASSET } from './runEudrAoiAssessment'
import {
  COLOR_POST_CUT,
  COLOR_POST_EU_ONLY,
  HANSEN_EUDR_MIN_BAND,
} from '../../constants/hansen-visual'
import { HANSEN_LOSSYEAR_MAX_BAND } from '../../constants/hansen-version'

/** Sentinel-2 true-color params — identical to getSentinel2YearCompositeTiles getMapId. */
export const SENTINEL2_TRUECOLOR_VIS: Record<string, unknown> = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3500,
  gamma: 1.15,
}

function parseCuttingYearBand(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}/.test(iso)) return null
  const y = parseInt(iso.slice(0, 4), 10)
  if (!Number.isFinite(y)) return null
  const band = y - 2000
  if (band < 1 || band > HANSEN_LOSSYEAR_MAX_BAND) return null
  return band
}

/** Median S2 RGB — filterBounds on `filterGeom`; caller clips for tiles or uses full extent for poster base. */
export function buildSentinel2MedianRgbImage(filterGeom: unknown, year: number): unknown {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const start = ee.Date.fromYMD(year, 1, 1)
  const end = ee.Date.fromYMD(year, 12, 31)
  return ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(filterGeom)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
    .map(maskS2SrHarmonizedClouds)
    .median()
    .select(['B4', 'B3', 'B2'])
}

export interface HansenLossLayerSpec {
  lossImage: unknown
  visParams: Record<string, unknown>
  dualClassMode: boolean
}

/** Same classification + palette as getHansenLossTilesForAoi (getMapId). */
export function getHansenLossLayerSpec(
  aoiGeometry: unknown,
  cuttingDateIso?: string | null
): HansenLossLayerSpec {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const geometry = ee.Geometry(aoiGeometry)
  const gf = ee.Image(HANSEN_ASSET).clip(geometry)
  const lossyear = gf.select('lossyear')
  const hasLoss = lossyear.gt(0)
  const cutBand = parseCuttingYearBand(cuttingDateIso ?? undefined)
  const postEu = lossyear.gte(HANSEN_EUDR_MIN_BAND).and(hasLoss)

  if (cutBand != null) {
    const postCut = lossyear.gte(cutBand).and(hasLoss)
    const postEuOnly = postEu.and(lossyear.lt(cutBand))
    const classified = ee
      .Image(0)
      .where(postEuOnly, 1)
      .where(postCut, 2)
      .updateMask(postEu)
    return {
      lossImage: classified,
      visParams: {
        min: 1,
        max: 2,
        palette: [COLOR_POST_EU_ONLY, COLOR_POST_CUT],
      },
      dualClassMode: true,
    }
  }

  const maskedPostEu = lossyear.updateMask(postEu)
  return {
    lossImage: maskedPostEu,
    visParams: {
      min: HANSEN_EUDR_MIN_BAND,
      max: HANSEN_LOSSYEAR_MAX_BAND,
      palette: ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#172554'],
    },
    dualClassMode: false,
  }
}

export interface JrcForestLayerSpec {
  forestImage: unknown
  visParams: Record<string, unknown>
}

/** Same image + palette as getJrcForest2020TilesForAoi (getMapId). */
export function getJrcForest2020LayerSpec(aoiGeometry: unknown): JrcForestLayerSpec {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const geometry = ee.Geometry(aoiGeometry)
  const jrc = ee.Image(JRC_GFC2020_ASSET).select('Map')
  const forestOnly = jrc.eq(1).updateMask(jrc.eq(1)).clip(geometry)
  return {
    forestImage: forestOnly,
    visParams: { min: 1, max: 1, palette: ['#15803d'] },
  }
}

/** Default opacities aligned with DueDiligenceMap.tsx (forest 0.45, loss 0.78). */
export const POSTER_LAYER_OPACITY = {
  forest: 0.45,
  loss: 0.78,
} as const

/**
 * Blended RGBA image for getThumbURL: S2 (same median recipe as tiles, extent = exportBounds)
 * + JRC + Hansen + AOI outline.
 */
export function composeAoiPosterEeImage(params: {
  aoiGeometry: unknown
  exportBounds: unknown
  cuttingDateIso: string
  sentinel2Year: number
}): unknown {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const { aoiGeometry: geometry, exportBounds: bounds, cuttingDateIso, sentinel2Year } = params

  const s2Median = buildSentinel2MedianRgbImage(bounds, sentinel2Year)
  const s2Rgb = ee.Image(s2Median).visualize({ ...SENTINEL2_TRUECOLOR_VIS, opacity: 1 })

  const { forestImage, visParams: jrcVis } = getJrcForest2020LayerSpec(geometry)
  const forestVis = ee.Image(forestImage).visualize({
    ...jrcVis,
    opacity: POSTER_LAYER_OPACITY.forest,
  })

  const { lossImage, visParams: lossVis } = getHansenLossLayerSpec(geometry, cuttingDateIso)
  const lossVisImg = ee.Image(lossImage).visualize({
    ...lossVis,
    opacity: POSTER_LAYER_OPACITY.loss,
  })

  const outlineFc = ee.FeatureCollection([ee.Feature(geometry)])
  const outline = ee.Image().byte().paint(outlineFc, 1, 2)
  const outlineVis = outline.visualize({ min: 0, max: 1, palette: ['#1e3a8a'], opacity: 0.95 })

  return ee.Image(s2Rgb).blend(forestVis).blend(lossVisImg).blend(outlineVis)
}
