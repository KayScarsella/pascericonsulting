import type {
  FscControlFrequency,
  FscProductClaim,
  FscSupplierStatus,
} from '@/types/fsc'
import { sanitizeFscDocumentFileName } from '@/lib/fsc/documents-upload'

export type FscPartnerEntity = 'supplier' | 'subcontractor'

export type FscControlDueStatus = 'overdue' | 'warning' | 'ok' | 'none'

export const FSC_SUPPLIERS_PATH = '/cloud-fsc/fornitori'
export const FSC_SUBCONTRACTORS_PATH = '/cloud-fsc/terzisti'

export const FSC_PRODUCT_CLAIM_OPTIONS: { value: FscProductClaim; label: string }[] = [
  { value: 'fsc_100', label: 'FSC 100%' },
  { value: 'fsc_mix', label: 'FSC Mix' },
  { value: 'fsc_recycled', label: 'FSC Recycled' },
]

export const FSC_SUPPLIER_STATUS_OPTIONS: { value: FscSupplierStatus; label: string }[] = [
  { value: 'active', label: 'Attivo' },
  { value: 'inactive', label: 'Disattivato' },
  { value: 'reactivated', label: 'Riattivato' },
]

export const FSC_CONTROL_FREQUENCY_OPTIONS: { value: FscControlFrequency; label: string }[] = [
  { value: 'annual', label: 'Annuale' },
  { value: 'semiannual', label: 'Semestrale' },
]

export const FSC_SUPPLIER_ATTACHMENT_TYPES = [
  { value: 'visura', label: 'Visura' },
  { value: 'due_diligence', label: 'Due diligence' },
  { value: 'dichiarazione', label: 'Dichiarazione' },
] as const

export const FSC_SUBCONTRACTOR_ATTACHMENT_TYPES = [
  { value: 'certificato', label: 'Certificato' },
  { value: 'accordo_conto_lavoro', label: 'Accordo di conto lavorazione' },
] as const

export function getFscProductClaimLabel(claim: FscProductClaim): string {
  return FSC_PRODUCT_CLAIM_OPTIONS.find((o) => o.value === claim)?.label ?? claim
}

export function getFscSupplierStatusLabel(status: FscSupplierStatus): string {
  return FSC_SUPPLIER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

export function getFscControlFrequencyLabel(freq: FscControlFrequency): string {
  return FSC_CONTROL_FREQUENCY_OPTIONS.find((o) => o.value === freq)?.label ?? freq
}

export function computeFscControlDueDate(
  lastControlDate: string | null | undefined,
  frequency: FscControlFrequency
): Date | null {
  if (!lastControlDate) return null
  const base = new Date(lastControlDate)
  base.setHours(0, 0, 0, 0)
  const due = new Date(base)
  if (frequency === 'semiannual') {
    due.setMonth(due.getMonth() + 6)
  } else {
    due.setFullYear(due.getFullYear() + 1)
  }
  return due
}

export function getFscControlDueStatus(
  lastControlDate: string | null | undefined,
  frequency: FscControlFrequency
): FscControlDueStatus {
  const due = computeFscControlDueDate(lastControlDate, frequency)
  if (!due) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'warning'
  return 'ok'
}

export function buildFscPartnerAttachmentPath(
  companyId: string,
  entity: FscPartnerEntity,
  entityId: string,
  attachmentType: string,
  fileName: string
): string {
  const folder = entity === 'supplier' ? 'suppliers' : 'subcontractors'
  const safeName = sanitizeFscDocumentFileName(fileName)
  const attachmentId = crypto.randomUUID()
  return `${companyId}/${folder}/${entityId}/${attachmentType}/${attachmentId}_${safeName}`
}
