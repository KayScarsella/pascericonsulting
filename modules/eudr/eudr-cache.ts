import { revalidateTag, unstable_cache, updateTag } from "next/cache"
import { createServiceRoleClient } from "@/utils/supabase/admin"
import { EUDR_TOOL_ID } from "@/lib/constants"
import type { Json } from "@/types/supabase"

export const EUDR_SECTIONS_TAG = "eudr-sections"
export const EUDR_SEARCH_ALL_TAG = "eudr-search:all"

export function eudrResponsesTag(sessionId: string) {
  return `eudr-responses:${sessionId}`
}

export function eudrSearchTag(userId: string) {
  return `eudr-search:${userId}`
}

/** Server Actions only — read-your-writes for one session's answers. */
export function touchEudrResponses(sessionId: string) {
  updateTag(eudrResponsesTag(sessionId))
}

/** Bust the caller's search list and the admin-wide list. */
export function touchEudrSearch(userId: string) {
  updateTag(eudrSearchTag(userId))
  updateTag(EUDR_SEARCH_ALL_TAG)
}

/**
 * Section/question catalog. Call from the action that writes `sections` or `questions`.
 * No such writer exists in this repo; the 1h revalidate is the safety net until one does.
 */
export function touchEudrSectionCatalog() {
  revalidateTag(EUDR_SECTIONS_TAG, "max")
}

const SECTION_SELECT =
  "id, title, order_index, group_name, logic_rules, render_mode, questions(id, section_id, text, order_index, type, config)" as const

const RESPONSE_SELECT = "question_id, answer_text, answer_json, file_path" as const

export type EudrCachedQuestion = {
  id: string
  section_id: string
  text: string
  order_index: number | null
  type: string
  config: Json | null
}

export type EudrCachedSection = {
  id: string
  title: string
  order_index: number | null
  group_name: string | null
  logic_rules: Json | null
  render_mode: string | null
  questions: EudrCachedQuestion[]
}

export type EudrCachedResponse = {
  question_id: string
  answer_text: string | null
  answer_json: Json | null
  file_path: string | null
}

async function loadEudrSections(groupsKey: string): Promise<EudrCachedSection[]> {
  const groups = groupsKey.split("\n").filter(Boolean)
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("sections")
    .select(SECTION_SELECT)
    .eq("tool_id", EUDR_TOOL_ID)
    .in("group_name", groups)
    .order("order_index", { ascending: true })
    .order("order_index", { foreignTable: "questions", ascending: true })

  if (error) throw error

  return (data ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    order_index: section.order_index,
    group_name: section.group_name,
    logic_rules: section.logic_rules,
    render_mode: section.render_mode,
    questions: (section.questions ?? []).map((question) => ({
      id: question.id,
      section_id: question.section_id,
      text: question.text,
      order_index: question.order_index,
      type: question.type,
      config: question.config,
    })),
  }))
}

export function getCachedEudrSections(groups: readonly string[]) {
  const groupsKey = groups.join("\n")
  return unstable_cache(() => loadEudrSections(groupsKey), ["eudr-sections", groupsKey], {
    tags: [EUDR_SECTIONS_TAG],
    revalidate: 3600,
  })()
}

async function loadEudrSessionResponses(sessionId: string): Promise<EudrCachedResponse[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("user_responses")
    .select(RESPONSE_SELECT)
    .eq("session_id", sessionId)

  if (error) throw error
  return data ?? []
}

export function getCachedEudrSessionResponses(sessionId: string) {
  return unstable_cache(
    () => loadEudrSessionResponses(sessionId),
    ["eudr-responses", sessionId],
    { tags: [eudrResponsesTag(sessionId)], revalidate: 60 * 60 * 24 }
  )()
}
