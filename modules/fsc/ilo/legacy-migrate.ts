import { FSC_ILO_QUESTION_IDS } from '@/lib/fsc/ilo/question-ids'
import { mergeFscIloFormData } from '@/lib/fsc/ilo/schema.v1'
import type { TablesInsert } from '@/types/supabase'

/** Best-effort map legacy form_data keys → official question IDs (export_key match). */
const LEGACY_EXPORT_KEY_TO_QUESTION: Record<string, string> = {
  attestor_name: FSC_ILO_QUESTION_IDS.ATTESTOR_NAME,
  attestor_date: FSC_ILO_QUESTION_IDS.ATTESTOR_DATE,
  subcontractor_narrative: FSC_ILO_QUESTION_IDS.SUBCONTRACTOR_NARRATIVE,
}

export function buildLegacyMigrationPayloads(
  formData: Record<string, unknown>
): TablesInsert<'user_responses'>[] {
  const merged = mergeFscIloFormData(formData)
  const payloads: TablesInsert<'user_responses'>[] = []
  const now = new Date().toISOString()

  for (const [key, questionId] of Object.entries(LEGACY_EXPORT_KEY_TO_QUESTION)) {
    const val = merged[key]
    if (val && String(val).trim()) {
      payloads.push({
        question_id: questionId,
        answer_text: String(val),
        answer_json: null,
        updated_at: now,
      } as TablesInsert<'user_responses'>)
    }
  }

  return payloads
}

export function hasLegacyFormData(formData: Record<string, unknown> | null | undefined): boolean {
  const merged = mergeFscIloFormData(formData as Record<string, unknown> | null)
  return Object.values(merged).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
}
