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

  if (exceptionData?.isBlocked && exceptionData.blockVariant === "success") {
    const metadata: SessionMetadata = {
      is_blocked: true,
      block_reason: exceptionData.blockReason,
      block_variant: "success",
    }
    await completeSessionAsExempt(supabase, sessionId, metadata)
    return { redirectUrl: searchPath }
  }

  if (exceptionData?.isBlocked && exceptionData.blockVariant === "warning") {
    const metadata: SessionMetadata = {
      is_blocked: false,
      block_reason: exceptionData.blockReason,
      block_variant: "warning",
    }
    await supabase
      .from("assessment_sessions")
      .update({ metadata: metadata as unknown as Json })
      .eq("id", sessionId)
  }

  return { redirectUrl: `${evaluationBasePath}?session_id=${sessionId}` }
}

export async function processPrimaFaseTimber(
  sessionId: string,
  exceptionData?: PrimaFaseException
): Promise<{ redirectUrl?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const result = await runPrimaFase(
      supabase,
      TIMBER_TOOL_ID,
      sessionId,
      exceptionData,
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
  } catch (e) {
    return { error: "Errore durante il calcolo del rischio" };
  }
}

// ── EUDR: CONCLUSIONE ANALISI FINALE (calcolo rischio + metadata come timber) ─
export async function finalizeEudrAnalisi(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const supabase = await createClient()

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    const { data: sessionRow } = await supabase
      .from("assessment_sessions")
      .select("parent_session_id, metadata")
      .eq("id", sessionId)
      .single()

    const answersMap: Record<string, string | null> = {}
    if (sessionRow?.parent_session_id) {
      const { data: parentResponses } = await supabase
        .from("user_responses")
        .select("question_id, answer_text")
        .eq("session_id", sessionRow.parent_session_id)
      parentResponses?.forEach((r) => {
        answersMap[r.question_id] = r.answer_text
      })
    }
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
  } catch (e) {
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