/**
 * AOI screening EUDR: gate "non accettabile" quando vi è evidenza di loss dopo il 31/12/2020
 * o dopo la data di taglio dichiarata.
 *
 * Logica raffinata (consigliata per EUDR):
 * - JRC GFC2020 V3 definisce "foresta" al cut-off come da regolamento.
 * - Hansen lossyear ≥ 21 = loss in anni ≥ 2021. Intersecando con foresta 2020 si ottiene
 *   evidenza più diretta di area che era foresta al 2020 e risulta loss successiva.
 * - Soglia minima area (ha) su foresta 2020 per attivare il gate → riduce falsi positivi.
 * - Se JRC non disponibile → fallback screening Hansen-only (come prima).
 */

import type { LossYearHistogram, RunMetadata } from './types/due-diligence-run'
import type { RiskCalculationResult, RiskDetail } from '@/lib/risk-calculator'
import { RISK_THRESHOLD } from '@/lib/risk-calculator'
import { DEFAULT_MIN_LOSS_ON_FOREST_HA } from './constants/eudr-aoi-gate'

/** Persisted on assessment_sessions.metadata after each completed AOI run */
export type DdLastRunSnapshot = {
  run_id: string
  completed_at: string
  dataset_id: string
  eudr_cutoff_date: string
  cutting_date_iso?: string
  loss_pixel_count?: number
  has_loss_after_eudr_cutoff: boolean
  has_loss_after_cutting_date: boolean
  triggers_non_accettabile: boolean
  reasons: string[]
  /** true se il gate si basa su JRC∩Hansen (più preciso) */
  gate_uses_jrc_gfc2020?: boolean
  /** ha di loss post-2020 su foresta 2020 (se calcolato) */
  loss_on_forest_2020_post_eudr_ha?: number | null
  /** 'raffinata' = JRC∩Hansen ≥ soglia; 'base' = solo Hansen o JRC sotto soglia */
  logic_mode?: 'raffinata' | 'base'
  /** Avvisi non vincolanti (es. Hansen solo annuale, stesso anno taglio) */
  advisory_notes?: string[]
  /** Sessione su cui sono stati salvati gli artifact (cartella storage) — per PDF/cleanup */
  dd_artifact_session_id?: string
}

export const AOI_GATE_QUESTION_ID = 'aoi-hansen-gate'
const AOI_GATE_RISK_INDEX = 1.0

/** Hansen lossyear band → calendar year (v1.12: 1–24 → 2001–2024; band N → 2000+N) */
export function lossyearBandToCalendarYear(band: number): number {
  if (band >= 1 && band <= 99) return 2000 + band
  return band
}

export function hasLossAfterCalendarYear(
  histogram: LossYearHistogram | undefined,
  minYearExclusive: number
): boolean {
  if (!histogram || typeof histogram !== 'object') return false
  for (const [bandStr, count] of Object.entries(histogram)) {
    const n = Number(count) || 0
    if (n <= 0) continue
    const band = Number(bandStr)
    if (!Number.isFinite(band)) continue
    const year = lossyearBandToCalendarYear(band)
    if (year > minYearExclusive) return true
  }
  return false
}

/**
 * True se esiste almeno un pixel di loss con anno calendario >= minYearInclusive.
 * Usato per il gate "dal anno di taglio in poi" (incluso l'anno del taglio).
 */
export function hasLossFromCalendarYearInclusive(
  histogram: LossYearHistogram | undefined,
  minYearInclusive: number
): boolean {
  if (!histogram || typeof histogram !== 'object') return false
  for (const [bandStr, count] of Object.entries(histogram)) {
    const n = Number(count) || 0
    if (n <= 0) continue
    const band = Number(bandStr)
    if (!Number.isFinite(band)) continue
    const year = lossyearBandToCalendarYear(band)
    if (year >= minYearInclusive) return true
  }
  return false
}

/**
 * Costruisce snapshot e flag da RunMetadata completata.
 * Priorità: se eudr_refined è ok e ha loss su foresta 2020 ≥ soglia → gate con motivazione JRC.
 * Altrimenti fallback su histogram completo Hansen.
 */
