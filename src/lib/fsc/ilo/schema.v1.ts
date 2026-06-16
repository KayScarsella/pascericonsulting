import { z } from 'zod'

export const FSC_ILO_SCHEMA_VERSION = 'it_coc_v1.2_official' as const
export const FSC_ILO_LEGACY_SCHEMA_VERSION = 'it_coc_v1.2' as const

export type FscIloFieldType = 'text' | 'textarea' | 'date' | 'select'

export type FscIloFieldDef = {
  id: string
  label: string
  type: FscIloFieldType
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  helpText?: string
  showWhen?: { fieldId: string; value: string }
}

export type FscIloSectionDef = {
  id: string
  title: string
  description?: string
  fields: FscIloFieldDef[]
}

const complianceOptions = [
  { value: 'yes', label: 'Sì, conforme' },
  { value: 'no', label: 'No, non conforme' },
  { value: 'partial', label: 'Parzialmente conforme' },
]

function clrFields(prefix: string, clauseLabel: string): FscIloFieldDef[] {
  return [
    {
      id: `${prefix}_compliance`,
      label: `${clauseLabel} — Conformità`,
      type: 'select',
      required: true,
      options: complianceOptions,
    },
    {
      id: `${prefix}_non_compliance`,
      label: 'Se non conforme: descrizione',
      type: 'textarea',
      showWhen: { fieldId: `${prefix}_compliance`, value: 'no' },
    },
    {
      id: `${prefix}_how_complies`,
      label: 'Come l\'organizzazione garantisce la conformità',
      type: 'textarea',
      required: true,
    },
    {
      id: `${prefix}_evidence`,
      label: 'Documenti e registri di riferimento (nome e ubicazione)',
      type: 'textarea',
    },
    {
      id: `${prefix}_legal_obligations`,
      label: 'Vincoli legali/regolamentari rilevanti',
      type: 'textarea',
    },
    {
      id: `${prefix}_policy`,
      label: 'Policy aziendale collegata alla clausola',
      type: 'textarea',
    },
  ]
}

export const FSC_ILO_SECTIONS_V1: FscIloSectionDef[] = [
  {
    id: 'header',
    title: 'Intestazione',
    description: 'Dati identificativi dell\'organizzazione e dell\'autovalutazione.',
    fields: [
      { id: 'org_name', label: 'Ragione sociale', type: 'text', required: true },
      { id: 'org_address', label: 'Sede operativa', type: 'textarea', required: true },
      { id: 'representative', label: 'Rappresentante / referente', type: 'text', required: true },
      { id: 'assessment_date', label: 'Data autovalutazione', type: 'date', required: true },
    ],
  },
  {
    id: 'clr_72',
    title: '7.2 — Lavoro minorile',
    description: 'Clausola FSC 7.2: divieto di impiego di lavoro minorile.',
    fields: clrFields('clr_72', '7.2'),
  },
  {
    id: 'clr_73',
    title: '7.3 — Lavoro forzato',
    description: 'Clausola FSC 7.3: eliminazione di lavoro forzato o obbligatorio.',
    fields: clrFields('clr_73', '7.3'),
  },
  {
    id: 'clr_74',
    title: '7.4 — Non discriminazione',
    description: 'Clausola FSC 7.4: parità in materia di impiego e professione.',
    fields: clrFields('clr_74', '7.4'),
  },
  {
    id: 'clr_75',
    title: '7.5 — Libertà sindacale e contrattazione collettiva',
    description: 'Clausola FSC 7.5: libertà di associazione e contrattazione collettiva.',
    fields: clrFields('clr_75', '7.5'),
  },
  {
    id: 'terzisti',
    title: 'Gestione terzisti non certificati (Italia)',
    description: 'Paragrafo nazionale: gestione e verifica conformità dei terzisti.',
    fields: [
      {
        id: 'subcontractor_management',
        label: 'Come gestite i terzisti non certificati FSC',
        type: 'textarea',
        required: true,
      },
      {
        id: 'subcontractor_evidence',
        label: 'Evidenze di conformità richieste ai terzisti',
        type: 'textarea',
      },
    ],
  },
  {
    id: 'attestation',
    title: 'Attestazione',
    description: 'Dichiarazione di veridicità delle informazioni fornite.',
    fields: [
      {
        id: 'attestor_name',
        label: 'Nome e cognome del firmatario',
        type: 'text',
        required: true,
      },
      {
        id: 'attestor_date',
        label: 'Data attestazione',
        type: 'date',
        required: true,
      },
      {
        id: 'attestation_note',
        label: 'Note aggiuntive',
        type: 'textarea',
        helpText:
          'Dichiaro che le informazioni fornite sono veritiere e corrette al meglio delle mie conoscenze.',
      },
    ],
  },
]

export const FSC_ILO_ALL_FIELDS = FSC_ILO_SECTIONS_V1.flatMap((s) => s.fields)

export function getFscIloDefaultFormData(): Record<string, string> {
  const data: Record<string, string> = {}
  for (const field of FSC_ILO_ALL_FIELDS) {
    data[field.id] = ''
  }
  return data
}

export function mergeFscIloFormData(
  existing: Record<string, unknown> | null | undefined
): Record<string, string> {
  const defaults = getFscIloDefaultFormData()
  if (!existing || typeof existing !== 'object') return defaults
  for (const key of Object.keys(defaults)) {
    const val = existing[key]
    if (typeof val === 'string') defaults[key] = val
  }
  return defaults
}

function buildZodShape(): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of FSC_ILO_ALL_FIELDS) {
    let schema: z.ZodTypeAny = z.string()
    if (field.required) {
      schema = z.string().min(1, `${field.label} obbligatorio`)
    } else {
      schema = z.string().optional().or(z.literal(''))
    }
    shape[field.id] = schema
  }
  return shape
}

export const fscIloFormSchemaV1 = z.object(buildZodShape())

export type FscIloFormDataV1 = z.infer<typeof fscIloFormSchemaV1>

export function isFscIloFieldVisible(
  field: FscIloFieldDef,
  formData: Record<string, string>
): boolean {
  if (!field.showWhen) return true
  return formData[field.showWhen.fieldId] === field.showWhen.value
}
