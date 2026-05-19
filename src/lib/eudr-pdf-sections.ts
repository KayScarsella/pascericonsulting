import { cache } from "react"
import { createClient } from "@/utils/supabase/server"
import { EUDR_TOOL_ID } from "@/lib/constants"
import type { QuestionConfig } from "@/types/questions"

export type EudrPdfQuestionRow = {
  id: string
  text: string
  order_index: number | null
  type: string
  config: QuestionConfig | null
}

export type EudrPdfSectionRow = {
  id: string
  title: string
  order_index: number | null
  group_name: string | null
  questions: EudrPdfQuestionRow[] | null
}

const EXCLUDED_SECTION_ID = "a3df1e07-a678-49d2-9a4d-f134fba3498c"

/** Per-request dedup (RLS via session cookies). Cross-request cache richiederebbe service role. */
export const getEudrPdfSections = cache(async (): Promise<EudrPdfSectionRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sections")
    .select("id, title, order_index, group_name, questions(id, text, order_index, type, config)")
    .eq("tool_id", EUDR_TOOL_ID)
    .in("group_name", ["Analisi Rischio", "Valutazione", "Valutazione Finale"])
    .order("order_index", { ascending: true })
    .order("order_index", { foreignTable: "questions", ascending: true })

  if (error) {
    console.error("Errore caricamento sections PDF EUDR:", error)
    return []
  }

  return ((data || []) as EudrPdfSectionRow[]).filter((s) => s.id !== EXCLUDED_SECTION_ID)
})
