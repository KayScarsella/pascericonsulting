'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import { validateFscDocumentFileMetadata } from '@/lib/fsc/documents-upload'
import {
  buildFscPartnerAttachmentPathCandidates,
  buildFscPartnerDomainPath,
  buildLegacyFscPartnerAttachmentFolder,
  createFscFileService,
  FSC_STORAGE_BUCKET,
  FSC_STORAGE_OWNER_TYPES,
  FSC_STORAGE_SLOTS,
} from '@/lib/fsc/file-service'
import { sanitizeFscDocumentFileName } from '@/lib/fsc/documents-upload'
import {
  FSC_SUBCONTRACTORS_PATH,
  FSC_SUPPLIERS_PATH,
  type FscPartnerEntity,
} from '@/lib/fsc/partners'
import type {
  FscSubcontractorAttachment,
  FscSubcontractorAttachmentType,
  FscSupplierAttachment,
  FscSupplierAttachmentType,
} from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type PrepareFscPartnerAttachmentInput = {
  entity: FscPartnerEntity
  entityId: string
  attachmentType: string
  fileName: string
  fileSize: number
  mimeType: string
}

function revalidatePartnerPaths(entity: FscPartnerEntity): void {
  revalidatePath(entity === 'supplier' ? FSC_SUPPLIERS_PATH : FSC_SUBCONTRACTORS_PATH)
}

function getOwnerType(entity: FscPartnerEntity) {
  return entity === 'supplier'
    ? FSC_STORAGE_OWNER_TYPES.FSC_SUPPLIER_ATTACHMENT
    : FSC_STORAGE_OWNER_TYPES.FSC_SUBCONTRACTOR_ATTACHMENT
}

async function verifyEntityOwnership(
  entity: FscPartnerEntity,
  entityId: string,
  companyId: string
): Promise<boolean> {
  const supabase = await createClient()
  const table = entity === 'supplier' ? 'fsc_suppliers' : 'fsc_subcontractors'
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', entityId)
    .eq('company_id', companyId)
    .maybeSingle()
  return !!data
}

async function resolveAttachmentPath(
  entity: FscPartnerEntity,
  attachmentId: string
): Promise<string | null> {
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const resolved = await fileService.getPathByOwner(
    getOwnerType(entity),
    attachmentId,
    FSC_STORAGE_SLOTS.PRIMARY
  )
  return resolved?.storagePath ?? null
}

type PartnerAttachmentRow = {
  id: string
  attachment_type: string
  file_name: string | null
  mime_type: string | null
  size: number | null
  supplier_id?: string
  subcontractor_id?: string
}

async function repairPartnerAttachmentStorage(
  entity: FscPartnerEntity,
  attachment: PartnerAttachmentRow,
  companyId: string,
  userId: string
): Promise<string | null> {
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const ownerType = getOwnerType(entity)

  const repaired = await fileService.repairOwnerFile(ownerType, attachment.id, companyId)
  if (repaired) return repaired.storagePath

  const entityId =
    entity === 'supplier' ? attachment.supplier_id! : attachment.subcontractor_id!

  const candidates = buildFscPartnerAttachmentPathCandidates(
    companyId,
    entity,
    entityId,
    attachment.attachment_type,
    attachment.id,
    attachment.file_name
  )

  for (const storagePath of candidates) {
    const adopted = await fileService.adoptExistingStorageFile({
      companyId,
      storagePath,
      ownerType,
      ownerId: attachment.id,
      slot: FSC_STORAGE_SLOTS.PRIMARY,
      fileName: attachment.file_name ?? 'allegato',
      mimeType: attachment.mime_type,
      sizeBytes: attachment.size,
      createdBy: userId,
      preferredObjectId: attachment.id,
    })
    if (adopted.success) return storagePath
  }

  if (!attachment.file_name?.trim()) return null

  const safeName = sanitizeFscDocumentFileName(attachment.file_name)
  const legacyFolder = buildLegacyFscPartnerAttachmentFolder(
    companyId,
    entity,
    entityId,
    attachment.attachment_type
  )

  const { data: listed } = await supabase.storage.from(FSC_STORAGE_BUCKET).list(legacyFolder)
  const match = (listed ?? []).find(
    (item) => item.name && item.name.endsWith(`_${safeName}`)
  )

  if (!match?.name) return null

  const storagePath = `${legacyFolder}/${match.name}`
  const adopted = await fileService.adoptExistingStorageFile({
    companyId,
    storagePath,
    ownerType,
    ownerId: attachment.id,
    slot: FSC_STORAGE_SLOTS.PRIMARY,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    sizeBytes: attachment.size,
    createdBy: userId,
  })

  return adopted.success ? storagePath : null
}

