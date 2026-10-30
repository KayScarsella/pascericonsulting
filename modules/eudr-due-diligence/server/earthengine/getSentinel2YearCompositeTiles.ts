/**
 * Composito mediano Sentinel-2 (Harmonized) per anno solare, clip ad AOI.
 * Stessa pipeline di buildSentinel2MedianRgbImage + SENTINEL2_TRUECOLOR_VIS.
 */

import { ensureEarthEngineInitialized } from './initialize'
import { buildSentinel2MedianRgbImage, SENTINEL2_TRUECOLOR_VIS } from './aoiMapLayerSpecs'

export type YearTileEntry = { year: number; tilesUrlTemplate: string }

function getMapIdPromise(
  image: unknown,
  visParams: Record<string, unknown>
): Promise<{ urlFormat: string }> {
  return new Promise((resolve, reject) => {
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
    const ee = require('@google/earthengine') as any
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
    ee.Image(image).getMapId(visParams, (mapId: { urlFormat?: string } | null, error?: Error) => {
      if (error || !mapId?.urlFormat) reject(error || new Error('getMapId failed'))
      else resolve(mapId as { urlFormat: string })
    })
  })
}

async function compositeForYear(aoiGeometry: unknown, year: number): Promise<YearTileEntry | null> {
  await ensureEarthEngineInitialized()
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const geometry = ee.Geometry(aoiGeometry)
  const median = ee.Image(buildSentinel2MedianRgbImage(geometry, year)).clip(geometry)
  const mapId = await getMapIdPromise(median, SENTINEL2_TRUECOLOR_VIS)
  return { year, tilesUrlTemplate: mapId.urlFormat }
}

/** Anni di default: campionamento per non superare timeout EE; utente può rieseguire per altri anni. */
const DEFAULT_YEARS = [2020, 2022, 2024]

export async function getSentinel2YearCompositeTilesForAoi(
  aoiGeometry: unknown,
  years: number[] = DEFAULT_YEARS
): Promise<{ years: YearTileEntry[]; attribution: string }> {
  const settled = await Promise.allSettled(years.map((y) => compositeForYear(aoiGeometry, y)))
  const results: YearTileEntry[] = []
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value) results.push(s.value)
  }
  results.sort((a, b) => a.year - b.year)
  return {
    years: results,
    attribution: 'Sentinel-2 L2A — composito mediano annuale (EE)',
  }
}
