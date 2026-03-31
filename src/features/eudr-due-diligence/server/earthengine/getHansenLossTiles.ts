/**
 * Earth Engine tile URL for Hansen loss layer clipped to AOI.
 * Image + vis params come da aoiMapLayerSpecs (stessa ricetta del PNG poster).
 */

import { ensureEarthEngineInitialized } from './initialize'
import { getHansenLossLayerSpec } from './aoiMapLayerSpecs'

function getMapIdPromise(
  image: unknown,
  visParams: Record<string, unknown>
): Promise<{ urlFormat?: string }> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ee = require('@google/earthengine') as any
    ee.Image(image).getMapId(visParams, (mapId: { urlFormat?: string } | null, error?: Error) => {
      if (error) {
        reject(error)
        return
      }
      if (!mapId?.urlFormat) {
        reject(new Error('Earth Engine getMapId did not return urlFormat'))
        return
      }
      resolve(mapId as { urlFormat: string })
    })
  })
}

export { COLOR_POST_CUT, COLOR_POST_EU_ONLY, HANSEN_EUDR_MIN_BAND } from '../../constants/hansen-visual'

export interface HansenTilesResult {
  tilesUrlTemplate: string
  attribution: string
  dualClassMode: boolean
}

export async function getHansenLossTilesForAoi(
  aoiGeometry: unknown,
  cuttingDateIso?: string | null
): Promise<HansenTilesResult> {
  await ensureEarthEngineInitialized()
  const spec = getHansenLossLayerSpec(aoiGeometry, cuttingDateIso)

  if (spec.dualClassMode) {
    const mapId = await getMapIdPromise(spec.lossImage, spec.visParams)
    return {
      tilesUrlTemplate: mapId.urlFormat!,
      attribution:
        'Hansen GFC — rosso = loss dall’anno di taglio in poi (≥); blu = solo 2021…anno prima del taglio',
      dualClassMode: true,
    }
  }

  const mapId = await getMapIdPromise(spec.lossImage, spec.visParams)
  return {
    tilesUrlTemplate: mapId.urlFormat!,
    attribution: 'Hansen/UMD — forest loss solo anni ≥ 2021 (cut-off EUDR)',
    dualClassMode: false,
  }
}
