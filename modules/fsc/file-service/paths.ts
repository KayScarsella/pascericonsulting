import { sanitizeFscDocumentFileName } from '@/lib/fsc/documents-upload'

/**
 * Path canonico: {companyId}/{domain}/{entityId}/{storageObjectId}_{safeName}
 */
export function buildCanonicalFscStoragePath(
  companyId: string,
  domain: string,
  entityId: string,
  storageObjectId: string,
  fileName: string
): string {
  const safeName = sanitizeFscDocumentFileName(fileName)
  const normalizedDomain = domain.replace(/^\/+|\/+$/g, '')
  return `${companyId}/${normalizedDomain}/${entityId}/${storageObjectId}_${safeName}`
}

export function buildFscDocumentDomainPath(
  module: string,
  category: string,
  documentId: string,
  version: number
): { domain: string; entityId: string } {
  return {
    domain: `${module}/${category}`,
    entityId: `v${version}_${documentId}`,
  }
}

export function buildFscLogoDomainPath(logoId: string): { domain: string; entityId: string } {
  return { domain: 'logos', entityId: logoId }
}

export function buildFscPartnerDomainPath(
  entity: 'supplier' | 'subcontractor',
  entityId: string,
  attachmentType: string
): { domain: string; entityId: string } {
  const folder = entity === 'supplier' ? 'suppliers' : 'subcontractors'
  return { domain: `${folder}/${attachmentType}`, entityId }
}

export function buildFscIloDomainPath(
  year: number,
  assessmentId: string
): { domain: string; entityId: string } {
  return { domain: `ilo/${year}`, entityId: assessmentId }
}

export function buildFscAddendumDomainPath(
  groupId: string,
  addendumId: string
): { domain: string; entityId: string } {
  return { domain: 'product-groups/addenda', entityId: `${groupId}_${addendumId}` }
}

/** Cartella legacy pre-registry: {companyId}/suppliers/{entityId}/{type}/ */
export function buildLegacyFscPartnerAttachmentFolder(
  companyId: string,
  entity: 'supplier' | 'subcontractor',
  entityId: string,
  attachmentType: string
): string {
  const folder = entity === 'supplier' ? 'suppliers' : 'subcontractors'
  return `${companyId}/${folder}/${entityId}/${attachmentType}`
}

/** Percorsi noti (canonico + legacy) da verificare in storage. */
export function buildFscPartnerAttachmentPathCandidates(
  companyId: string,
  entity: 'supplier' | 'subcontractor',
  entityId: string,
  attachmentType: string,
  attachmentId: string,
  fileName: string | null
): string[] {
  if (!fileName?.trim()) return []

  const folder = entity === 'supplier' ? 'suppliers' : 'subcontractors'
  const safeName = sanitizeFscDocumentFileName(fileName)

  return [
    buildCanonicalFscStoragePath(
      companyId,
      `${folder}/${attachmentType}`,
      `${entityId}_${attachmentId}`,
      attachmentId,
      fileName
    ),
    `${companyId}/${folder}/${entityId}/${attachmentType}/${attachmentId}_${safeName}`,
  ]
}
