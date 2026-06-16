import { sanitizeFscDocumentFileName } from '@/lib/fsc/documents-upload'

export { FSC_ILO_SCHEMA_VERSION } from '@/lib/fsc/ilo/schema.v1'

export function buildFscIloCompiledDocPath(
  companyId: string,
  referenceYear: number,
  fileName = 'autovalutazione_ilo.docx'
): string {
  const safe = sanitizeFscDocumentFileName(fileName)
  return `${companyId}/ilo/${referenceYear}/${safe}`
}

export function buildFscIloCompiledPdfPath(
  companyId: string,
  referenceYear: number,
  fileName = 'autovalutazione_ilo.pdf'
): string {
  const safe = sanitizeFscDocumentFileName(fileName)
  return `${companyId}/ilo/${referenceYear}/${safe}`
}

export function buildFscIloTemplateMasterPath(version: string): string {
  const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `_system/ilo/templates/${safeVersion}.docx`
}
