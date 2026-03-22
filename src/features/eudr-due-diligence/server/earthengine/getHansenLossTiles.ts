/**
 * Earth Engine tile URL for Hansen loss layer clipped to AOI.
 * By default shows ONLY forest loss after EUDR cutoff (31/12/2020 → anni 2021+).
 * If cuttingDateIso is set, uses two classes:
 *   - blu = loss 2021 … anno *prima* del taglio (solo anni < anno taglio) — così l'anno taglio non è tutto blu
 *   - rosso = dall'anno di taglio in poi (≥ anno taglio): se c'è loss nell'anno inserito, è rosso e il gate è coerente
 * Pre-2021 loss is masked (transparent).
 */

import { ensureEarthEngineInitialized } from './initialize'
import { HANSEN_ASSET } from './runForestLossForAoi'
import {
  COLOR_POST_CUT,
  COLOR_POST_EU_ONLY,
  HANSEN_EUDR_MIN_BAND,
} from '../../constants/hansen-visual'
import { HANSEN_LOSSYEAR_MAX_BAND } from '../../constants/hansen-version'

const MAX_BAND = HANSEN_LOSSYEAR_MAX_BAND

export { COLOR_POST_CUT, COLOR_POST_EU_ONLY, HANSEN_EUDR_MIN_BAND }

export interface HansenTilesResult {
  tilesUrlTemplate: string
  attribution: string
  /** true se il layer è classificato UE vs post-taglio (due colori) */
  dualClassMode: boolean
}

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

function parseCuttingYearBand(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}/.test(iso)) return null
  const y = parseInt(iso.slice(0, 4), 10)
  if (!Number.isFinite(y)) return null
  // Hansen band = calendar year - 2000 (band 21 = 2021)
  const band = y - 2000
  if (band < 1 || band > MAX_BAND) return null
  return band
}

/**
 * Loss solo dopo cut-off UE; opzionalmente due classi (post-UE vs post-taglio).
 */
export async function getHansenLossTilesForAoi(
  aoiGeometry: unknown,
  cuttingDateIso?: string | null
): Promise<HansenTilesResult> {
  await ensureEarthEngineInitialized()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ee = require('@google/earthengine') as any

  const geometry = ee.Geometry(aoiGeometry)
  const gf = ee.Image(HANSEN_ASSET).clip(geometry)
  const lossyear = gf.select('lossyear')
  const hasLoss = lossyear.gt(0)

  const cutBand = parseCuttingYearBand(cuttingDateIso ?? undefined)
  const postEu = lossyear.gte(HANSEN_EUDR_MIN_BAND).and(hasLoss)

  if (cutBand != null) {
    // Rosso = anno taglio e successivi (≥ cutBand). Blu = solo 2021…anno-1 così l'ultimo anno non è tutto blu.
    const postCut = lossyear.gte(cutBand).and(hasLoss)
    const postEuOnly = postEu.and(lossyear.lt(cutBand))
    const classified = ee
      .Image(0)
      .where(postEuOnly, 1)
      .where(postCut, 2)
      .updateMask(postEu)

    const mapId = await getMapIdPromise(classified, {
      min: 1,
      max: 2,
      palette: [COLOR_POST_EU_ONLY, COLOR_POST_CUT],
    })

    return {
      tilesUrlTemplate: mapId.urlFormat!,
      attribution:
        'Hansen GFC — rosso = loss dall’anno di taglio in poi (≥); blu = solo 2021…anno prima del taglio',
      dualClassMode: true,
    }
  }

  // Nessuna data taglio: solo anni 2021+ con gradiente (stessa scala anni)
  const maskedPostEu = lossyear.updateMask(postEu)
  const mapId = await getMapIdPromise(maskedPostEu, {
    min: HANSEN_EUDR_MIN_BAND,
    max: HANSEN_LOSSYEAR_MAX_BAND,
    palette: [
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#172554',
    ],
  })

  return {
    tilesUrlTemplate: mapId.urlFormat!,
    attribution: 'Hansen/UMD — forest loss solo anni ≥ 2021 (cut-off EUDR)',
    dualClassMode: false,
  }
}
