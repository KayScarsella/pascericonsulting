import type { FscDocumentModuleSlug, FscGestioneCategorySlug } from '@/lib/fsc/constants'

/** Allineato al bucket fsc-documents (50 MB). */
export const FSC_DOCUMENT_MAX_FILE_SIZE = 50 * 1024 * 1024

export const FSC_DOCUMENT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export function sanitizeFscDocumentFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_')
}

export function buildFscDocumentStoragePath(
  companyId: string,
  module: FscDocumentModuleSlug,
  category: string,
  documentId: string,
  version: number,
  fileName: string
): string {
  const safeName = sanitizeFscDocumentFileName(fileName)
  return `${companyId}/${module}/${category}/${documentId}/v${version}_${safeName}`
}

export function buildFscGestioneStoragePath(
  companyId: string,
  category: FscGestioneCategorySlug,
  documentId: string,
  version: number,
  fileName: string
): string {
  return buildFscDocumentStoragePath(companyId, 'gestione', category, documentId, version, fileName)
}

export type FscDocumentFileMetadata = {
  fileName: string
  fileSize: number
  mimeType: string
}

/** Validazione condivisa client + server. Ritorna messaggio errore o null. */
export function validateFscDocumentFileMetadata(meta: FscDocumentFileMetadata): string | null {
  const name = meta.fileName?.trim()
  if (!name) return 'Nome file non valido'

  if (meta.fileSize <= 0) return 'File vuoto'
  if (meta.fileSize > FSC_DOCUMENT_MAX_FILE_SIZE) {
    return `File troppo grande. Dimensione massima: ${FSC_DOCUMENT_MAX_FILE_SIZE / 1024 / 1024} MB`
  }

  if (
    meta.mimeType &&
    !FSC_DOCUMENT_ALLOWED_MIME_TYPES.includes(
      meta.mimeType as (typeof FSC_DOCUMENT_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return 'Formato non supportato. Consentiti: PDF, Word, PNG, JPEG, WEBP.'
  }

  return null
}
