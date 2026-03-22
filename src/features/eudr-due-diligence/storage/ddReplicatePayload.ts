/**
 * Slim payload stored as dd_replicate.json — only what’s needed to replicate
 * map legend + histogram colors in PDF / offline, without full EE metadata.
 */

import type { LossYearHistogram } from '../types/due-diligence-run'
import { COLOR_POST_CUT, COLOR_POST_EU_ONLY } from '../constants/hansen-visual'

export const DD_REPLICATE_VERSION = 1

export type DdReplicatePayload = {
  v: typeof DD_REPLICATE_VERSION
  run_id: string
  session_id: string
  user_id: string
  cutting_date_iso: string
  /** Calendar year from cutting_date_iso — for blue/red split */
  cutting_year: number
  /** Same as map dual-class mode */
  dual_class_mode: boolean
  color_blue: string
  color_red: string
  /** Hansen lossyear band -> count (same as graph) */
  lossyear_histogram: LossYearHistogram
  aoi_area_ha?: number
  loss_pixel_count?: number
  dataset_id: string
  legend_blue: string
  legend_red: string
  /** Fixed block for PDF: limits + sources */
  sources_limits: string
}

export function buildDdReplicatePayload(params: {
  runId: string
  sessionId: string
  userId: string
  cuttingDateIso: string
  dualClassMode: boolean
  histogram: LossYearHistogram
  aoiAreaHa?: number
  lossPixelCount?: number
  datasetId: string
}): DdReplicatePayload {
  const cuttingYear = parseInt(params.cuttingDateIso.slice(0, 4), 10) || 2021
  const legendBlue = params.dualClassMode
    ? `Blu: loss 2021…anno prima del taglio (escluso anno ${cuttingYear})`
    : 'Blu: gradiente anni ≥2021 (nessuna data taglio)'
  const legendRed = params.dualClassMode
    ? `Rosso: loss dall'anno di taglio in poi (≥ ${cuttingYear})`
    : '—'
  const sources_limits = [
    'Fonti dati (screening, non DDS):',
    '• Hansen GFC (UMD/GLAD, Landsat ~30 m) — stand-replacement loss, anno per pixel; non provato per analisi areali EUDR rigorose.',
    '• JRC GFC2020 V3 (10 m) — foresta al 31/12/2020 dove usato per logica raffinata.',
    '• Limiti: Hansen non distingue il mese; stesso anno del taglio può includere loss ante/post taglio — usare Sentinel-2 per anno o verifica manuale.',
    '• Questo output è uno screening; la responsabilità della due diligence resta sull’operatore.',
  ].join('\n')

  return {
    v: DD_REPLICATE_VERSION,
    run_id: params.runId,
    session_id: params.sessionId,
    user_id: params.userId,
    cutting_date_iso: params.cuttingDateIso,
    cutting_year: cuttingYear,
    dual_class_mode: params.dualClassMode,
    color_blue: COLOR_POST_EU_ONLY,
    color_red: COLOR_POST_CUT,
    lossyear_histogram: params.histogram,
    aoi_area_ha: params.aoiAreaHa,
    loss_pixel_count: params.lossPixelCount,
    dataset_id: params.datasetId,
    legend_blue: legendBlue,
    legend_red: legendRed,
    sources_limits: sources_limits,
  }
}
