'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import { validateFscDocumentFileMetadata } from '@/lib/fsc/documents-upload'
import {
  buildFscPartnerAttachmentPath,
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

const FSC_BUCKET = 'fsc-documents'

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

  const storagePath = buildFscPartnerAttachmentPath(
    ctx.data.companyId,
    input.entity,
    input.entityId,
    input.attachmentType,
    input.fileName
  )

  const supabase = await createClient()

  if (input.entity === 'supplier') {
    const { data, error } = await supabase
      .from('fsc_supplier_attachments')
      .insert({
        supplier_id: input.entityId,
        attachment_type: input.attachmentType as FscSupplierAttachmentType,
        storage_path: storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType || null,
        size: input.fileSize,
        created_by: ctx.data.userId,
      })
      .select('id')
      .single()

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Errore preparazione upload' }
    }

    return { success: true, attachmentId: data.id, storagePath }
  }

  const { data, error } = await supabase
    .from('fsc_subcontractor_attachments')
    .insert({
      subcontractor_id: input.entityId,
      attachment_type: input.attachmentType as FscSubcontractorAttachmentType,
      storage_path: storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType || null,
      size: input.fileSize,
      created_by: ctx.data.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Errore preparazione upload' }
  }

  return { success: true, attachmentId: data.id, storagePath }
}

export async function finalizeFscPartnerAttachmentUpload(
  entity: FscPartnerEntity,
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

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

  if (entity === 'supplier') {
    const { data: attachment } = await supabase
      .from('fsc_supplier_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!attachment) return { success: false, error: 'Allegato non trovato' }

    const owned = await verifyEntityOwnership('supplier', attachment.supplier_id, ctx.data.companyId)
    if (!owned) return { success: false, error: 'Allegato non trovato' }

    await supabase.storage.from(FSC_BUCKET).remove([attachment.storage_path])
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

    await supabase.storage.from(FSC_BUCKET).remove([attachment.storage_path])
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
  let storagePath: string | null = null

  if (entity === 'supplier') {
    const { data: attachment } = await supabase
      .from('fsc_supplier_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle()

    if (!attachment) return { success: false, error: 'Allegato non trovato' }
    const owned = await verifyEntityOwnership('supplier', attachment.supplier_id, ctx.data.companyId)
    if (!owned) return { success: false, error: 'Allegato non trovato' }
    storagePath = attachment.storage_path
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
    storagePath = attachment.storage_path
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
