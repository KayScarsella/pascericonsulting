import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { EUDR_TOOL_ID } from "@/lib/constants"

/** FLEGT — same id as `questions` row in Supabase EUDR tool */
export const EUDR_Q_FLEGT = "881c4918-ca7f-44ad-9c52-530de70b8add"

/** CITES — geolocation trigger paired with FLEGT in Valutazione Finale */
export const EUDR_Q_CITES = "6e0896e6-0be7-4286-bd7a-3fba6e34b83f"

/** Repeater Specie–Paesi (Valutazione / configurazione analisi finali) */
export const EUDR_SPEC_PAESE_GRID_QUESTION_ID = "03dd3221-ba2f-4c83-9148-8fd06f389b0a"

/** Sezione G — Valutazione Finale (affidabilità / FLEGT–CITES override UI) */
export const EUDR_SECTION_G = "c4d9e2b7-8a61-4a3f-b72a-45157b0dfc3f"

/**
 * Optional stable id for the FAO Annex II % question. When set and present in DB, used directly.
 * Otherwise `resolveEudrFaoQuestionId` falls back to a text search on `questions.text`.
 */
export const EUDR_FAO_ANNEX_QUESTION_ID: string | null = null

export const EUDR_PREFILL_VERSION = 1 as const

export const EUDR_PREFILL_DERIVED_QUESTION_IDS = {
  PAESE_RACCOLTA: "d5e6f7a8-b9c0-4d1e-9f2a-3b4c5d6e7f54",
  SPECIE: "ce302e2d-e894-4cc1-bc8b-9b580e163e7f",
  RISCHIO_PAESE: "e8f9a0b1-c2d3-4e4f-8a9b-0c1d2e3f4a65",
  CONFLITTI: "f4a5b6c7-d8e9-4f0a-8b1c-2d3e4f5a6b21",
  SANZIONI: "d6e7f8a9-b0c1-4d2e-9f3a-4b5c6d7e8f70",
} as const

export const EUDR_PREFILL_DERIVED_QUESTION_ID_SET = new Set<string>(
  Object.values(EUDR_PREFILL_DERIVED_QUESTION_IDS)
)

/**
 * Server-side prefill precedence:
 * 1) user-authored child answer (non-empty) keeps priority
 * 2) server-derived answer for deterministic fields
 * 3) inherited parent answer as fallback
 */
export const EUDR_PREFILL_PRECEDENCE = {
  USER_CHILD: 3,
  SERVER_DERIVED: 2,
  PARENT_INHERITED: 1,
} as const

export function isYesLikeAnswer(v: unknown): boolean {
  if (v === true) return true
  if (v == null) return false
  const s = String(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.!?,;:]+$/g, "")
  return s === "si" || s === "yes" || s === "y" || s === "true" || s === "1"
}

export async function resolveEudrFaoQuestionId(
  supabase: SupabaseClient<Database>
): Promise<string | null> {
  if (EUDR_FAO_ANNEX_QUESTION_ID) {
    const { data } = await supabase
      .from("questions")
      .select("id, section_id")
      .eq("id", EUDR_FAO_ANNEX_QUESTION_ID)
      .maybeSingle()
    if (data?.id) {
      const { data: sec } = await supabase
        .from("sections")
        .select("id")
        .eq("id", data.section_id)
        .eq("tool_id", EUDR_TOOL_ID)
        .maybeSingle()
      if (sec?.id) return data.id
    }
  }
  const { data: faoRow } = await supabase
    .from("questions")
    .select("id, section_id")
    .ilike("text", "%FAO Naturally regenerating%")
    .limit(1)
    .maybeSingle()
  if (!faoRow?.id) return null
  const { data: sec } = await supabase
    .from("sections")
    .select("id")
    .eq("id", faoRow.section_id)
    .eq("tool_id", EUDR_TOOL_ID)
    .maybeSingle()
  return sec?.id ? faoRow.id : null
}
