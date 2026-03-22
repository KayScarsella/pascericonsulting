/**
 * Composito mediano Sentinel-2 (Harmonized) per anno solare, clip ad AOI.
 * Confronto visivo tra anni; ~10 m. Fallisce per anno se poche scene o errore.
 */

import { ensureEarthEngineInitialized } from './initialize'

export type YearTileEntry = { year: number; tilesUrlTemplate: string }

function getMapIdPromise(
  image: unknown,
  visParams: Record<string, unknown>
): Promise<{ urlFormat: string }> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ee = require('@google/earthengine') as any
    ee.Image(image).getMapId(visParams, (mapId: { urlFormat?: string } | null, error?: Error) => {
      if (error || !mapId?.urlFormat) reject(error || new Error('getMapId failed'))
      else resolve(mapId as { urlFormat: string })
    })
  })
}

async function compositeForYear(aoiGeometry: unknown, year: number): Promise<YearTileEntry | null> {
  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as any
  const geometry = ee.Geometry(aoiGeometry)
  const start = ee.Date.fromYMD(year, 1, 1)
  const end = ee.Date.fromYMD(year, 12, 31)
  const s2 = ee
    .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  const median = s2.median().clip(geometry).select(['B4', 'B3', 'B2'])
  const vis = { bands: ['B4', 'B3', 'B2'], min: 0, max: 3500, gamma: 1.15 }
  const mapId = await getMapIdPromise(median, vis)
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
