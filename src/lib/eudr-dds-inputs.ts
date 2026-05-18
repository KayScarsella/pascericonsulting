import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/supabase'
import { EUDR_TOOL_ID } from '@/lib/constants'
import {
  EUDR_SPEC_PAESE_GRID_QUESTION_ID,
  resolveEudrImportQuestionId,
  resolveEudrNumPaesiQuestionId,
} from '@/lib/eudr-question-ids'
import {
  buildEudrOutcomeDescription,
  determineEudrDdsType,
  type EudrDdsDeterminationInput,
} from '@/lib/eudr-dds-determination'
import type { EudrDdsType } from '@/types/session'
import type { RiskCalculationResult } from '@/lib/eudr-risk-calculator'
import type { DdLastRunSnapshot } from '@/features/eudr-due-diligence/aoiRiskGate'

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function distinctPaeseIdsFromGrid(answerJson: unknown): string[] {
  if (!Array.isArray(answerJson)) return []
  const ids = new Set<string>()
  for (const item of answerJson) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
    const paesiStr = String((item as Record<string, Json>).paesi_id || '')
    paesiStr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id))
  }
  return [...ids]
}

/**
 * Collect DDS inputs from the root/parent verifica session (import + countries grid).
 */
export async function collectEudrDdsInputs(
  supabase: SupabaseClient<Database>,
  parentSessionId: string,
  opts: { isRiskTrascurabile: boolean; aoiGateTriggered?: boolean }
): Promise<Pick<
  EudrDdsDeterminationInput,
  'nonEuCompanyCount' | 'countryCount' | 'countryRiskCodes' | 'isRiskTrascurabile' | 'aoiGateTriggered'
>> {
  const [importQId, numPaesiQId] = await Promise.all([
    resolveEudrImportQuestionId(supabase),
    resolveEudrNumPaesiQuestionId(supabase),
  ])

  const questionIds = [
    EUDR_SPEC_PAESE_GRID_QUESTION_ID,
    ...(importQId ? [importQId] : []),
    ...(numPaesiQId ? [numPaesiQId] : []),
  ]

  const { data: responses } = await supabase
    .from('user_responses')
    .select('question_id, answer_text, answer_json')
    .eq('session_id', parentSessionId)
    .in('question_id', questionIds)

  const gridRow = responses?.find((r) => r.question_id === EUDR_SPEC_PAESE_GRID_QUESTION_ID)
  const gridPaeseIds = distinctPaeseIdsFromGrid(gridRow?.answer_json)

  let countryCount = gridPaeseIds.length
  if (numPaesiQId) {
    const numRow = responses?.find((r) => r.question_id === numPaesiQId)
    const parsed = parsePositiveInt(numRow?.answer_text)
    if (parsed != null) countryCount = Math.max(countryCount, parsed)
  }

  let nonEuCompanyCount = 0
  if (importQId) {
    const importRow = responses?.find((r) => r.question_id === importQId)
    const parsed = parsePositiveInt(importRow?.answer_text)
    if (parsed != null) nonEuCompanyCount = parsed
  }

  let countryRiskCodes: string[] = []
  if (gridPaeseIds.length > 0) {
    const { data: countries } = await supabase
      .from('country')
      .select('id, country_risk')
      .in('id', gridPaeseIds)

    countryRiskCodes = (countries || [])
      .map((c) => (c.country_risk ? String(c.country_risk) : ''))
      .filter(Boolean)
  }

  return {
    nonEuCompanyCount,
    countryCount,
    countryRiskCodes,
    isRiskTrascurabile: opts.isRiskTrascurabile,
    aoiGateTriggered: opts.aoiGateTriggered,
  }
}

/** Resolve parent session id for an analisi_finale child (falls back to self). */
export async function resolveEudrParentSessionId(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  parentSessionId: string | null
): Promise<string> {
  if (parentSessionId) return parentSessionId
  const { data } = await supabase
    .from('assessment_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('tool_id', EUDR_TOOL_ID)
    .maybeSingle()
  return data?.id ?? sessionId
}

export type EudrDdsOutcome = {
  ddsType: EudrDdsType
  outcomeDescription: string
  ddsInputs: Pick<
    EudrDdsDeterminationInput,
    'nonEuCompanyCount' | 'countryCount' | 'countryRiskCodes'
  >
}

export async function computeEudrDdsOutcome(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  parentSessionId: string | null,
  riskResult: RiskCalculationResult,
  ddLastRun?: DdLastRunSnapshot
): Promise<EudrDdsOutcome> {
  const isRiskTrascurabile = riskResult.outcome === 'accettabile'
  const aoiGateTriggered = Boolean(ddLastRun?.triggers_non_accettabile)
  const rootId = await resolveEudrParentSessionId(supabase, sessionId, parentSessionId)
  const ddsInputs = await collectEudrDdsInputs(supabase, rootId, {
    isRiskTrascurabile,
    aoiGateTriggered,
  })
  const ddsType = determineEudrDdsType(ddsInputs)
  const outcomeDescription = buildEudrOutcomeDescription(
    riskResult.outcomeDescription,
    ddsType,
    isRiskTrascurabile
  )
  return {
    ddsType,
    outcomeDescription,
    ddsInputs: {
      nonEuCompanyCount: ddsInputs.nonEuCompanyCount,
      countryCount: ddsInputs.countryCount,
      countryRiskCodes: ddsInputs.countryRiskCodes,
    },
  }
}
