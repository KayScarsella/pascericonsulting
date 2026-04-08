/**
 * AOI screening EUDR: gate "non accettabile" quando vi è evidenza di loss dopo il 31/12/2020
 * e, se è nota la data di taglio, con anno di loss ≥ max(2021, anno di taglio) (non basta loss solo negli anni prima del taglio).
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

/** Primo anno di loss Hansen rilevante per screening EUDR (post 31/12/2020). */
const EUDR_FIRST_LOSS_CALENDAR_YEAR = 2021

/**
 * Con data di taglio: il gate considera solo pixel con anno di loss ≥ max(2021, anno taglio).
 * Così loss solo negli anni prima del taglio (ma ancora post-2020) non attiva l'esito negativo.
 */
function effectiveGateMinCalendarYear(cuttingCalendarYear: number): number {
  return Math.max(EUDR_FIRST_LOSS_CALENDAR_YEAR, cuttingCalendarYear)
}

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
  const forestHist = refined?.lossyear_histogram_on_forest_2020
  const jrcOk = refined?.jrc_assessment_ok === true
  const minHa = DEFAULT_MIN_LOSS_ON_FOREST_HA

  let gateUsesJrc = false
  if (jrcOk && lossHaOnForest != null && lossHaOnForest >= minHa) {
    gateUsesJrc = true
  }

  const has_loss_after_eudr_cutoff = gateUsesJrc
    ? true
    : hasLossAfterCalendarYear(histogramAll, 2020)

  const cuttingYear =
    meta.cutting_date_iso && /^\d{4}/.test(meta.cutting_date_iso)
      ? parseInt(meta.cutting_date_iso.slice(0, 4), 10)
      : null
  const hasValidCutting = cuttingYear != null && Number.isFinite(cuttingYear)
  const minGateYear = hasValidCutting ? effectiveGateMinCalendarYear(cuttingYear!) : null

  /** Loss nell'AOI dall'anno effettivo di gate in poi (≥ max(2021, anno taglio)) se c'è data taglio. */
  let has_loss_after_cutting_date = false
  if (minGateYear != null) {
    has_loss_after_cutting_date = hasLossFromCalendarYearInclusive(histogramAll, minGateYear)
  }

  const lossPixelCount = meta.loss_pixel_count ?? 0

  let triggersFromRefined = false
  if (gateUsesJrc && lossHaOnForest != null && lossHaOnForest >= minHa) {
    if (minGateYear != null) {
      const histForHarvest =
        forestHist && typeof forestHist === 'object' && Object.keys(forestHist).length > 0
          ? forestHist
          : null
      triggersFromRefined =
        histForHarvest != null && hasLossFromCalendarYearInclusive(histForHarvest, minGateYear)
    } else {
      triggersFromRefined = true
    }
  }

  let triggersFromHansenFallback = false
  if (!gateUsesJrc && lossPixelCount > 0) {
    if (minGateYear != null) {
      triggersFromHansenFallback = hasLossFromCalendarYearInclusive(histogramAll, minGateYear)
    } else {
      triggersFromHansenFallback = has_loss_after_eudr_cutoff
    }
  }

  const triggers_non_accettabile = triggersFromRefined || triggersFromHansenFallback

  const reasons: string[] = []
  if (triggers_non_accettabile) {
    reasons.push(
      'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
    )
    if (triggersFromRefined && lossHaOnForest != null) {
      reasons.push(
        `Evidenza EUDR-raffinata: loss su foresta al 2020 (JRC GFC2020) con anno di loss ≥ ${minGateYear ?? EUDR_FIRST_LOSS_CALENDAR_YEAR}, circa ${lossHaOnForest.toFixed(2)} ha (soglia ${minHa} ha).`
      )
    } else if (triggersFromHansenFallback) {
      reasons.push(
        minGateYear != null
          ? `Rilevata perdita forestale Hansen nell'AOI con anno di loss ≥ ${minGateYear} (allineato a data di taglio e cutoff EUDR).`
          : 'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
      )
    }
  }

  const advisory_notes: string[] = []
  advisory_notes.push(
    'Hansen fornisce un anno di loss per pixel, non la data esatta. Per una visione più vicina alla data di taglio servono immagini Sentinel-2 (compositi per anno nella mappa) o analisi mensile dedicate.'
  )
  if (meta.cutting_date_iso && /^\d{4}/.test(meta.cutting_date_iso)) {
    const cy = parseInt(meta.cutting_date_iso.slice(0, 4), 10)
    const cuttingBand = cy - 2000
    if (Number.isFinite(cuttingBand) && cuttingBand >= 1 && cuttingBand <= 24) {
      const sameYearCount = Number(histogramAll?.[String(cuttingBand)] ?? 0) || 0
      if (sameYearCount > 0) {
        advisory_notes.push(
          `Nel ${cy} risultano pixel di loss nell'AOI: Hansen non distingue il mese — se il taglio è a fine anno, la loss nello stesso anno potrebbe essere anteriore al taglio; usare immagini per anno o verifica manuale. Il gate considera loss dall'anno ${minGateYear ?? cy} in poi (≥).`
        )
      }
    }
  }

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

  const normalizedReasons = (ddLastRun.reasons || []).map((r) =>
    r.includes('stand-replacement') && r.includes('screening senza intersect JRC')
      ? 'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
      : r
  )

  const gateDetail: RiskDetail = {
    questionId: AOI_GATE_QUESTION_ID,
    label:
      'Screening geospaziale AOI (Hansen + JRC GFC2020 dove applicabile): evidenza post-cutoff EUDR; con data di taglio, solo loss con anno ≥ max(2021, anno taglio)',
    shortLabel: 'Screening AOI (EUDR)',
    riskIndex: AOI_GATE_RISK_INDEX,
    answerRaw: 'triggered',
    answerLabel: normalizedReasons.join(' '),
  }

  const details = [...result.details, gateDetail]
  const overallRisk = Math.max(result.overallRisk, AOI_GATE_RISK_INDEX)

  return {
    details,
    overallRisk,
    outcome: 'non accettabile',
    outcomeDescription:
      'Esito non accettabile per evidenza geospaziale nell’AOI (perdita rilevante dopo il 31/12/2020 e, se nota la data di taglio, con anno di loss dall’anno di taglio in poi). Sono necessarie verifiche e/o mitigazione.',
    expiryDate: null,
  }
}

export { RISK_THRESHOLD }
