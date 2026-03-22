/**
 * Shared workflow helpers (server-only usage; imported by server actions).
 * No 'use server' here — callers are server action modules.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, TablesInsert, Json } from "@/types/supabase"
import type { SessionMetadata } from "@/types/session"

export const USER_RESPONSES_CONFLICT = "session_id, question_id" as const

/** Minimal row shape for nome commerciale extraction (matches user_responses select). */
export type NomeCommercialeResponseRow = {
  question_id: string
  answer_text: string | null
  answer_json: Json | null
}

const DEFAULT_NOME = "Operazione Senza Nome"

/**
 * Extract display name from user_responses rows for the nome commerciale question.
 * Handles answer_text or answer_json.value / answer_json.text.
 */
export function extractNomeCommerciale(
  responses: NomeCommercialeResponseRow[] | null | undefined,
  nomeQuestionId: string,
  fallback: string = DEFAULT_NOME
): string {
  const nomeCommRes = responses?.find((r) => r.question_id === nomeQuestionId)
  let extractedName = nomeCommRes?.answer_text ?? undefined

  if (
    !extractedName &&
    typeof nomeCommRes?.answer_json === "object" &&
    nomeCommRes.answer_json !== null &&
    !Array.isArray(nomeCommRes.answer_json)
  ) {
    const jsonObj = nomeCommRes.answer_json as Record<string, Json>
    extractedName = String(jsonObj.value ?? jsonObj.text ?? "")
  }
  return (extractedName && extractedName.trim()) || fallback
}

/** Upsert user_responses; no-op if empty. Throws with prefix user_responses: on failure. */
export async function upsertUserResponses(
  supabase: SupabaseClient<Database>,
  rows: TablesInsert<"user_responses">[]
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from("user_responses")
    .upsert(rows, { onConflict: USER_RESPONSES_CONFLICT })
  if (error) throw new Error(`user_responses: ${error.message}`)
}

/** Mark session completed as Esente / Non Soggetto with given metadata. */
export async function completeSessionAsExempt(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  metadata: SessionMetadata
): Promise<void> {
  await supabase
    .from("assessment_sessions")
    .update({
      status: "completed",
      final_outcome: "Esente / Non Soggetto",
      metadata: metadata as unknown as Json,
    })
    .eq("id", sessionId)
}