export async function prepareFscPartnerAttachmentUpload(
  input: PrepareFscPartnerAttachmentInput
): Promise<{
  success: boolean
  attachmentId?: string
  storagePath?: string
  error?: string
}> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const fileErr = validateFscDocumentFileMetadata({
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  })
  if (fileErr) return { success: false, error: fileErr }

  const owned = await verifyEntityOwnership(input.entity, input.entityId, ctx.data.companyId)
  if (!owned) return { success: false, error: 'Record non trovato' }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const attachmentId = crypto.randomUUID()
  const { domain, entityId } = buildFscPartnerDomainPath(
    input.entity,
    input.entityId,
    input.attachmentType
  )

  const prepared = await fileService.prepareUpload({
    companyId: ctx.data.companyId,
    domain,
    entityId: `${entityId}_${attachmentId}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    createdBy: ctx.data.userId,
    ownerType: getOwnerType(input.entity),
    ownerId: attachmentId,
    slot: FSC_STORAGE_SLOTS.PRIMARY,
    storageObjectId: attachmentId,
  })

  if (!prepared.success) {
    return { success: false, error: prepared.error }
  }

  const storagePath = prepared.data.storagePath

  if (input.entity === 'supplier') {
    const { data, error } = await supabase
      .from('fsc_supplier_attachments')
      .insert({
        id: attachmentId,
        supplier_id: input.entityId,
        attachment_type: input.attachmentType as FscSupplierAttachmentType,
        file_name: input.fileName,
        mime_type: input.mimeType || null,
        size: input.fileSize,
        created_by: ctx.data.userId,
      })
      .select('id')
      .single()

    if (error || !data) {
      await fileService.abortUpload(attachmentId, ctx.data.companyId)
      return { success: false, error: error?.message ?? 'Errore preparazione upload' }
    }

    return { success: true, attachmentId: data.id, storagePath }
  }

  const { data, error } = await supabase
    .from('fsc_subcontractor_attachments')
    .insert({
      id: attachmentId,
      subcontractor_id: input.entityId,
      attachment_type: input.attachmentType as FscSubcontractorAttachmentType,
      file_name: input.fileName,
      mime_type: input.mimeType || null,
      size: input.fileSize,
      created_by: ctx.data.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    await fileService.abortUpload(attachmentId, ctx.data.companyId)
    return { success: false, error: error?.message ?? 'Errore preparazione upload' }
  }

  return { success: true, attachmentId: data.id, storagePath }
}

export async function abortFscPartnerAttachmentUpload(
  entity: FscPartnerEntity,
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  await fileService.abortUpload(attachmentId, ctx.data.companyId)

  const table =
    entity === 'supplier' ? 'fsc_supplier_attachments' : 'fsc_subcontractor_attachments'
  const { error } = await supabase.from(table).delete().eq('id', attachmentId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function finalizeFscPartnerAttachmentUpload(
  entity: FscPartnerEntity,
  attachmentId: string,
  meta?: { fileName: string; mimeType: string; size: number }
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)

  const finalized = await fileService.finalizeUpload(attachmentId, ctx.data.companyId, {
    mimeType: meta?.mimeType,
    sizeBytes: meta?.size,
  })

  if (!finalized.success) {
    return { success: false, error: finalized.error }
  }

  if (meta) {
    const table =
      entity === 'supplier' ? 'fsc_supplier_attachments' : 'fsc_subcontractor_attachments'
    await supabase
      .from(table)
      .update({
        mime_type: meta.mimeType || null,
        size: meta.size,
        file_name: meta.fileName,
      })
      .eq('id', attachmentId)
  }

  revalidatePartnerPaths(entity)
  return { success: true }
}

export async function deleteFscPartnerAttachment(
  entity: FscPartnerEntity,
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)

  if (entity === 'supplier') {
    const { data: attachment } = await supabase
      .from('fsc_supplier_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!attachment) return { success: false, error: 'Allegato non trovato' }

    const owned = await verifyEntityOwnership('supplier', attachment.supplier_id, ctx.data.companyId)
    if (!owned) return { success: false, error: 'Allegato non trovato' }

    await fileService.deleteFile(attachmentId, ctx.data.companyId)
    const { error } = await supabase.from('fsc_supplier_attachments').delete().eq('id', attachmentId)
    if (error) return { success: false, error: error.message }
  } else {
    const { data: attachment } = await supabase
      .from('fsc_subcontractor_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!attachment) return { success: false, error: 'Allegato non trovato' }

    const owned = await verifyEntityOwnership(
      'subcontractor',
      attachment.subcontractor_id,
      ctx.data.companyId
    )
    if (!owned) return { success: false, error: 'Allegato non trovato' }

    await fileService.deleteFile(attachmentId, ctx.data.companyId)
    const { error } = await supabase
      .from('fsc_subcontractor_attachments')
      .delete()
      .eq('id', attachmentId)
    if (error) return { success: false, error: error.message }
  }

  revalidatePartnerPaths(entity)
  return { success: true }
}

export async function getFscPartnerAttachmentDownloadUrl(
  entity: FscPartnerEntity,
  attachmentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  let attachment: PartnerAttachmentRow | null = null

  if (entity === 'supplier') {
    const { data } = await supabase
      .from('fsc_supplier_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!data) return { success: false, error: 'Allegato non trovato' }
    const owned = await verifyEntityOwnership('supplier', data.supplier_id, ctx.data.companyId)
    if (!owned) return { success: false, error: 'Allegato non trovato' }
    attachment = data
  } else {
    const { data } = await supabase
      .from('fsc_subcontractor_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!data) return { success: false, error: 'Allegato non trovato' }
    const owned = await verifyEntityOwnership(
      'subcontractor',
      data.subcontractor_id,
      ctx.data.companyId
    )
    if (!owned) return { success: false, error: 'Allegato non trovato' }
    attachment = data
  }

  const dl = await fileService.getDownloadUrl(attachmentId, ctx.data.companyId)
  if (dl.success) return { success: true, url: dl.url }

  let storagePath = await resolveAttachmentPath(entity, attachmentId)
  if (!storagePath) {
    storagePath = await repairPartnerAttachmentStorage(
      entity,
      attachment,
      ctx.data.companyId,
      ctx.data.userId
    )
  }
  if (!storagePath) return { success: false, error: 'Percorso file mancante' }

  const urls = await createFscDocumentSignedUrls(supabase, [storagePath])
  const url = urls[storagePath]
  if (!url) return { success: false, error: 'Impossibile generare URL di download' }

  return { success: true, url }
}

export type FscPartnerAttachment =
  | (FscSupplierAttachment & { entity: 'supplier' })
  | (FscSubcontractorAttachment & { entity: 'subcontractor' })
