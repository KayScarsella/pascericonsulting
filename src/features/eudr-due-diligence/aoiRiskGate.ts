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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { LossYearHistogram, RunMetadata } from './types/due-diligence-run'
import type { RiskCalculationResult, RiskDetail } from '@/lib/risk-calculator'
import { RISK_THRESHOLD } from '@/lib/risk-calculator'
import { DEFAULT_MIN_LOSS_ON_FOREST_HA } from './constants/eudr-aoi-gate'
import { HANSEN_LAST_LOSS_CALENDAR_YEAR } from './constants/hansen-version'

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
  /**
   * Loss nell'ultimo anno Hansen disponibile con data di taglio successiva
   * (il gate classico non conterebbe quella loss) → evidenza «Tendenza deforestazione».
   */
  tendenza_deforestazione?: boolean
  /** Sessione su cui sono stati salvati gli artifact (cartella storage) — per PDF/cleanup */
  dd_artifact_session_id?: string
  /** User id della cartella storage `{userId}/eudr-due-diligence/...` (sempre il proprietario sessione) */
  dd_artifact_user_id?: string
}

/**
 * Uuid stabile per mitigation_history.question_id (colonna uuid, senza FK verso questions).
 * Non è una riga di `questions`: la mitigazione non scrive user_responses.
 */
export const AOI_GATE_QUESTION_ID = 'a01a14e0-0000-4000-8000-000000000014'
const AOI_GATE_RISK_INDEX = 1.0
/** Soglia già usata dalle risposte accettabili (overallRisk <= 0.30). */
export const AOI_GATE_MITIGATED_RISK_INDEX = 0.3
export const AOI_GATE_MITIGATED_ANSWER = 'mitigato'

export const AOI_GATE_ANSWER_LABELS: Record<string, string> = {
  triggered: 'Evidenza geospaziale',
  tendenza_deforestazione: 'Tendenza deforestazione',
  mitigato: 'Mitigato',
}

export const AOI_GATE_ANSWER_LOOKUP: Record<string, number> = {
  triggered: AOI_GATE_RISK_INDEX,
  tendenza_deforestazione: AOI_GATE_RISK_INDEX,
  mitigato: AOI_GATE_MITIGATED_RISK_INDEX,
}

const ACCETTABILE_DESCRIPTION =
  'Per questo approvvigionamento il rischio deforestazione è trascurabile, non sono necessarie azioni di mitigazione.'
const NON_ACCETTABILE_DESCRIPTION =
  'Per questo approvvigionamento il rischio deforestazione è non trascurabile, sono necessarie azioni di mitigazione.'

export type AoiGateApplyOptions = {
  /** Ultima mitigazione del punto 14 con risposta «mitigato». */
  mitigated?: boolean
}

export function isAoiGateMitigatedAnswer(raw: string | null | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === AOI_GATE_MITIGATED_ANSWER
}

export function aoiGateAnswerLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—'
  const key = Object.keys(AOI_GATE_ANSWER_LABELS).find(
    (k) => k.toLowerCase() === raw.trim().toLowerCase()
  )
  return key ? AOI_GATE_ANSWER_LABELS[key] : raw
}

export function isAoiTendenza(dd: DdLastRunSnapshot | null | undefined): boolean {
  return (
    dd?.tendenza_deforestazione === true &&
    (dd.reasons || []).some((r) => r.toLowerCase().includes('tendenza deforestazione'))
  )
}

/** Risposta del gate prima della mitigazione, salvata come previous_answer. */
export function aoiGateUnmitigatedAnswer(
  dd: DdLastRunSnapshot | null | undefined
): 'triggered' | 'tendenza_deforestazione' {
  return isAoiTendenza(dd) ? 'tendenza_deforestazione' : 'triggered'
}

/** Il gate geospaziale alza ancora il rischio (attivo e senza mitigazione sotto soglia). */
export function aoiGateStillFailing(
  dd: DdLastRunSnapshot | null | undefined,
  result: Pick<RiskCalculationResult, 'details'>
): boolean {
  if (!dd?.triggers_non_accettabile) return false
  const detail = result.details.find((d) => d.questionId === AOI_GATE_QUESTION_ID)
  if (!detail) return true
  return detail.riskIndex > RISK_THRESHOLD
}

