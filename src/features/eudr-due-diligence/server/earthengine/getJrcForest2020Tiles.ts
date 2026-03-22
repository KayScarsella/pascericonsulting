/**
 * Tile URL per overlay "foresta al 31/12/2020" (JRC GFC2020 V3).
 * Solo pixel Map==1 visibili in verde; resto trasparente. Clip ad AOI.
 */

import { ensureEarthEngineInitialized } from './initialize'
import { JRC_GFC2020_ASSET } from './runEudrAoiAssessment'

export interface Forest2020TilesResult {
  tilesUrlTemplate: string
  attribution: string
}

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

export async function getJrcForest2020TilesForAoi(aoiGeometry: unknown): Promise<Forest2020TilesResult> {
  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as any
  const geometry = ee.Geometry(aoiGeometry)
  const jrc = ee.Image(JRC_GFC2020_ASSET).select('Map')
  const forestOnly = jrc.eq(1).updateMask(jrc.eq(1)).clip(geometry)
  const mapId = await getMapIdPromise(forestOnly, {
    min: 1,
    max: 1,
    palette: ['#15803d'],
  })
  return {
    tilesUrlTemplate: mapId.urlFormat,
    attribution: 'JRC GFC2020 V3 — foresta al 31/12/2020 (UE)',
  }
}
