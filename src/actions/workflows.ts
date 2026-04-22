'use server'

import type { SupabaseClient } from "@supabase/supabase-js"
import { Database, TablesInsert, Json } from "@/types/supabase"
import { createClient } from "@/utils/supabase/server"
import { TIMBER_TOOL_ID, EUDR_TOOL_ID } from "@/lib/constants"
import { SessionMetadata } from "@/types/session" // 🛠️ Importata la nostra nuova interfaccia
import { calculateRisk, SCORED_QUESTIONS, getCanonicalValueForRiskQuestion } from "@/lib/risk-calculator"
import {
  calculateEudrRisk,
  EUDR_SCORED_QUESTIONS,
  getCanonicalValueForEudrRiskQuestion,
} from "@/lib/eudr-risk-calculator"
import {
  applyAoiGateToEudrRiskResult,
  type DdLastRunSnapshot,
} from "@/features/eudr-due-diligence/aoiRiskGate"
import { validateSessionAccess } from "@/actions/questions"
import { completeSessionAsExempt, upsertUserResponses } from "@/actions/workflows/shared"
import {
  processEudrValutazione as runProcessEudrValutazione,
} from "@/actions/workflows/eudr-valutazione"
import {
  processTimberValutazione as runProcessTimberValutazione,
} from "@/actions/workflows/timber-valutazione"
import { isYesLikeAnswer } from "@/lib/eudr-question-ids"
import {
  materializeEudrFinalPrefillForParent,
  materializeEudrFinalPrefillForSession,
} from "@/actions/workflows/eudr-prefill"

/** Re-export via async wrapper (Next "use server" allows only async function exports). */
export async function processEudrValutazione(
  sessionId: string,
  exceptionData?: {
    isBlocked: boolean
    blockReason: string
    blockVariant: "success" | "warning" | "error"
  }
) {
  return runProcessEudrValutazione(sessionId, exceptionData)
}

export async function processTimberValutazione(
  sessionId: string,
  exceptionData?: {
    isBlocked: boolean
    blockReason: string
    blockVariant: "success" | "warning" | "error"
  }
) {
  return runProcessTimberValutazione(sessionId, exceptionData)
}

type PrimaFaseException = {
  isBlocked: boolean
  blockReason: string
  blockVariant: "success" | "warning" | "error"
}

async function computeStep1Signature(
  supabase: SupabaseClient<Database>,
  toolId: string,
  sessionId: string
): Promise<string> {
  const { data: riskSections } = await supabase
    .from("sections")
    .select("id")
    .eq("tool_id", toolId)
    .eq("group_name", "Analisi Rischio")

  const sectionIds = (riskSections || []).map((s) => s.id)
  if (sectionIds.length === 0) return "[]"

  const { data: riskQuestions } = await supabase
    .from("questions")
    .select("id")
    .in("section_id", sectionIds)

  const riskQuestionIds = (riskQuestions || []).map((q) => q.id)
  if (riskQuestionIds.length === 0) return "[]"

  const { data: responses } = await supabase
    .from("user_responses")
    .select("question_id, answer_text, answer_json, file_path")
    .eq("session_id", sessionId)
    .in("question_id", riskQuestionIds)

  const normalized = (responses || [])
    .map((row) => ({
      question_id: row.question_id,
      answer_text: row.answer_text ?? null,
      answer_json: row.answer_json ?? null,
      file_path: row.file_path ?? null,
    }))
    .sort((a, b) => a.question_id.localeCompare(b.question_id))

  return JSON.stringify(normalized)
}

async function resetDownstreamAfterStep1Change(
  supabase: SupabaseClient<Database>,
  toolId: string,
  sessionId: string
): Promise<void> {
  const { data: childRows } = await supabase
    .from("assessment_sessions")
    .select("id")
    .eq("parent_session_id", sessionId)
    .eq("session_type", "analisi_finale")
    .eq("tool_id", toolId)

  const childIds = (childRows || []).map((c) => c.id)
  if (childIds.length > 0) {
    await supabase
      .from("assessment_sessions")
      .delete()
      .in("id", childIds)
  }

  const { data: nonRiskSections } = await supabase
    .from("sections")
    .select("id")
    .eq("tool_id", toolId)
    .neq("group_name", "Analisi Rischio")

  const nonRiskSectionIds = (nonRiskSections || []).map((s) => s.id)
  if (nonRiskSectionIds.length > 0) {
    const { data: nonRiskQuestions } = await supabase
      .from("questions")
      .select("id")
      .in("section_id", nonRiskSectionIds)

    const nonRiskQuestionIds = (nonRiskQuestions || []).map((q) => q.id)
    if (nonRiskQuestionIds.length > 0) {
      await supabase
        .from("user_responses")
        .delete()
        .eq("session_id", sessionId)
        .in("question_id", nonRiskQuestionIds)
    }
  }
}

