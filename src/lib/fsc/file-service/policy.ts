/**
 * Policy documentale FSC — decisioni architetturali (Fase Analisi).
 * - Version delete: solo versione corrente; catena storica eliminabile singolarmente.
 * - Preview: signed URL (nessun viewer inline).
 * - Audit: solo created_by su fsc_storage_objects (no audit trail dedicato).
 * - Retention: hard delete immediato, nessun vincolo legale per categoria.
 */
export const FSC_FILE_POLICY = {
  versionDeleteScope: 'current_only' as const,
  previewMode: 'signed_url' as const,
  auditTrail: false,
  hardDeleteImmediate: true,
} as const

export const FSC_STORAGE_BUCKET = 'fsc-documents' as const
export const FSC_UPLOAD_PENDING_TTL_HOURS = 24
export const FSC_STORAGE_DELETE_MAX_ATTEMPTS = 5

export const FSC_STORAGE_OWNER_TYPES = {
  FSC_DOCUMENT: 'fsc_document',
  FSC_LOGO: 'fsc_logo',
  FSC_SUPPLIER_ATTACHMENT: 'fsc_supplier_attachment',
  FSC_SUBCONTRACTOR_ATTACHMENT: 'fsc_subcontractor_attachment',
  FSC_ILO_ASSESSMENT: 'fsc_ilo_assessment',
  FSC_PRODUCT_GROUP_ADDENDUM: 'fsc_product_group_addendum',
} as const

export type FscStorageOwnerType =
  (typeof FSC_STORAGE_OWNER_TYPES)[keyof typeof FSC_STORAGE_OWNER_TYPES]

export const FSC_STORAGE_SLOTS = {
  PRIMARY: 'primary',
  APPROVAL: 'approval',
  GRAPHIC: 'graphic',
  COMPILED_WORD: 'compiled_word',
  COMPILED_PDF: 'compiled_pdf',
} as const

export type FscStorageSlot = (typeof FSC_STORAGE_SLOTS)[keyof typeof FSC_STORAGE_SLOTS]

export type FscStorageObjectStatus =
  | 'pending_upload'
  | 'active'
  | 'delete_pending'
  | 'deleted'
  | 'broken'
