import {
  FSC_DOCUMENT_MAX_FILE_SIZE,
  sanitizeFscDocumentFileName,
  type FscDocumentFileMetadata,
} from '@/lib/fsc/documents-upload'
import type { FscLogoType } from '@/types/fsc'

export const FSC_LOGHI_PATH = '/cloud-fsc/loghi'

export const FSC_LOGO_TYPE_OPTIONS: { value: FscLogoType; label: string }[] = [
  { value: 'product', label: 'Loghi di prodotto' },
  { value: 'promotional', label: 'Loghi promozionali' },
]

export type FscLogoTypeFilter = FscLogoType | 'all'

export type FscLogoFileKind = 'approval' | 'graphic'

const APPROVAL_MIME_TYPES = ['application/pdf'] as const

const GRAPHIC_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export function getFscLogoTypeLabel(type: FscLogoType): string {
  return FSC_LOGO_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

export function buildFscLogoFilePath(
  companyId: string,
  logoId: string,
  kind: FscLogoFileKind,
  fileName: string
): string {
  const safeName = sanitizeFscDocumentFileName(fileName)
  const fileId = crypto.randomUUID()
  const prefix = kind === 'approval' ? 'approval' : 'graphic'
  return `${companyId}/logos/${logoId}/${prefix}_${fileId}_${safeName}`
}

export function getFscLogoFilePathColumn(
  kind: FscLogoFileKind
): 'approval_email_path' | 'graphic_path' {
  return kind === 'approval' ? 'approval_email_path' : 'graphic_path'
}

export function getFscLogoFileKindLabel(kind: FscLogoFileKind): string {
  return kind === 'approval' ? 'Email di approvazione' : 'Grafica approvata'
}

export function getFscLogoFileAccept(kind: FscLogoFileKind): string {
  return kind === 'approval' ? '.pdf,application/pdf' : '.pdf,.png,.jpg,.jpeg,.webp,image/*'
}

/** Estrae il nome file leggibile dal path storage. */
export function getFscLogoFileNameFromPath(path: string | null | undefined): string | null {
  if (!path) return null
  const segment = path.split('/').pop()
  if (!segment) return null
  const match = segment.match(/^(?:approval|graphic)_[^_]+_(.+)$/)
  return match?.[1] ?? segment
}

/** Validazione per-kind: email solo PDF; grafica immagini + PDF opzionale. */
export function validateFscLogoFileMetadata(
  kind: FscLogoFileKind,
  meta: FscDocumentFileMetadata
): string | null {
  const name = meta.fileName?.trim()
  if (!name) return 'Nome file non valido'

  if (meta.fileSize <= 0) return 'File vuoto'
  if (meta.fileSize > FSC_DOCUMENT_MAX_FILE_SIZE) {
    return `File troppo grande. Dimensione massima: ${FSC_DOCUMENT_MAX_FILE_SIZE / 1024 / 1024} MB`
  }

  const allowed: readonly string[] =
    kind === 'approval' ? APPROVAL_MIME_TYPES : GRAPHIC_MIME_TYPES

  if (meta.mimeType && !allowed.includes(meta.mimeType)) {
    return kind === 'approval'
      ? 'Formato non supportato. Consentito solo PDF per l\'email di approvazione.'
      : 'Formato non supportato. Consentiti: PDF, PNG, JPEG, WEBP.'
  }

  return null
}
