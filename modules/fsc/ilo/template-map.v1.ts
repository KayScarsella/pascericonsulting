import { FSC_ILO_ALL_FIELDS, FSC_ILO_SECTIONS_V1 } from '@/lib/fsc/ilo/schema.v1'

/** Placeholder docxtemplater: stesso id del campo schema (es. {org_name}). */
export function getFscIloTemplatePlaceholders(): string[] {
  return [
    'reference_year',
    ...FSC_ILO_ALL_FIELDS.map((f) => f.id),
    ...FSC_ILO_SECTIONS_V1.map((s) => `section_${s.id}_title`),
  ]
}

export function formDataToTemplateContext(
  formData: Record<string, string>,
  referenceYear: number
): Record<string, string> {
  const ctx: Record<string, string> = { reference_year: String(referenceYear) }

  for (const field of FSC_ILO_ALL_FIELDS) {
    const raw = formData[field.id] ?? ''
    if (field.type === 'select' && field.options) {
      const opt = field.options.find((o) => o.value === raw)
      ctx[field.id] = opt?.label ?? raw
    } else {
      ctx[field.id] = raw
    }
  }

  for (const section of FSC_ILO_SECTIONS_V1) {
    ctx[`section_${section.id}_title`] = section.title
  }

  return ctx
}

/** Guida per admin: tag da inserire nel modello Word ufficiale FSC Italia. */
export const FSC_ILO_PLACEHOLDER_GUIDE = FSC_ILO_ALL_FIELDS.map(
  (f) => `{${f.id}} — ${f.label}`
)
