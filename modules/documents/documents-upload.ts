/** Limite upload documenti archivio (allineato a Supabase Storage, bypass Next.js body limit). */
export const DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
] as const

export function sanitizeDocumentFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, "_")
}

export function buildDocumentStoragePath(toolId: string, fileName: string): string {
  return `${toolId}/${Date.now()}_${sanitizeDocumentFileName(fileName)}`
}

export type DocumentFileMetadata = {
  fileName: string
  fileSize: number
  mimeType: string
}

/** Validazione condivisa client + server. Ritorna messaggio errore o null. */
export function validateDocumentFileMetadata(meta: DocumentFileMetadata): string | null {
  const name = meta.fileName?.trim()
  if (!name) return "Nome file non valido"

  if (meta.fileSize <= 0) return "File vuoto"
  if (meta.fileSize > DOCUMENT_MAX_FILE_SIZE) {
    return `File troppo grande. Dimensione massima: ${DOCUMENT_MAX_FILE_SIZE / 1024 / 1024} MB`
  }

  if (meta.mimeType && !DOCUMENT_ALLOWED_MIME_TYPES.includes(meta.mimeType as (typeof DOCUMENT_ALLOWED_MIME_TYPES)[number])) {
    return "Formato non supportato. Consentiti: PDF, immagini, Word, Excel, ZIP, testo."
  }

  return null
}
