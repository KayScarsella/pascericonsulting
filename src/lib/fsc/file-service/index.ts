export { FscFileService, createFscFileService } from '@/lib/fsc/file-service/FscFileService'
export {
  buildCanonicalFscStoragePath,
  buildFscAddendumDomainPath,
  buildFscDocumentDomainPath,
  buildFscIloDomainPath,
  buildFscLogoDomainPath,
  buildFscPartnerAttachmentPathCandidates,
  buildFscPartnerDomainPath,
  buildLegacyFscPartnerAttachmentFolder,
} from '@/lib/fsc/file-service/paths'
export {
  FSC_FILE_POLICY,
  FSC_STORAGE_BUCKET,
  FSC_STORAGE_DELETE_MAX_ATTEMPTS,
  FSC_STORAGE_OWNER_TYPES,
  FSC_STORAGE_SLOTS,
  FSC_UPLOAD_PENDING_TTL_HOURS,
} from '@/lib/fsc/file-service/policy'
export type { FscStorageOwnerType, FscStorageSlot } from '@/lib/fsc/file-service/policy'
export { fscHasActiveFile, fscResolveStoragePaths } from '@/lib/fsc/file-service/resolve'