/** Shared prima-fase logic: success → complete + search; warning → metadata only; else → evaluation. */
async function runPrimaFase(
  supabase: SupabaseClient<Database>,
  toolId: string,
  sessionId: string,
  exceptionData: PrimaFaseException | undefined,
  searchPath: string,
  evaluationBasePath: string
): Promise<{ redirectUrl: string }> {
  await validateSessionAccess(supabase, toolId, sessionId)

  const { data: baseSession } = await supabase
    .from("assessment_sessions")
    .select("metadata, status")
    .eq("id", sessionId)
    .single()

  const oldMeta = (baseSession?.metadata as SessionMetadata | null) ?? {}
  const step1Signature = await computeStep1Signature(supabase, toolId, sessionId)
  const step1Changed = Boolean(oldMeta.step1_signature && oldMeta.step1_signature !== step1Signature)
  const hadDownstreamState = Boolean(oldMeta.step2_saved_at)

  const { count: childCount } = await supabase
    .from("assessment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("parent_session_id", sessionId)
    .eq("session_type", "analisi_finale")
    .eq("tool_id", toolId)

  if (step1Changed && (hadDownstreamState || (childCount ?? 0) > 0)) {
    await resetDownstreamAfterStep1Change(supabase, toolId, sessionId)
  }

  const step1MetaBase: SessionMetadata = {
    ...oldMeta,
    step1_completed_at: new Date().toISOString(),
    step1_signature: step1Signature,
    step2_saved_at: undefined,
    resume_step: "evaluation",
  }

  if (exceptionData?.isBlocked && exceptionData.blockVariant === "success") {
    const metadata: SessionMetadata = {
      ...step1MetaBase,
      is_blocked: true,
      block_reason: exceptionData.blockReason,
      block_variant: "success",
      resume_step: "risk-analysis",
    }
    await completeSessionAsExempt(supabase, sessionId, metadata)
    return { redirectUrl: searchPath }
  }

  const metadata: SessionMetadata = {
    ...step1MetaBase,
    is_blocked: false,
    ...(exceptionData?.isBlocked && exceptionData.blockVariant === "warning"
      ? {
      block_reason: exceptionData.blockReason,
      block_variant: "warning",
      }
      : {
        block_reason: undefined,
        block_variant: undefined,
      }),
  }

  await supabase
    .from("assessment_sessions")
    .update({
      status: "in_progress",
      final_outcome: null,
      metadata: metadata as unknown as Json,
    })
    .eq("id", sessionId)

  return { redirectUrl: `${evaluationBasePath}?session_id=${sessionId}` }
}

async function hasTimberFlegtOrCitesYes(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<boolean> {
  const { data: timberSections } = await supabase
    .from("sections")
    .select("id")
    .eq("tool_id", TIMBER_TOOL_ID)

  const timberSectionIds = (timberSections || []).map((section) => section.id)
  if (timberSectionIds.length === 0) return false

  const { data: flegtCitesQuestions } = await supabase
    .from("questions")
    .select("id")
    .in("section_id", timberSectionIds)
    .or("text.ilike.%flegt%,text.ilike.%cites%")

  const flegtCitesQuestionIds = (flegtCitesQuestions || []).map((question) => question.id)
  if (flegtCitesQuestionIds.length === 0) return false

  const { data: responses } = await supabase
    .from("user_responses")
    .select("answer_text")
    .eq("session_id", sessionId)
    .in("question_id", flegtCitesQuestionIds)

  return (responses || []).some((response) => isYesLikeAnswer(response.answer_text))
}

export async function processPrimaFaseTimber(
  sessionId: string,
  exceptionData?: PrimaFaseException
): Promise<{ redirectUrl?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const hasFlegtOrCites = await hasTimberFlegtOrCitesYes(supabase, sessionId)
    const forcedException: PrimaFaseException | undefined = hasFlegtOrCites
      ? {
          isBlocked: true,
          blockReason: "Verifica non soggetta: presenza di licenza FLEGT/CITES nel flusso Timber.",
          blockVariant: "success",
        }
      : undefined
    const result = await runPrimaFase(
      supabase,
      TIMBER_TOOL_ID,
      sessionId,
      forcedException ?? exceptionData,
      "/timberRegulation/search",
      "/timberRegulation/evaluation"
    )
    return result
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" }
  }
}

export async function processPrimaFaseEUDR(
  sessionId: string,
  exceptionData?: PrimaFaseException
): Promise<{ redirectUrl?: string; error?: string }> {
  try {
    const supabase = await createClient()
    return await runPrimaFase(
      supabase,
      EUDR_TOOL_ID,
      sessionId,
      exceptionData,
      "/EUDR/search",
      "/EUDR/evaluation"
    )
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" }
  }
}

/**
 * Backfill helper for in-progress EUDR final-analysis sessions under a root session.
 * Safe to run repeatedly (idempotent).
 */
export async function backfillEudrFinalPrefillForRoot(
  rootSessionId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  try {
    const { sessionOwnerId } = await validateSessionAccess(supabase, EUDR_TOOL_ID, rootSessionId)
    await materializeEudrFinalPrefillForParent(
      supabase,
      sessionOwnerId,
      rootSessionId,
      "manual-backfill"
    )
    return { ok: true }
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Errore durante il backfill prefill EUDR",
    }
  }
}

