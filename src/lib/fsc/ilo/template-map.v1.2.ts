import type { Tables } from '@/types/supabase'

const YES_NO_LABELS: Record<string, string> = {
  si: 'Sì',
  no: 'No',
  yes: 'Sì',
}

type QuestionExportRow = Pick<Tables<'questions'>, 'id' | 'type' | 'config'>

type ResponseRow = Pick<
  Tables<'user_responses'>,
  'question_id' | 'answer_text' | 'answer_json'
>

function formatSelectValue(raw: string, config: Record<string, unknown>): string {
  const options = config.options as { label: string; value: string }[] | undefined
  if (!options) return raw
  const opt = options.find((o) => o.value === raw)
  return opt?.label ?? raw
}

function formatMultiSelectValue(raw: string, config: Record<string, unknown>): string {
  if (!raw.trim()) return ''
  const options = config.options as { label: string; value: string }[] | undefined
  const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
  if (!options) return values.join(', ')
  return values
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .join(', ')
}

function formatYesNo(raw: string): string {
  return YES_NO_LABELS[raw.toLowerCase()] ?? raw
}

export function responsesToExportContext(
  questions: QuestionExportRow[],
  responses: ResponseRow[],
  referenceYear: number
): Record<string, string> {
  const ctx: Record<string, string> = { reference_year: String(referenceYear) }
  const responseByQuestion = new Map(responses.map((r) => [r.question_id, r]))

  for (const q of questions) {
    const config = (q.config ?? {}) as Record<string, unknown>
    const exportKey = typeof config.export_key === 'string' ? config.export_key : null
    if (!exportKey) continue

    const row = responseByQuestion.get(q.id)
    if (!row) {
      ctx[exportKey] = ''
      continue
    }

    if (q.type === 'year_values' && row.answer_json && typeof row.answer_json === 'object') {
      const obj = row.answer_json as Record<string, unknown>
      for (const [cellKey, cellVal] of Object.entries(obj)) {
        if (cellVal !== null && cellVal !== undefined && String(cellVal).trim() !== '') {
          ctx[cellKey] = String(cellVal)
        }
      }
      continue
    }

    const text = row.answer_text ?? ''
    if (q.type === 'select' && config.is_multi === true) {
      ctx[exportKey] = formatMultiSelectValue(text, config)
    } else if (q.type === 'select') {
      ctx[exportKey] = formatYesNo(formatSelectValue(text, config))
    } else if (q.type === 'number') {
      ctx[exportKey] = text
    } else {
      ctx[exportKey] = text
    }
  }

  return ctx
}

export const FSC_ILO_OFFICIAL_TEMPLATE_PATH = 'public/fsc/ilo/template_it_coc_v1.2_tagged.docx'
export const FSC_ILO_VIRGIN_TEMPLATE_PATH = 'public/fsc/ilo/template_it_coc_v1.2.docx'
