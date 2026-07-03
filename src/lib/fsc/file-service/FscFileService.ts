import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import { validateFscDocumentFileMetadata } from '@/lib/fsc/documents-upload'
import { buildCanonicalFscStoragePath } from '@/lib/fsc/file-service/paths'
import {
  FSC_STORAGE_BUCKET,
  FSC_STORAGE_DELETE_MAX_ATTEMPTS,
  FSC_UPLOAD_PENDING_TTL_HOURS,
  type FscStorageOwnerType,
  type FscStorageSlot,
} from '@/lib/fsc/file-service/policy'
import type {
  FscStorageObject,
  FinalizeFscFileUploadMeta,
  PrepareFscFileUploadInput,
  PrepareFscFileUploadResult,
} from '@/types/fsc-storage'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type DbClient = SupabaseClient<Database>

function uploadExpiresAt(): string {
  return new Date(Date.now() + FSC_UPLOAD_PENDING_TTL_HOURS * 60 * 60 * 1000).toISOString()
}

async function verifyStorageExists(supabase: DbClient, storagePath: string): Promise<boolean> {
  const { error } = await supabase.storage.from(FSC_STORAGE_BUCKET).createSignedUrl(storagePath, 60)
  return !error
}

async function removeStoragePaths(supabase: DbClient, paths: string[]): Promise<void> {
  const valid = paths.filter(Boolean)
  if (valid.length === 0) return
  await supabase.storage.from(FSC_STORAGE_BUCKET).remove(valid)
}

export class FscFileService {
  constructor(private readonly supabase: DbClient) {}

  async prepareUpload(input: PrepareFscFileUploadInput): Promise<
    | { success: true; data: PrepareFscFileUploadResult }
    | { success: false; error: string }
  > {
    const validationError = validateFscDocumentFileMetadata({
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
    })
    if (validationError) return { success: false, error: validationError }

    const storageObjectId = input.storageObjectId ?? crypto.randomUUID()
    const storagePath = buildCanonicalFscStoragePath(
      input.companyId,
      input.domain,
      input.entityId,
      storageObjectId,
      input.fileName
    )

    const { error: insertError } = await this.supabase.from('fsc_storage_objects').insert({
      id: storageObjectId,
      company_id: input.companyId,
      bucket: FSC_STORAGE_BUCKET,
      storage_path: storagePath,
      status: 'pending_upload',
      original_filename: input.fileName.trim(),
      mime_type: input.mimeType || null,
      upload_expires_at: uploadExpiresAt(),
      created_by: input.createdBy,
    })

    if (insertError) return { success: false, error: insertError.message }

    if (input.ownerType && input.ownerId) {
      const { error: linkError } = await this.supabase.from('fsc_storage_object_links').insert({
        storage_object_id: storageObjectId,
        owner_type: input.ownerType,
        owner_id: input.ownerId,
        slot: input.slot ?? 'primary',
      })

      if (linkError) {
        await this.supabase.from('fsc_storage_objects').delete().eq('id', storageObjectId)
        return { success: false, error: linkError.message }
      }
    }

    return { success: true, data: { storageObjectId, storagePath } }
  }

  async finalizeUpload(
    storageObjectId: string,
    companyId: string,
    meta?: FinalizeFscFileUploadMeta
  ): Promise<{ success: true } | { success: false; error: string }> {
    const { data: row, error: fetchError } = await this.supabase
      .from('fsc_storage_objects')
      .select('*')
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (fetchError || !row) {
      return { success: false, error: 'Oggetto storage non trovato' }
    }

    const obj = row as FscStorageObject
    if (obj.status !== 'pending_upload') {
      return { success: false, error: 'Upload già finalizzato o non valido' }
    }

    const exists = await verifyStorageExists(this.supabase, obj.storage_path)
    if (!exists) {
      return { success: false, error: 'File non trovato in storage. Riprova l\'upload.' }
    }

    const { error: updateError } = await this.supabase
      .from('fsc_storage_objects')
      .update({
        status: 'active',
        mime_type: meta?.mimeType ?? obj.mime_type,
        size_bytes: meta?.sizeBytes ?? obj.size_bytes,
        activated_at: new Date().toISOString(),
        upload_expires_at: null,
      })
      .eq('id', storageObjectId)
      .eq('company_id', companyId)

    if (updateError) return { success: false, error: updateError.message }
    return { success: true }
  }

