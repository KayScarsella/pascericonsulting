'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import {
  FSC_LOGHI_PATH,
  validateFscLogoFileMetadata,
  type FscLogoFileKind,
} from '@/lib/fsc/logos'
import {
  buildFscLogoDomainPath,
  createFscFileService,
  FSC_STORAGE_OWNER_TYPES,
} from '@/lib/fsc/file-service'
import { fscResolveStoragePaths } from '@/lib/fsc/file-service/resolve'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import type { FscLogo, FscLogoType } from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FscLogoInput = {
  logo_type: FscLogoType
  notes?: string | null
}

export type FscLogoListFilters = {
  type?: FscLogoType | 'all'
  search?: string
}

export type PrepareFscLogoFileUploadInput = {
  logoId: string
  fileKind: FscLogoFileKind
  fileName: string
  fileSize: number
  mimeType: string
}

function revalidateLogos(): void {
  revalidatePath(FSC_LOGHI_PATH)
}

function slotForKind(kind: FscLogoFileKind): 'approval' | 'graphic' {
  return kind === 'approval' ? 'approval' : 'graphic'
}

async function verifyLogoOwnership(logoId: string, companyId: string): Promise<FscLogo | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fsc_logos')
    .select('*')
    .eq('id', logoId)
    .eq('company_id', companyId)
    .maybeSingle()

  return data as FscLogo | null
}

export async function listFscLogos(filters?: FscLogoListFilters): Promise<FscLogo[]> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  let query = supabase
    .from('fsc_logos')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .order('created_at', { ascending: false })

  if (filters?.type && filters.type !== 'all') {
    query = query.eq('logo_type', filters.type)
  }

  const search = filters?.search?.trim()
  if (search) {
    query = query.or(
      `progressive_code.ilike.%${search}%,notes.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('listFscLogos:', error)
    return []
  }

  const logos = (data ?? []) as FscLogo[]
  const logoIds = logos.map((l) => l.id)
  const [approvalPaths, graphicPaths] = await Promise.all([
    fscResolveStoragePaths(supabase, FSC_STORAGE_OWNER_TYPES.FSC_LOGO, logoIds, 'approval'),
    fscResolveStoragePaths(supabase, FSC_STORAGE_OWNER_TYPES.FSC_LOGO, logoIds, 'graphic'),
  ])

  return logos.map((logo) => ({
    ...logo,
    approval_file_path: approvalPaths.get(logo.id) ?? null,
    graphic_file_path: graphicPaths.get(logo.id) ?? null,
  }))
}

export async function getFscLogo(
  logoId: string
): Promise<{ success: boolean; data?: FscLogo; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const logos = await listFscLogos()
  const logo = logos.find((l) => l.id === logoId)
  if (!logo) return { success: false, error: 'Logo non trovato' }

  return { success: true, data: logo }
}

export async function createFscLogo(
  input: FscLogoInput
): Promise<{ success: boolean; data?: FscLogo; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_logos')
    .insert({
      company_id: ctx.data.companyId,
      logo_type: input.logo_type,
      notes: input.notes?.trim() || null,
      progressive_code: '',
      created_by: ctx.data.userId,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Errore creazione logo' }
  }

  revalidateLogos()
  return { success: true, data: data as FscLogo }
}

export async function updateFscLogo(
  logoId: string,
  input: Pick<FscLogoInput, 'notes'>
): Promise<{ success: boolean; data?: FscLogo; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const owned = await verifyLogoOwnership(logoId, ctx.data.companyId)
  if (!owned) return { success: false, error: 'Logo non trovato' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_logos')
    .update({ notes: input.notes?.trim() || null })
    .eq('id', logoId)
    .eq('company_id', ctx.data.companyId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Errore aggiornamento logo' }
  }

  revalidateLogos()
  return { success: true, data: data as FscLogo }
}

export async function deleteFscLogo(
  logoId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const logo = await verifyLogoOwnership(logoId, ctx.data.companyId)
  if (!logo) return { success: false, error: 'Logo non trovato' }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  await fileService.deleteFilesByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_LOGO,
    logoId,
    ctx.data.companyId
  )

  const { error } = await supabase
    .from('fsc_logos')
    .delete()
    .eq('id', logoId)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  revalidateLogos()
  return { success: true }
}

export async function prepareFscLogoFileUpload(
  input: PrepareFscLogoFileUploadInput
): Promise<{ success: boolean; storagePath?: string; storageObjectId?: string; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const fileErr = validateFscLogoFileMetadata(input.fileKind, {
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  })
  if (fileErr) return { success: false, error: fileErr }

  const logo = await verifyLogoOwnership(input.logoId, ctx.data.companyId)
  if (!logo) return { success: false, error: 'Logo non trovato' }

  const slot = slotForKind(input.fileKind)
  const storageObjectId = crypto.randomUUID()
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const { domain, entityId } = buildFscLogoDomainPath(input.logoId)

  const existing = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_LOGO,
    input.logoId,
    slot
  )
  if (existing) {
    await fileService.deleteFile(existing.storageObjectId, ctx.data.companyId)
  }

  const prepared = await fileService.prepareUpload({
    companyId: ctx.data.companyId,
    domain,
    entityId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    createdBy: ctx.data.userId,
    ownerType: FSC_STORAGE_OWNER_TYPES.FSC_LOGO,
    ownerId: input.logoId,
    slot,
    storageObjectId,
  })

  if (!prepared.success) {
    return { success: false, error: prepared.error }
  }

  return { success: true, storagePath: prepared.data.storagePath, storageObjectId }
}

export async function abortFscLogoFileUpload(
  logoId: string,
  fileKind: FscLogoFileKind,
  storageObjectId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  await fileService.abortUpload(storageObjectId, ctx.data.companyId)

  return { success: true }
}

export async function finalizeFscLogoFileUpload(
  logoId: string,
  fileKind: FscLogoFileKind,
  storageObjectId: string,
  meta?: { fileName: string; mimeType: string; size: number }
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const owned = await verifyLogoOwnership(logoId, ctx.data.companyId)
  if (!owned) return { success: false, error: 'Logo non trovato' }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const finalized = await fileService.finalizeUpload(storageObjectId, ctx.data.companyId, {
    mimeType: meta?.mimeType,
    sizeBytes: meta?.size,
  })

  if (!finalized.success) {
    return { success: false, error: finalized.error }
  }

  revalidateLogos()
  return { success: true }
}

export async function getFscLogoFileDownloadUrl(
  logoId: string,
  fileKind: FscLogoFileKind
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const logo = await verifyLogoOwnership(logoId, ctx.data.companyId)
  if (!logo) return { success: false, error: 'Logo non trovato' }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const slot = slotForKind(fileKind)
  const resolved = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_LOGO,
    logoId,
    slot
  )

  if (!resolved?.storageObjectId) {
    return { success: false, error: 'File non disponibile' }
  }

  const dl = await fileService.getDownloadUrl(resolved.storageObjectId, ctx.data.companyId)
  if (!dl.success) return { success: false, error: dl.error }

  return { success: true, url: dl.url }
}

export async function clearFscLogoFile(
  logoId: string,
  fileKind: FscLogoFileKind
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const logo = await verifyLogoOwnership(logoId, ctx.data.companyId)
  if (!logo) return { success: false, error: 'Logo non trovato' }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const slot = slotForKind(fileKind)
  const resolved = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_LOGO,
    logoId,
    slot
  )

  if (resolved?.storageObjectId) {
    await fileService.deleteFile(resolved.storageObjectId, ctx.data.companyId)
  }

  revalidateLogos()
  return { success: true }
}