// ── 2. CONCLUSIONE ANALISI FINALE (CALCOLO RISCHIO CENTRALIZZATO) ─────────────
export async function finalizeTimberAnalisi(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const supabase = await createClient()

  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
    const { data: responses } = await supabase
      .from('user_responses')
      .select('question_id, answer_text')
      .eq('session_id', sessionId);

    const answersMap: Record<string, string | null> = {};
    responses?.forEach(r => { answersMap[r.question_id] = r.answer_text });

    const riskResult = calculateRisk(answersMap);

    const { data: sessionData } = await supabase.from('assessment_sessions').select('metadata').eq('id', sessionId).single();
    
    const oldMeta = (sessionData?.metadata as unknown as SessionMetadata) || {};

    const updatedMeta: SessionMetadata = {
      ...oldMeta,
      risk_score: riskResult.overallRisk,
      expiry_date: riskResult.expiryDate || undefined
    };

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      final_outcome: riskResult.outcome === 'accettabile' ? 'Rischio Trascurabile' : 'Rischio Non Trascurabile',
      metadata: updatedMeta as unknown as Json 
    }).eq('id', sessionId);

    return { redirectUrl: `/timberRegulation/risultato?session_id=${sessionId}` };
  } catch {
    return { error: "Errore durante il calcolo del rischio" };
  }
}