  async abortUpload(
    storageObjectId: string,
    companyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const { data: row } = await this.supabase
      .from('fsc_storage_objects')
      .select('storage_path, status')
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!row) return { success: true }

    if (row.status === 'pending_upload' && row.storage_path) {
      await removeStoragePaths(this.supabase, [row.storage_path])
    }

    await this.supabase
      .from('fsc_storage_object_links')
      .delete()
      .eq('storage_object_id', storageObjectId)

    const { error } = await this.supabase
      .from('fsc_storage_objects')
      .delete()
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .eq('status', 'pending_upload')

    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async uploadFromBuffer(params: {
    companyId: string
    domain: string
    entityId: string
    fileName: string
    mimeType: string
    buffer: Buffer | Uint8Array
    createdBy: string
    ownerType: FscStorageOwnerType
    ownerId: string
    slot: FscStorageSlot | string
    upsert?: boolean
  }): Promise<
    | { success: true; data: PrepareFscFileUploadResult }
    | { success: false; error: string }
  > {
    const prepared = await this.prepareUpload({
      companyId: params.companyId,
      domain: params.domain,
      entityId: params.entityId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSize: params.buffer.byteLength,
      createdBy: params.createdBy,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      slot: params.slot,
    })

    if (!prepared.success) return prepared

    const { storageObjectId, storagePath } = prepared.data
    const { error: uploadError } = await this.supabase.storage
      .from(FSC_STORAGE_BUCKET)
      .upload(storagePath, params.buffer, {
        contentType: params.mimeType,
        upsert: params.upsert ?? false,
      })

    if (uploadError) {
      await this.abortUpload(storageObjectId, params.companyId)
      return { success: false, error: uploadError.message }
    }

    const finalized = await this.finalizeUpload(storageObjectId, params.companyId, {
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
    })

    if (!finalized.success) {
      await this.abortUpload(storageObjectId, params.companyId)
      return { success: false, error: finalized.error }
    }

    return { success: true, data: { storageObjectId, storagePath } }
  }

  async getDownloadUrl(
    storageObjectId: string,
    companyId: string,
    opts?: { ttlSec?: number; inline?: boolean }
  ): Promise<{ success: true; url: string } | { success: false; error: string }> {
    const { data: row } = await this.supabase
      .from('fsc_storage_objects')
      .select('storage_path, status')
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!row?.storage_path || row.status !== 'active') {
      return { success: false, error: 'File non disponibile' }
    }

    const urls = await createFscDocumentSignedUrls(this.supabase, [row.storage_path])
    const url = urls[row.storage_path]
    if (!url) return { success: false, error: 'Impossibile generare link di download' }

