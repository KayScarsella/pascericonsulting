import type { SupabaseClient } from "@supabase/supabase-js"
import { EUDR_TOOL_ID } from "@/lib/constants"
import type { Database, Json, TablesInsert } from "@/types/supabase"
import type { SessionMetadata } from "@/types/session"
import {
  EUDR_PREFILL_DERIVED_QUESTION_IDS,
  EUDR_PREFILL_DERIVED_QUESTION_ID_SET,
  EUDR_PREFILL_VERSION,
  resolveEudrFaoQuestionId,
} from "@/lib/eudr-question-ids"
import { upsertUserResponses } from "@/actions/workflows/shared"

type UserResponseRow = Pick<
  Database["public"]["Tables"]["user_responses"]["Row"],
  "question_id" | "answer_text" | "answer_json" | "file_path"
>

type PrefillInput = {
  userId: string
  finalSessionId: string
  existingChildRows: UserResponseRow[]
  parentRows: UserResponseRow[]
  derivedRows: Array<{ question_id: string; answer_text: string }>
}

function isNonEmptyResponse(row: UserResponseRow | null | undefined): boolean {
  if (!row) return false
  if (row.answer_text != null && String(row.answer_text).trim() !== "") return true
  if (row.answer_json != null) {
    if (Array.isArray(row.answer_json)) return row.answer_json.length > 0
    if (typeof row.answer_json === "object") return Object.keys(row.answer_json as object).length > 0
  }
  return Boolean(row.file_path)
}

function toNumeric(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : null
}

export async function materializeEudrFinalPrefillForParent(
  supabase: SupabaseClient<Database>,
  userId: string,
  parentSessionId: string,
  reason: string
): Promise<void> {
  const { data: children } = await supabase
    .from("assessment_sessions")
    .select("id")
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "analisi_finale")
    .eq("parent_session_id", parentSessionId)

  for (const child of children || []) {
    await materializeEudrFinalPrefillForSession(supabase, userId, child.id, reason)
  }
}

export async function materializeEudrFinalPrefillForSession(
  supabase: SupabaseClient<Database>,
  userId: string,
  finalSessionId: string,
  reason: string
): Promise<{ rowsWritten: number }> {
  const { data: sessionRow } = await supabase
    .from("assessment_sessions")
    .select("id, parent_session_id, metadata")
    .eq("id", finalSessionId)
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "analisi_finale")
    .maybeSingle()

  if (!sessionRow) return { rowsWritten: 0 }

  const metadata = (sessionRow.metadata as SessionMetadata | null) ?? null
  const parentSessionId = sessionRow.parent_session_id
  const countryId = metadata?.country ?? null
  const specieId = metadata?.specie ?? null

  const [existingChildRespRes, parentRespRes, countryRes, qFaoId] = await Promise.all([
    supabase
      .from("user_responses")
      .select("question_id, answer_text, answer_json, file_path")
      .eq("session_id", finalSessionId),
    parentSessionId
      ? supabase
          .from("user_responses")
          .select("question_id, answer_text, answer_json, file_path")
          .eq("session_id", parentSessionId)
      : Promise.resolve({ data: [] as UserResponseRow[] | null }),
    countryId
      ? supabase
          .from("country")
          .select("id, conflicts, sanction, country_risk, fao")
          .eq("id", countryId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resolveEudrFaoQuestionId(supabase),
  ])

  const now = new Date().toISOString()

  const derivedQuestionRows: Array<{ question_id: string; answer_text: string }> = []
  if (countryId) {
    derivedQuestionRows.push({
      question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.PAESE_RACCOLTA,
      answer_text: countryId,
    })
  }
  if (specieId) {
    derivedQuestionRows.push({
      question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.SPECIE,
      answer_text: specieId,
    })
  }

  if (countryRes.data && countryId) {
    derivedQuestionRows.push(
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CONFLITTI,
        answer_text: countryRes.data.conflicts ? "si" : "no",
      },
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.SANZIONI,
        answer_text: countryRes.data.sanction ? "si" : "no",
      }
    )
    const risk = String(countryRes.data.country_risk ?? "").toUpperCase()
    if (risk === "RB" || risk === "RS" || risk === "RA") {
      derivedQuestionRows.push({
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.RISCHIO_PAESE,
        answer_text: risk,
      })
    }
    const fao = toNumeric(countryRes.data.fao)
    if (qFaoId && fao != null) {
      derivedQuestionRows.push({
        question_id: qFaoId,
        answer_text: String(fao),
      })
    }
  }

  const rowsToUpsert = buildEudrPrefillRows({
    userId,
    finalSessionId,
    existingChildRows: existingChildRespRes.data || [],
    parentRows: parentRespRes.data || [],
    derivedRows: derivedQuestionRows,
  }).map((row) => ({ ...row, updated_at: now }))

  await upsertUserResponses(supabase, rowsToUpsert)

  const nextMetadata: SessionMetadata = {
    ...(metadata || {}),
    eudr_prefill_version: EUDR_PREFILL_VERSION,
    eudr_prefill_materialized_at: now,
    eudr_prefill_source_parent_session_id: parentSessionId ?? undefined,
    eudr_prefill_rows_written: rowsToUpsert.length,
    eudr_prefill_reason: reason,
  }

  await supabase
    .from("assessment_sessions")
    .update({ metadata: nextMetadata as unknown as Json })
    .eq("id", finalSessionId)

  console.info("[EUDR_PREFILL_MATERIALIZED]", {
    finalSessionId,
    parentSessionId,
    rowsWritten: rowsToUpsert.length,
    reason,
    version: EUDR_PREFILL_VERSION,
  })

  return { rowsWritten: rowsToUpsert.length }
}

export function buildEudrPrefillRows(input: PrefillInput): TablesInsert<"user_responses">[] {
  const existingByQuestion = new Map(input.existingChildRows.map((r) => [r.question_id, r]))
  const rowsToUpsert: TablesInsert<"user_responses">[] = []

  for (const row of input.parentRows) {
    if (!isNonEmptyResponse(row)) continue
    if (EUDR_PREFILL_DERIVED_QUESTION_ID_SET.has(row.question_id)) continue
    const existing = existingByQuestion.get(row.question_id)
    if (isNonEmptyResponse(existing)) continue
    rowsToUpsert.push({
      user_id: input.userId,
      tool_id: EUDR_TOOL_ID,
      session_id: input.finalSessionId,
      question_id: row.question_id,
      answer_text: row.answer_text,
      answer_json: row.answer_json as Json | null,
      file_path: row.file_path,
    })
  }

  for (const derived of input.derivedRows) {
    const existing = existingByQuestion.get(derived.question_id)
    if (isNonEmptyResponse(existing)) continue
    rowsToUpsert.push({
      user_id: input.userId,
      tool_id: EUDR_TOOL_ID,
      session_id: input.finalSessionId,
      question_id: derived.question_id,
      answer_text: derived.answer_text,
    })
  }

  rowsToUpsert.sort((a, b) => String(a.question_id).localeCompare(String(b.question_id)))
  return rowsToUpsert
}