/** True se l'ultima riga di mitigation_history per il punto 14 è «mitigato». */
export async function isAoiGateMitigatedForSession(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('mitigation_history')
    .select('new_answer')
    .eq('session_id', sessionId)
    .eq('question_id', AOI_GATE_QUESTION_ID)
    .order('mitigated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return false
  return isAoiGateMitigatedAnswer(data.new_answer)
}

function riskResultFromDetails(
  details: RiskDetail[],
  nonAccettabileDescription: string
): RiskCalculationResult {
  const overallRisk = details.length > 0 ? Math.max(...details.map((d) => d.riskIndex)) : 0
  const isAccettabile = overallRisk <= RISK_THRESHOLD
  let expiryDate: string | null = null
  if (isAccettabile) {
    const d = new Date()
    d.setMonth(d.getMonth() + 12)
    expiryDate = d.toISOString().split('T')[0]
  }
  return {
    details,
    overallRisk,
    outcome: isAccettabile ? 'accettabile' : 'non accettabile',
    outcomeDescription: isAccettabile ? ACCETTABILE_DESCRIPTION : nonAccettabileDescription,
    expiryDate,
  }
}

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

/** True se l'histogram ha almeno un pixel nell'anno calendario indicato. */
export function hasLossInCalendarYear(
  histogram: LossYearHistogram | undefined,
  calendarYear: number
): boolean {
  if (!histogram || typeof histogram !== 'object') return false
  for (const [bandStr, count] of Object.entries(histogram)) {
    const n = Number(count) || 0
    if (n <= 0) continue
    const band = Number(bandStr)
    if (!Number.isFinite(band)) continue
    if (lossyearBandToCalendarYear(band) === calendarYear) return true
  }
  return false
}

/**
 * Tendenza deforestazione: data di taglio successiva all'ultimo anno Hansen,
 * loss presente in quell'anno, ma il gate classico post-taglio non scatta.
 */
export function detectTendenzaDeforestazione(args: {
  cuttingYear: number | null
  classicGateTriggered: boolean
  histogram: LossYearHistogram | undefined
  lastHansenYear?: number
}): boolean {
  const lastYear = args.lastHansenYear ?? HANSEN_LAST_LOSS_CALENDAR_YEAR
  if (args.classicGateTriggered) return false
  if (args.cuttingYear == null || !Number.isFinite(args.cuttingYear)) return false
  if (args.cuttingYear <= lastYear) return false
  return hasLossInCalendarYear(args.histogram, lastYear)
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

  const classicTriggered = triggersFromRefined || triggersFromHansenFallback

  /** Preferisci histogram su foresta 2020 se JRC ok; altrimenti Hansen completo. */
  const histForTrend =
    gateUsesJrc && forestHist && typeof forestHist === 'object' && Object.keys(forestHist).length > 0
      ? forestHist
      : histogramAll

  const tendenza_deforestazione = detectTendenzaDeforestazione({
    cuttingYear: hasValidCutting ? cuttingYear : null,
    classicGateTriggered: classicTriggered,
    histogram: histForTrend,
  })

  const triggers_non_accettabile = classicTriggered || tendenza_deforestazione

  const reasons: string[] = []
  if (triggers_non_accettabile) {
    if (tendenza_deforestazione && !classicTriggered) {
      reasons.push(
        `Tendenza deforestazione: loss rilevata nell’ultimo anno Hansen disponibile (${HANSEN_LAST_LOSS_CALENDAR_YEAR}) con data di taglio successiva (${cuttingYear}). Il gate classico post-taglio non conterebbe questa loss.`
      )
    } else {
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
    dd_artifact_user_id: meta.user_id,
    completed_at: meta.completed_at || meta.created_at,
    dataset_id: meta.dataset_id,
    eudr_cutoff_date: meta.eudr_cutoff_date,
    ...(meta.cutting_date_iso ? { cutting_date_iso: meta.cutting_date_iso } : {}),
    loss_pixel_count: lossPixelCount,
    has_loss_after_eudr_cutoff,
    has_loss_after_cutting_date,
    triggers_non_accettabile,
    reasons,
    ...(tendenza_deforestazione ? { tendenza_deforestazione: true } : {}),
    ...(gateUsesJrc ? { gate_uses_jrc_gfc2020: true } : {}),
    ...(lossHaOnForest != null ? { loss_on_forest_2020_post_eudr_ha: lossHaOnForest } : {}),
    logic_mode,
    ...(advisory_notes.length > 0 ? { advisory_notes } : {}),
  }
}

export function applyAoiGateToEudrRiskResult(
  result: RiskCalculationResult,
  ddLastRun: DdLastRunSnapshot | null | undefined,
  options?: AoiGateApplyOptions
): RiskCalculationResult {
  if (!ddLastRun?.triggers_non_accettabile) return result

  const normalizedReasons = (ddLastRun.reasons || []).map((r) =>
    r.includes('stand-replacement') && r.includes('screening senza intersect JRC')
      ? 'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
      : r
  )

  const isTendenza = isAoiTendenza(ddLastRun)
  const mitigated = options?.mitigated === true

  const gateDetail: RiskDetail = {
    questionId: AOI_GATE_QUESTION_ID,
    label: isTendenza
      ? `Tendenza deforestazione (loss nell’ultimo anno Hansen ${HANSEN_LAST_LOSS_CALENDAR_YEAR} con data di taglio successiva)`
      : 'Screening geospaziale AOI (Hansen + JRC GFC2020 dove applicabile): evidenza post-cutoff EUDR; con data di taglio, solo loss con anno ≥ max(2021, anno taglio)',
    shortLabel: isTendenza ? 'Tendenza deforestazione' : 'Screening AOI (EUDR)',
    riskIndex: mitigated ? AOI_GATE_MITIGATED_RISK_INDEX : AOI_GATE_RISK_INDEX,
    answerRaw: mitigated ? AOI_GATE_MITIGATED_ANSWER : aoiGateUnmitigatedAnswer(ddLastRun),
    answerLabel: mitigated ? AOI_GATE_ANSWER_LABELS.mitigato : normalizedReasons.join(' '),
  }

  const details = [...result.details, gateDetail]

  if (mitigated) {
    return riskResultFromDetails(details, NON_ACCETTABILE_DESCRIPTION)
  }

  return {
    details,
    overallRisk: Math.max(result.overallRisk, AOI_GATE_RISK_INDEX),
    outcome: 'non accettabile',
    outcomeDescription: isTendenza
      ? `Esito non accettabile per tendenza deforestazione: loss nell’ultimo anno Hansen disponibile (${HANSEN_LAST_LOSS_CALENDAR_YEAR}) con data di taglio successiva. Sono necessarie verifiche e/o mitigazione.`
      : 'Esito non accettabile per evidenza geospaziale nell’AOI (perdita rilevante dopo il 31/12/2020 e, se nota la data di taglio, con anno di loss dall’anno di taglio in poi). Sono necessarie verifiche e/o mitigazione.',
    expiryDate: null,
  }
}

export { RISK_THRESHOLD }