    return { success: true, url }
  }

  async getPreviewUrl(
    storageObjectId: string,
    companyId: string
  ): Promise<{ success: true; url: string } | { success: false; error: string }> {
    return this.getDownloadUrl(storageObjectId, companyId, { inline: true })
  }

  async getPathByOwner(
    ownerType: FscStorageOwnerType,
    ownerId: string,
    slot: FscStorageSlot | string = 'primary'
  ): Promise<{ storageObjectId: string; storagePath: string } | null> {
    const { data: link } = await this.supabase
      .from('fsc_storage_object_links')
      .select('storage_object_id')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .eq('slot', slot)
      .maybeSingle()

    if (!link) return null

    const { data: obj } = await this.supabase
      .from('fsc_storage_objects')
      .select('id, storage_path, status')
      .eq('id', link.storage_object_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!obj?.storage_path) return null
    return { storageObjectId: obj.id, storagePath: obj.storage_path }
  }

  async listByOwner(
    ownerType: FscStorageOwnerType,
    ownerId: string
  ): Promise<FscStorageObject[]> {
    const { data: links } = await this.supabase
      .from('fsc_storage_object_links')
      .select('storage_object_id')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)

    const ids = (links ?? []).map((l) => l.storage_object_id)
    if (ids.length === 0) return []

    const { data: objects } = await this.supabase
      .from('fsc_storage_objects')
      .select('*')
      .in('id', ids)
      .eq('status', 'active')

    return (objects ?? []) as FscStorageObject[]
  }

  async deleteFile(
    storageObjectId: string,
    companyId: string
  ): Promise<{ success: true } | { success: false; error: string }> {
    const { data: row } = await this.supabase
      .from('fsc_storage_objects')
      .select('storage_path, bucket, status')
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!row) return { success: true }
    if (row.status === 'deleted') return { success: true }

    const { error: markError } = await this.supabase
      .from('fsc_storage_objects')
      .update({ status: 'delete_pending' })
      .eq('id', storageObjectId)
      .eq('company_id', companyId)

    if (markError) return { success: false, error: markError.message }

    await this.supabase.from('fsc_storage_delete_outbox').upsert(
      {
        storage_object_id: storageObjectId,
        storage_path: row.storage_path,
        bucket: row.bucket,
        processed_at: null,
        last_error: null,
      },
      { onConflict: 'storage_object_id' }
    )

    await removeStoragePaths(this.supabase, [row.storage_path])

    const stillExists = await verifyStorageExists(this.supabase, row.storage_path)
    if (stillExists) {
      return { success: true }
    }

    await this.finalizeDeleted(storageObjectId)
    return { success: true }
  }

  async deleteFilesByOwner(
    ownerType: FscStorageOwnerType,
    ownerId: string,
    companyId: string
  ): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
    const objects = await this.listByOwner(ownerType, ownerId)
    let deleted = 0

    for (const obj of objects) {
      const result = await this.deleteFile(obj.id, companyId)
      if (!result.success) return result
      deleted += 1
    }

    await this.supabase
      .from('fsc_storage_object_links')
      .delete()
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)

    return { success: true, deleted }
  }

  async finalizeDeleted(storageObjectId: string): Promise<void> {
    await this.supabase
      .from('fsc_storage_objects')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', storageObjectId)

    await this.supabase
      .from('fsc_storage_delete_outbox')
      .update({ processed_at: new Date().toISOString() })
      .eq('storage_object_id', storageObjectId)

    await this.supabase
      .from('fsc_storage_object_links')
      .delete()
      .eq('storage_object_id', storageObjectId)
  }

  async processDeleteOutbox(limit = 50): Promise<number> {
    const { data: pending } = await this.supabase
      .from('fsc_storage_delete_outbox')
      .select('*')
      .is('processed_at', null)
      .lt('attempt_count', FSC_STORAGE_DELETE_MAX_ATTEMPTS)
      .order('created_at')
      .limit(limit)

    let processed = 0
    for (const row of pending ?? []) {
      const exists = await verifyStorageExists(this.supabase, row.storage_path)
      if (exists) {
        await removeStoragePaths(this.supabase, [row.storage_path])
        const stillThere = await verifyStorageExists(this.supabase, row.storage_path)
        if (stillThere) {
          await this.supabase
            .from('fsc_storage_delete_outbox')
            .update({
              attempt_count: row.attempt_count + 1,
              last_error: 'Storage remove failed',
            })
            .eq('id', row.id)
          continue
        }
      }

      await this.finalizeDeleted(row.storage_object_id)
      processed += 1
    }

    return processed
  }

  /**
   * Ripara link registry mancanti o upload non finalizzati (pending_upload con file in storage).
   */
  async repairOwnerFile(
    ownerType: FscStorageOwnerType,
    ownerId: string,
    companyId: string,
    slot: FscStorageSlot | string = 'primary'
  ): Promise<{ storageObjectId: string; storagePath: string } | null> {
    const { data: link } = await this.supabase
      .from('fsc_storage_object_links')
      .select('storage_object_id')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .eq('slot', slot)
      .maybeSingle()

    if (link) {
      const resolved = await this.resolveStorageObjectForDownload(
        link.storage_object_id,
        companyId
      )
      if (resolved) return resolved
    }

    const direct = await this.resolveStorageObjectForDownload(ownerId, companyId)
    if (!direct) return null

    if (!link) {
      await this.supabase.from('fsc_storage_object_links').upsert(
        {
          storage_object_id: direct.storageObjectId,
          owner_type: ownerType,
          owner_id: ownerId,
          slot,
        },
        { onConflict: 'owner_type,owner_id,slot' }
      )
    }

    return direct
  }

  async adoptExistingStorageFile(params: {
    companyId: string
    storagePath: string
    ownerType: FscStorageOwnerType
    ownerId: string
    slot: FscStorageSlot | string
    fileName: string
    mimeType?: string | null
    sizeBytes?: number | null
    createdBy?: string | null
    preferredObjectId?: string
  }): Promise<{ success: true; storageObjectId: string } | { success: false; error: string }> {
    const exists = await verifyStorageExists(this.supabase, params.storagePath)
    if (!exists) return { success: false, error: 'File non trovato in storage' }

    const { data: byPath } = await this.supabase
      .from('fsc_storage_objects')
      .select('id, status')
      .eq('storage_path', params.storagePath)
      .maybeSingle()

    let storageObjectId = byPath?.id

    if (!storageObjectId) {
      storageObjectId = params.preferredObjectId ?? crypto.randomUUID()
      const { error: insertError } = await this.supabase.from('fsc_storage_objects').insert({
        id: storageObjectId,
        company_id: params.companyId,
        bucket: FSC_STORAGE_BUCKET,
        storage_path: params.storagePath,
        status: 'active',
        original_filename: params.fileName.trim(),
        mime_type: params.mimeType ?? null,
        size_bytes: params.sizeBytes ?? null,
        activated_at: new Date().toISOString(),
        created_by: params.createdBy ?? null,
      })

      if (insertError) {
        if (!params.preferredObjectId) {
          return { success: false, error: insertError.message }
        }
        const { data: retry } = await this.supabase
          .from('fsc_storage_objects')
          .select('id')
          .eq('storage_path', params.storagePath)
          .maybeSingle()
        if (!retry) return { success: false, error: insertError.message }
        storageObjectId = retry.id
      }
    } else if (byPath?.status && byPath.status !== 'active') {
      await this.supabase
        .from('fsc_storage_objects')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
          upload_expires_at: null,
        })
        .eq('id', storageObjectId)
    }

    const { error: linkError } = await this.supabase.from('fsc_storage_object_links').upsert(
      {
        storage_object_id: storageObjectId,
        owner_type: params.ownerType,
        owner_id: params.ownerId,
        slot: params.slot,
      },
      { onConflict: 'owner_type,owner_id,slot' }
    )

    if (linkError) return { success: false, error: linkError.message }
    return { success: true, storageObjectId }
  }

  private async resolveStorageObjectForDownload(
    storageObjectId: string,
    companyId: string
  ): Promise<{ storageObjectId: string; storagePath: string } | null> {
    const { data: obj } = await this.supabase
      .from('fsc_storage_objects')
      .select('id, storage_path, status')
      .eq('id', storageObjectId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!obj?.storage_path) return null

    if (obj.status === 'active') {
      return { storageObjectId: obj.id, storagePath: obj.storage_path }
    }

    if (obj.status === 'pending_upload') {
      const finalized = await this.finalizeUpload(obj.id, companyId)
      if (finalized.success) {
        return { storageObjectId: obj.id, storagePath: obj.storage_path }
      }
    }

    return null
  }

  async replaceOwnerLink(params: {
    ownerType: FscStorageOwnerType
    ownerId: string
    slot: FscStorageSlot | string
    storageObjectId: string
    companyId: string
  }): Promise<{ success: true } | { success: false; error: string }> {
    const existing = await this.getPathByOwner(params.ownerType, params.ownerId, params.slot)
    if (existing && existing.storageObjectId !== params.storageObjectId) {
      await this.deleteFile(existing.storageObjectId, params.companyId)
    }

    const { error } = await this.supabase.from('fsc_storage_object_links').upsert(
      {
        storage_object_id: params.storageObjectId,
        owner_type: params.ownerType,
        owner_id: params.ownerId,
        slot: params.slot,
      },
      { onConflict: 'owner_type,owner_id,slot' }
    )

    if (error) return { success: false, error: error.message }
    return { success: true }
  }
}

export function createFscFileService(supabase: DbClient): FscFileService {
  return new FscFileService(supabase)
}