export function buildDdLastRunSnapshot(meta: RunMetadata): DdLastRunSnapshot {
  const histogramAll = meta.lossyear_histogram
  const refined = meta.eudr_refined
  const lossHaOnForest = refined?.loss_on_forest_2020_post_eudr_ha ?? null
  const jrcOk = refined?.jrc_assessment_ok === true
  const minHa = DEFAULT_MIN_LOSS_ON_FOREST_HA

  // Istogramma per gate post-2020: raffinato se JRC ok e ha evidenza sopra soglia, altrimenti tutto
  let histogramForEudrCutoff: LossYearHistogram | undefined = histogramAll
  let gateUsesJrc = false

  if (jrcOk && lossHaOnForest != null && lossHaOnForest >= minHa) {
    // Gate basato su area significativa di loss su foresta al 2020
    gateUsesJrc = true
    // Per "has_loss_after_eudr_cutoff" usiamo refined: se ha >= minHa, c'è almeno un anno >2020 su foresta
    histogramForEudrCutoff = undefined // useremo flag diretto da ha
  }

  const has_loss_after_eudr_cutoff = gateUsesJrc
    ? true
    : hasLossAfterCalendarYear(histogramAll, 2020)

  let has_loss_after_cutting_date = false
  if (meta.cutting_date_iso && /^\d{4}/.test(meta.cutting_date_iso)) {
    const cuttingYear = parseInt(meta.cutting_date_iso.slice(0, 4), 10)
    if (Number.isFinite(cuttingYear)) {
      // Se JRC ok, ideale filtrare per anno su refined — non abbiamo histogram refined in snapshot;
      // conservativo: dopo taglio usa histogramAll se non gateUsesJrc; se gateUsesJrc e ha loss su foresta,
      // verifichiamo ancora dopo taglio su all (se loss dopo taglio su non-forest non dovrebbe bastare da sola per EUDR)
      // Dal anno di taglio in poi (>=), non solo anni successivi — altrimenti loss nello stesso anno non conta
      has_loss_after_cutting_date = hasLossFromCalendarYearInclusive(histogramAll, cuttingYear)
    }
  }

  const lossPixelCount = meta.loss_pixel_count ?? 0
  const reasons: string[] = []

  if (gateUsesJrc && lossHaOnForest != null) {
    reasons.push(
      `Evidenza EUDR-raffinata: loss Hansen post-31/12/2020 su area classificata foresta al 2020 (JRC GFC2020), circa ${lossHaOnForest.toFixed(2)} ha (soglia ${minHa} ha).`
    )
  } else if (has_loss_after_eudr_cutoff && !gateUsesJrc) {
    reasons.push(
      'Rilevata perdita forestale Hansen (stand-replacement) nell’AOI in anni successivi al 31/12/2020 (screening senza intersect JRC o sotto soglia ha).'
    )
  }

  if (has_loss_after_cutting_date && meta.cutting_date_iso) {
    reasons.push(
      `Rilevata perdita forestale nell'AOI dall'anno della data di taglio in poi (≥ ${meta.cutting_date_iso.slice(0, 4)}).`
    )
  }

  // Hansen assegna un solo anno al pixel — non distingue mese. Se il taglio è a fine anno e c'è loss nello stesso anno, non si sa se prima/dopo.
  const advisory_notes: string[] = []
  advisory_notes.push(
    'Hansen fornisce un anno di loss per pixel, non la data esatta. Per una visione più vicina alla data di taglio servono immagini Sentinel-2 (compositi per anno nella mappa) o analisi mensile dedicate.'
  )
  if (meta.cutting_date_iso && /^\d{4}/.test(meta.cutting_date_iso)) {
    const cuttingYear = parseInt(meta.cutting_date_iso.slice(0, 4), 10)
    const cuttingBand = cuttingYear - 2000
    if (Number.isFinite(cuttingBand) && cuttingBand >= 1 && cuttingBand <= 24) {
      const sameYearCount = Number(histogramAll?.[String(cuttingBand)] ?? 0) || 0
      if (sameYearCount > 0) {
        advisory_notes.push(
          `Nel ${cuttingYear} risultano pixel di loss nell'AOI: Hansen non distingue il mese — se il taglio è a fine anno, la loss nello stesso anno potrebbe essere anteriore al taglio; usare immagini per anno o verifica manuale. Il gate considera loss dall'anno ${cuttingYear} in poi (≥).`
        )
      }
    }
  }

  // Gate: (loss su foresta 2020 ≥ soglia) OR (fallback Hansen con pixel dopo cutoff) OR (dopo taglio)
  const triggersFromRefined =
    gateUsesJrc && lossHaOnForest != null && lossHaOnForest >= minHa
  const triggersFromHansenFallback =
    !gateUsesJrc && lossPixelCount > 0 && has_loss_after_eudr_cutoff
  const triggers_non_accettabile =
    triggersFromRefined || triggersFromHansenFallback || has_loss_after_cutting_date

  const logic_mode: 'raffinata' | 'base' = gateUsesJrc ? 'raffinata' : 'base'

  return {
    run_id: meta.run_id,
    dd_artifact_session_id: meta.session_id,
    completed_at: meta.completed_at || meta.created_at,
    dataset_id: meta.dataset_id,
    eudr_cutoff_date: meta.eudr_cutoff_date,
    ...(meta.cutting_date_iso ? { cutting_date_iso: meta.cutting_date_iso } : {}),
    loss_pixel_count: lossPixelCount,
    has_loss_after_eudr_cutoff,
    has_loss_after_cutting_date,
    triggers_non_accettabile,
    reasons,
    ...(gateUsesJrc ? { gate_uses_jrc_gfc2020: true } : {}),
    ...(lossHaOnForest != null ? { loss_on_forest_2020_post_eudr_ha: lossHaOnForest } : {}),
    logic_mode,
    ...(advisory_notes.length > 0 ? { advisory_notes } : {}),
  }
}

export function applyAoiGateToEudrRiskResult(
  result: RiskCalculationResult,
  ddLastRun: DdLastRunSnapshot | null | undefined
): RiskCalculationResult {
  if (!ddLastRun?.triggers_non_accettabile) return result

  const gateDetail: RiskDetail = {
    questionId: AOI_GATE_QUESTION_ID,
    label:
      'Screening geospaziale AOI (Hansen + JRC GFC2020 dove applicabile): evidenza dopo cutoff EUDR o dopo data di taglio',
    shortLabel: 'Screening AOI (EUDR)',
    riskIndex: AOI_GATE_RISK_INDEX,
    answerRaw: 'triggered',
    answerLabel: ddLastRun.reasons.join(' '),
  }

  const details = [...result.details, gateDetail]
  const overallRisk = Math.max(result.overallRisk, AOI_GATE_RISK_INDEX)

  return {
    details,
    overallRisk,
    outcome: 'non accettabile',
    outcomeDescription:
      'Esito non accettabile per evidenza geospaziale nell’AOI (perdita su foresta al 2020 dopo il 31/12/2020, oppure screening Hansen/post-taglio). Sono necessarie verifiche e/o mitigazione.',
    expiryDate: null,
  }
}

export { RISK_THRESHOLD }
