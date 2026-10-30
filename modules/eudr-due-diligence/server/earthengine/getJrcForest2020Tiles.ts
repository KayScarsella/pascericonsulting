/**
 * Tile URL per overlay "foresta al 31/12/2020" (JRC GFC2020 V3).
 * Stessa immagine di aoiMapLayerSpecs.
 */

import { ensureEarthEngineInitialized } from './initialize'
import { getJrcForest2020LayerSpec } from './aoiMapLayerSpecs'

type EarthEngineMapClient = {
  Image: (image: unknown) => {
    getMapId: (
      visParams: Record<string, unknown>,
      cb: (mapId: { urlFormat?: string } | null, error?: Error) => void
    ) => void
  }
}

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
    const ee = require('@google/earthengine') as EarthEngineMapClient
    ee.Image(image).getMapId(visParams, (mapId: { urlFormat?: string } | null, error?: Error) => {
      if (error || !mapId?.urlFormat) reject(error || new Error('getMapId failed'))
      else resolve(mapId as { urlFormat: string })
    })
  })
}

export async function getJrcForest2020TilesForAoi(aoiGeometry: unknown): Promise<Forest2020TilesResult> {
  await ensureEarthEngineInitialized()
  const spec = getJrcForest2020LayerSpec(aoiGeometry)
  const mapId = await getMapIdPromise(spec.forestImage, spec.visParams)
  return {
    tilesUrlTemplate: mapId.urlFormat,
    attribution: 'JRC GFC2020 V3 — foresta al 31/12/2020 (UE)',
  }
}