// ── EUDR: CONCLUSIONE ANALISI FINALE (calcolo rischio + metadata come timber) ─
export async function finalizeEudrAnalisi(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const supabase = await createClient()

  try {
    const { sessionOwnerId } = await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    const { data: sessionRow } = await supabase
      .from("assessment_sessions")
      .select("parent_session_id, metadata")
      .eq("id", sessionId)
      .single()

    if (!sessionRow) {
      return { error: "Sessione EUDR non trovata" }
    }

    await materializeEudrFinalPrefillForSession(supabase, sessionOwnerId, sessionId, "finalize")

    const answersMap: Record<string, string | null> = {}
    const { data: childResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text")
      .eq("session_id", sessionId)
    childResponses?.forEach((r) => {
      answersMap[r.question_id] = r.answer_text
    })

    let riskResult = calculateEudrRisk(answersMap)
    const oldMeta = (sessionRow?.metadata as Record<string, unknown>) || {}
    const ddLastRun = oldMeta.dd_last_run as DdLastRunSnapshot | undefined
    riskResult = applyAoiGateToEudrRiskResult(riskResult, ddLastRun)

    const updatedMeta: Record<string, unknown> = {
      ...oldMeta,
      risk_score: riskResult.overallRisk,
      risk_details: riskResult.details.map((d) => ({
        shortLabel: d.shortLabel,
        riskIndex: d.riskIndex,
      })),
      expiry_date: riskResult.expiryDate || undefined,
      completed_at: new Date().toISOString(),
      ...(ddLastRun?.triggers_non_accettabile
        ? {
            aoi_gate_triggered: true,
            aoi_gate_reasons: ddLastRun.reasons,
          }
        : {
            aoi_gate_triggered: false,
            aoi_gate_reasons: [],
          }),
    }

    await supabase
      .from("assessment_sessions")
      .update({
        status: "completed",
        final_outcome:
          riskResult.outcome === "accettabile"
            ? "Rischio Trascurabile"
            : "Rischio Non Trascurabile",
        metadata: updatedMeta as Json,
      })
      .eq("id", sessionId)

    return { redirectUrl: `/EUDR/risultato?session_id=${sessionId}` }
  } catch {
    return { error: "Errore durante la conclusione dell'analisi finale EUDR" }
  }
}

// ── 3. SALVATAGGIO MITIGAZIONE E RICALCOLO AUTOMATICO ─────────────────────────
export type MitigationInput = {
  questionId: string
  newAnswer: string
  comment?: string | null
  filePath?: string | null
}

type MitigationNormalized = MitigationInput & { newAnswer: string }

/** Shared mitigation save: upsert responses, insert history, finalize analisi. */
async function saveMitigationCore(
  toolId: string,
  sessionId: string,
  mitigations: MitigationInput[],
  toCanonical: (questionId: string, answer: string) => string,
  scoredQuestionIds: Set<string>,
  finalize: (sid: string) => Promise<{ error?: string }>
): Promise<{ redirectUrl?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  const { sessionOwnerId } = await validateSessionAccess(supabase, toolId, sessionId)

  try {
    const questionIds = mitigations.map((m) => m.questionId)
    const { data: currentResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text")
      .eq("session_id", sessionId)
      .in("question_id", questionIds)

    const currentAnswersMap: Record<string, string | null> = {}
    currentResponses?.forEach((r) => {
      currentAnswersMap[r.question_id] = r.answer_text
    })

    const now = new Date().toISOString()
    const normalizedMitigations: MitigationNormalized[] = mitigations.map((m) => ({
      ...m,
      newAnswer: scoredQuestionIds.has(m.questionId)
        ? toCanonical(m.questionId, m.newAnswer)
        : m.newAnswer,
    }))

    const upsertPayloads: TablesInsert<"user_responses">[] = normalizedMitigations.map((m) => ({
      user_id: sessionOwnerId,
      tool_id: toolId,
      session_id: sessionId,
      question_id: m.questionId,
      answer_text: m.newAnswer,
      updated_at: now,
    }))

    await upsertUserResponses(supabase, upsertPayloads)

    const historyPayloads: TablesInsert<"mitigation_history">[] = normalizedMitigations.map((m) => ({
      session_id: sessionId,
      question_id: m.questionId,
      previous_answer: currentAnswersMap[m.questionId] ?? null,
      new_answer: m.newAnswer,
      mitigated_at: now,
      comment: m.comment ?? null,
      file_path: m.filePath ?? null,
    }))

    const { error: historyError } = await supabase
      .from("mitigation_history")
      .insert(historyPayloads)
    if (historyError) throw new Error(`mitigation_history: ${historyError.message}`)

    const finalizeResult = await finalize(sessionId)
    if (finalizeResult.error) throw new Error(`finalize: ${finalizeResult.error}`)

    const resultPath =
      toolId === EUDR_TOOL_ID
        ? `/EUDR/risultato?session_id=${sessionId}`
        : `/timberRegulation/risultato?session_id=${sessionId}`
    return { redirectUrl: resultPath }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore durante il salvataggio della mitigazione"
    return { error: message }
  }
}

export async function saveMitigation(
  sessionId: string,
  mitigations: MitigationInput[]
): Promise<{ redirectUrl?: string; error?: string }> {
  const scoredIds = new Set(SCORED_QUESTIONS.map((q) => q.id))
  return saveMitigationCore(
    TIMBER_TOOL_ID,
    sessionId,
    mitigations,
    getCanonicalValueForRiskQuestion,
    scoredIds,
    finalizeTimberAnalisi
  )
}

/** EUDR mitigazione: stesso flusso di saveMitigation ma tool_id e SCORED_QUESTIONS EUDR */
export async function saveEudrMitigation(
  sessionId: string,
  mitigations: MitigationInput[]
): Promise<{ redirectUrl?: string; error?: string }> {
  const scoredIds = new Set(EUDR_SCORED_QUESTIONS.map((q) => q.id))
  return saveMitigationCore(
    EUDR_TOOL_ID,
    sessionId,
    mitigations,
    getCanonicalValueForEudrRiskQuestion,
    scoredIds,
    finalizeEudrAnalisi
  )
}

/** Upload mitigation file for session; validates access for toolId. */
async function uploadMitigationFileForTool(
  formData: FormData,
  sessionId: string,
  questionId: string,
  toolId: string
): Promise<{ path?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  await validateSessionAccess(supabase, toolId, sessionId)

  const file = formData.get("file") as File
  if (!file) return { error: "File mancante" }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const storagePath = `${user.id}/mitigations/${sessionId}/${questionId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from("user-uploads").upload(storagePath, file)
  if (error) return { error: error.message }
  return { path: storagePath }
}

/** Upload a file for mitigation and return storage path. Only session owner or tool admin. */
export async function uploadMitigationFile(
  formData: FormData,
  sessionId: string,
  questionId: string
): Promise<{ path?: string; error?: string }> {
  return uploadMitigationFileForTool(formData, sessionId, questionId, TIMBER_TOOL_ID)
}

/** Upload mitigation file for EUDR session */
export async function uploadEudrMitigationFile(
  formData: FormData,
  sessionId: string,
  questionId: string
): Promise<{ path?: string; error?: string }> {
  return uploadMitigationFileForTool(formData, sessionId, questionId, EUDR_TOOL_ID)
}

/** Get signed download URL for a mitigation file. Only session owner or tool admin. */
export async function getMitigationFileDownloadUrl(
  sessionId: string,
  filePath: string
): Promise<{ signedUrl?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  // Session may be timber or EUDR analisi_finale
  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
  } catch {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)
  }
  if (!filePath.includes('/mitigations/')) return { error: "Percorso non valido" }

  const { data, error } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(filePath, 60, { download: true })

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}