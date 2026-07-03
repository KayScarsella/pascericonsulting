import type {
  FscStorageObjectStatus,
  FscStorageOwnerType,
  FscStorageSlot,
} from '@/lib/fsc/file-service/policy'

export type FscStorageObject = {
  id: string
  company_id: string
  bucket: string
  storage_path: string
  status: FscStorageObjectStatus
  original_filename: string
  mime_type: string | null
  size_bytes: number | null
  upload_expires_at: string | null
  activated_at: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
}

export type FscStorageObjectLink = {
  id: string
  storage_object_id: string
  owner_type: FscStorageOwnerType
  owner_id: string
  slot: FscStorageSlot | string
  created_at: string
}

export type PrepareFscFileUploadInput = {
  companyId: string
  domain: string
  entityId: string
  fileName: string
  mimeType: string
  fileSize: number
  createdBy: string
  ownerType?: FscStorageOwnerType
  ownerId?: string
  slot?: FscStorageSlot | string
  storageObjectId?: string
}

export type PrepareFscFileUploadResult = {
  storageObjectId: string
  storagePath: string
}

export type FinalizeFscFileUploadMeta = {
  mimeType?: string
  sizeBytes?: number
}

export type FscFileServiceResult<T> = { success: true; data: T } | { success: false; error: string }
