import { unstable_cache } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import type { QuestionConfig } from "@/types/questions"

export type TimberPdfQuestionRow = {
  id: string
  text: string
  order_index: number | null
  type: string
  config: QuestionConfig | null
}

export type TimberPdfSectionRow = {
  id: string
  title: string
  order_index: number | null
  group_name: string | null
  questions: TimberPdfQuestionRow[] | null
}

const HIDDEN_SECTION_TITLE = "DATI RELATIVI ALLE COMPONENTI DEL PRODOTTO (SPECIE E PAESI)"

async function loadTimberPdfSectionsUncached(): Promise<TimberPdfSectionRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("sections")
    .select("id, title, order_index, group_name, questions(id, text, order_index, type, config)")
    .eq("tool_id", TIMBER_TOOL_ID)
    .in("group_name", ["Analisi Rischio", "Valutazione", "Valutazione Finale"])
    .order("order_index", { ascending: true })
    .order("order_index", { foreignTable: "questions", ascending: true })

  if (error) {
    console.error("Errore caricamento sections PDF Timber:", error)
    return []
  }

  return ((data || []) as TimberPdfSectionRow[]).filter(
    (s) => !s.title.includes(HIDDEN_SECTION_TITLE)
  )
}

/** Master sections/questions change rarely — cache 5 min per deploy. */
export const getTimberPdfSections = unstable_cache(
  loadTimberPdfSectionsUncached,
  ["timber-pdf-sections"],
  { revalidate: 300 }
)
