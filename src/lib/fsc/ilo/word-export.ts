import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'node:fs'
import path from 'node:path'
import { formDataToTemplateContext } from '@/lib/fsc/ilo/template-map.v1'
import { responsesToExportContext } from '@/lib/fsc/ilo/template-map.v1.2'
import type { Tables } from '@/types/supabase'

const TAGGED_TEMPLATE_PATH = path.join(
  process.cwd(),
  'public',
  'fsc',
  'ilo',
  'template_it_coc_v1.2_tagged.docx'
)

const FALLBACK_TEMPLATE_PATH = path.join(
  process.cwd(),
  'public',
  'fsc',
  'ilo',
  'template_it_coc_v1.2.docx'
)

export function renderFscIloWordFromContext(
  templateBuffer: Buffer,
  context: Record<string, string>
): Buffer {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  })

  doc.render(context)

  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer
}

/** @deprecated Use renderFscIloWordFromContext with responsesToExportContext */
export function renderFscIloWordDocument(
  templateBuffer: Buffer,
  formData: Record<string, string>,
  referenceYear: number
): Buffer {
  const context = formDataToTemplateContext(formData, referenceYear)
  return renderFscIloWordFromContext(templateBuffer, context)
}

export function renderFscIloWordFromResponses(
  templateBuffer: Buffer,
  questions: Pick<Tables<'questions'>, 'id' | 'type' | 'config'>[],
  responses: Pick<Tables<'user_responses'>, 'question_id' | 'answer_text' | 'answer_json'>[],
  referenceYear: number
): Buffer {
  const context = responsesToExportContext(questions, responses, referenceYear)
  return renderFscIloWordFromContext(templateBuffer, context)
}

export function loadTaggedIloTemplateBuffer(): Buffer {
  if (fs.existsSync(TAGGED_TEMPLATE_PATH)) {
    return fs.readFileSync(TAGGED_TEMPLATE_PATH)
  }
  return loadFallbackIloTemplateBuffer()
}

export function loadFallbackIloTemplateBuffer(): Buffer {
  if (!fs.existsSync(FALLBACK_TEMPLATE_PATH)) {
    throw new Error(
      'Template ILO non trovato. Aggiungere public/fsc/ilo/template_it_coc_v1.2.docx'
    )
  }
  return fs.readFileSync(FALLBACK_TEMPLATE_PATH)
}

export function loadVirginIloTemplateBuffer(): Buffer {
  return loadFallbackIloTemplateBuffer()
}
