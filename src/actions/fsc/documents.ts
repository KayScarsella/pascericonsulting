'use server'

import { getCurrentFscCompany } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import {
  getFscModulePath,
  isFscModuleCategorySlug,
  type FscDocumentModuleSlug,
  type FscGestioneCategorySlug,
} from '@/lib/fsc/constants'
import {
  validateFscDocumentFileMetadata,
} from '@/lib/fsc/documents-upload'
import {
  buildFscDocumentDomainPath,
  createFscFileService,
  FSC_STORAGE_OWNER_TYPES,
  FSC_STORAGE_SLOTS,
} from '@/lib/fsc/file-service'
import { fscResolveStoragePaths } from '@/lib/fsc/file-service/resolve'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscDocument, FscGestioneDocument } from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const FSC_ENTE_MIN_YEAR = 2000

async function resolveDocumentStoragePath(
  documentId: string
): Promise<string | null> {
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const resolved = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    documentId,
    FSC_STORAGE_SLOTS.PRIMARY
  )
  return resolved?.storagePath ?? null
}

async function deleteDocumentStorage(documentId: string, companyId: string): Promise<void> {
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const resolved = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    documentId,
    FSC_STORAGE_SLOTS.PRIMARY
  )
  if (resolved) {
    await fileService.deleteFile(resolved.storageObjectId, companyId)
  }
}

type EditorContext = {
  companyId: string
  userId: string
  canEdit: boolean
}

async function requireFscContext(): Promise<
  { success: true; data: EditorContext } | { success: false; error: string }
> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) {
    return { success: false, error: ctx.error ?? 'Impresa FSC non disponibile' }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  return {
    success: true,
    data: {
      companyId: ctx.data.company.id,
      userId: userData.user.id,
      canEdit: ctx.data.membership.can_edit,
    },
  }
}

function assertCanEdit(ctx: EditorContext): string | null {
  if (!ctx.canEdit) return 'Permesso di modifica non disponibile'
  return null
}

async function getFscDocument(
  documentId: string,
  companyId: string,
  module: FscDocumentModuleSlug
): Promise<FscDocument | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_documents')
    .select('*')
    .eq('id', documentId)
    .eq('company_id', companyId)
    .eq('module', module)
    .maybeSingle()

  if (error) {
    console.error('getFscDocument:', error)
    return null
  }
  return data as FscDocument | null
}

function getVersionRootId(doc: FscDocument): string {
  return doc.parent_document_id ?? doc.id
}

function validateEnteYear(year: number | null | undefined): string | null {
  if (year === null || year === undefined) {
    return 'Anno di riferimento obbligatorio'
  }
  const maxYear = new Date().getFullYear() + 1
  if (!Number.isInteger(year) || year < FSC_ENTE_MIN_YEAR || year > maxYear) {
    return `Anno di riferimento non valido (${FSC_ENTE_MIN_YEAR}–${maxYear})`
  }
  return null
}

// --- Implementazioni generiche per modulo ---

async function listDocumentsForModule(
  module: FscDocumentModuleSlug,
  category?: string,
  year?: number
): Promise<FscGestioneDocument[]> {
  const ctx = await requireFscContext()
  if (!ctx.success) return []

  if (category && !isFscModuleCategorySlug(module, category)) return []

  const supabase = await createClient()
  let query = supabase
    .from('fsc_documents')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .eq('module', module)
    .eq('status', 'active')

  if (module === 'ente') {
    query = query
      .order('reference_year', { ascending: false, nullsFirst: false })
      .order('name', { ascending: true })
  } else {
    query = query.order('name', { ascending: true })
  }

  if (category) {
    query = query.eq('category', category)
  }
  if (year !== undefined) {
    query = query.eq('reference_year', year)
  }

  const { data: activeDocs, error } = await query
  if (error) {
    console.error('listDocumentsForModule:', error)
    return []
  }

  const docs = (activeDocs ?? []) as FscDocument[]
  if (docs.length === 0) return []

  const filePaths = await fscResolveStoragePaths(
    supabase,
    FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    docs.map((d) => d.id)
  )

  const rootIds = [...new Set(docs.map(getVersionRootId))]

  const { data: allVersions } = await supabase
    .from('fsc_documents')
    .select('id, parent_document_id, version, status')
    .eq('company_id', ctx.data.companyId)
    .eq('module', module)

  const versionCountByRoot = new Map<string, number>()
  for (const row of allVersions ?? []) {
    const r = row as Pick<FscDocument, 'id' | 'parent_document_id'>
    const root = r.parent_document_id ?? r.id
    if (rootIds.includes(root)) {
      versionCountByRoot.set(root, (versionCountByRoot.get(root) ?? 0) + 1)
    }
  }

  return docs.map((doc) => ({
    ...doc,
    version_count: versionCountByRoot.get(getVersionRootId(doc)) ?? 1,
    has_file: filePaths.has(doc.id),
  }))
}

async function listVersionsForModule(
  module: FscDocumentModuleSlug,
  documentId: string
): Promise<FscDocument[]> {
  const ctx = await requireFscContext()
  if (!ctx.success) return []

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc) return []

  const rootId = getVersionRootId(doc)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('fsc_documents')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .eq('module', module)
    .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
    .order('version', { ascending: false })

  if (error) {
    console.error('listVersionsForModule:', error)
    return []
  }

  const versions = (data ?? []) as FscDocument[]
  const filePaths = await fscResolveStoragePaths(
    supabase,
    FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    versions.map((v) => v.id)
  )

  return versions.map((v) => ({ ...v, has_file: filePaths.has(v.id) }))
}

type PrepareUploadInputForModule = {
  category: string
  name: string
  expires_at?: string | null
  reviewed_at?: string | null
  reference_year?: number | null
  fileName: string
  fileSize: number
  mimeType: string
  parentDocumentId?: string | null
  version?: number
}

async function prepareUploadForModule(
  module: FscDocumentModuleSlug,
  input: PrepareUploadInputForModule
): Promise<{
  success: boolean
  documentId?: string
  storagePath?: string
  error?: string
}> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  if (!isFscModuleCategorySlug(module, input.category)) {
    return { success: false, error: 'Categoria non valida' }
  }

  if (module === 'ente') {
    const yearError = validateEnteYear(input.reference_year)
    if (yearError) return { success: false, error: yearError }
  }

  const validationError = validateFscDocumentFileMetadata({
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
  })
  if (validationError) return { success: false, error: validationError }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Nome documento obbligatorio' }

  const version = input.version ?? 1
  const supabase = await createClient()
  const fileService = createFscFileService(supabase)

  const documentId = crypto.randomUUID()
  const { domain, entityId } = buildFscDocumentDomainPath(
    module,
    input.category,
    documentId,
    version
  )

  const prepared = await fileService.prepareUpload({
    companyId: ctx.data.companyId,
    domain,
    entityId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    createdBy: ctx.data.userId,
    ownerType: FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    ownerId: documentId,
    slot: FSC_STORAGE_SLOTS.PRIMARY,
    storageObjectId: documentId,
  })

  if (!prepared.success) {
    return { success: false, error: prepared.error }
  }

  const storagePath = prepared.data.storagePath

  const { error } = await supabase.from('fsc_documents').insert({
    id: documentId,
    company_id: ctx.data.companyId,
    tool_id: CLOUD_FSC_TOOL_ID,
    module,
    category: input.category,
    name,
    reference_year: module === 'ente' ? (input.reference_year ?? null) : null,
    expires_at: input.expires_at ?? null,
    reviewed_at: input.reviewed_at ?? null,
    version,
    parent_document_id: input.parentDocumentId ?? null,
    status: 'active',
    created_by: ctx.data.userId,
  })

  if (error) {
    console.error('prepareUploadForModule:', error)
    await fileService.abortUpload(prepared.data.storageObjectId, ctx.data.companyId)
    return { success: false, error: error.message }
  }

  return { success: true, documentId, storagePath }
}

async function finalizeUploadForModule(
  module: FscDocumentModuleSlug,
  documentId: string,
  meta: { fileName: string; mimeType: string; size: number }
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc) {
    return { success: false, error: 'Documento non trovato' }
  }

  const validationError = validateFscDocumentFileMetadata({
    fileName: meta.fileName,
    fileSize: meta.size,
    mimeType: meta.mimeType,
  })
  if (validationError) return { success: false, error: validationError }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)

  const finalized = await fileService.finalizeUpload(documentId, ctx.data.companyId, {
    mimeType: meta.mimeType,
    sizeBytes: meta.size,
  })
  if (!finalized.success) {
    return { success: false, error: finalized.error }
  }

  const { error } = await supabase
    .from('fsc_documents')
    .update({
      mime_type: meta.mimeType || null,
      size: meta.size,
    })
    .eq('id', documentId)
    .eq('company_id', ctx.data.companyId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(getFscModulePath(module))
  return { success: true }
}

async function abortUploadForModule(
  module: FscDocumentModuleSlug,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc) return { success: true }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  await fileService.abortUpload(documentId, ctx.data.companyId)

  const { error } = await supabase
    .from('fsc_documents')
    .delete()
    .eq('id', documentId)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

async function prepareNewVersionForModule(
  module: FscDocumentModuleSlug,
  documentId: string,
  fileMeta: { fileName: string; fileSize: number; mimeType: string }
): Promise<{
  success: boolean
  documentId?: string
  storagePath?: string
  error?: string
}> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc || doc.status !== 'active') {
    return { success: false, error: 'Documento attivo non trovato' }
  }

  const supabase = await createClient()
  const { error: archiveError } = await supabase
    .from('fsc_documents')
    .update({ status: 'archived' })
    .eq('id', doc.id)
    .eq('company_id', ctx.data.companyId)

  if (archiveError) {
    return { success: false, error: archiveError.message }
  }

  const rootId = getVersionRootId(doc)
  return prepareUploadForModule(module, {
    category: doc.category,
    name: doc.name,
    expires_at: doc.expires_at,
    reviewed_at: doc.reviewed_at,
    reference_year: doc.reference_year,
    fileName: fileMeta.fileName,
    fileSize: fileMeta.fileSize,
    mimeType: fileMeta.mimeType,
    parentDocumentId: rootId,
    version: doc.version + 1,
  })
}

type UpdateMetadataFields = {
  name?: string
  expires_at?: string | null
  reviewed_at?: string | null
  reference_year?: number | null
}

async function updateMetadataForModule(
  module: FscDocumentModuleSlug,
  documentId: string,
  fields: UpdateMetadataFields
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc || doc.status !== 'active') {
    return { success: false, error: 'Documento non trovato' }
  }

  const updates: Record<string, string | number | null> = {}
  if (fields.name !== undefined) {
    const trimmed = fields.name.trim()
    if (!trimmed) return { success: false, error: 'Nome documento obbligatorio' }
    updates.name = trimmed
  }
  if (fields.expires_at !== undefined) updates.expires_at = fields.expires_at
  if (fields.reviewed_at !== undefined) updates.reviewed_at = fields.reviewed_at
  if (module === 'ente' && fields.reference_year !== undefined) {
    const yearError = validateEnteYear(fields.reference_year)
    if (yearError) return { success: false, error: yearError }
    updates.reference_year = fields.reference_year
  }

  if (Object.keys(updates).length === 0) {
    return { success: true }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_documents')
    .update(updates)
    .eq('id', documentId)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  revalidatePath(getFscModulePath(module))
  return { success: true }
}

async function hardDeleteDocumentForModule(
  module: FscDocumentModuleSlug,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editError = assertCanEdit(ctx.data)
  if (editError) return { success: false, error: editError }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc) return { success: false, error: 'Documento non trovato' }

  await deleteDocumentStorage(documentId, ctx.data.companyId)

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_documents')
    .delete()
    .eq('id', documentId)
    .eq('company_id', ctx.data.companyId)
    .eq('module', module)

  if (error) return { success: false, error: error.message }

  revalidatePath(getFscModulePath(module))
  return { success: true }
}

async function getDownloadUrlForModule(
  module: FscDocumentModuleSlug,
  documentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireFscContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const doc = await getFscDocument(documentId, ctx.data.companyId, module)
  if (!doc) {
    return { success: false, error: 'File non disponibile' }
  }

  const supabase = await createClient()
  const fileService = createFscFileService(supabase)
  const resolved = await fileService.getPathByOwner(
    FSC_STORAGE_OWNER_TYPES.FSC_DOCUMENT,
    documentId,
    FSC_STORAGE_SLOTS.PRIMARY
  )

  if (resolved) {
    const dl = await fileService.getDownloadUrl(resolved.storageObjectId, ctx.data.companyId)
    if (dl.success) return { success: true, url: dl.url }
  }

  return { success: false, error: 'File non disponibile' }
}

// --- Modulo 1: Documenti di gestione ---

export type PrepareFscGestioneUploadInput = {
  category: FscGestioneCategorySlug
  name: string
  expires_at?: string | null
  reviewed_at?: string | null
  fileName: string
  fileSize: number
  mimeType: string
  parentDocumentId?: string | null
  version?: number
}

export async function listFscGestioneDocuments(
  category?: string
): Promise<FscGestioneDocument[]> {
  return listDocumentsForModule('gestione', category)
}

export async function listFscDocumentVersions(
  documentId: string
): Promise<FscDocument[]> {
  return listVersionsForModule('gestione', documentId)
}

export async function prepareFscGestioneUpload(input: PrepareFscGestioneUploadInput) {
  return prepareUploadForModule('gestione', input)
}

export async function finalizeFscGestioneUpload(
  documentId: string,
  meta: { fileName: string; mimeType: string; size: number }
) {
  return finalizeUploadForModule('gestione', documentId, meta)
}

export async function abortFscGestioneUpload(documentId: string) {
  return abortUploadForModule('gestione', documentId)
}

export async function prepareFscGestioneNewVersion(
  documentId: string,
  fileMeta: { fileName: string; fileSize: number; mimeType: string }
) {
  return prepareNewVersionForModule('gestione', documentId, fileMeta)
}

export async function updateFscGestioneMetadata(
  documentId: string,
  fields: { name?: string; expires_at?: string | null; reviewed_at?: string | null }
) {
  return updateMetadataForModule('gestione', documentId, fields)
}

export async function deleteFscGestioneDocument(documentId: string) {
  return hardDeleteDocumentForModule('gestione', documentId)
}

/** @deprecated Use deleteFscGestioneDocument */
export async function archiveFscGestioneDocument(documentId: string) {
  return deleteFscGestioneDocument(documentId)
}

export async function getFscGestioneDownloadUrl(documentId: string) {
  return getDownloadUrlForModule('gestione', documentId)
}

// --- Modulo 2: Documenti di interscambio con l'ente ---

export type PrepareFscEnteUploadInput = {
  category: string
  name: string
  reference_year: number
  expires_at?: string | null
  fileName: string
  fileSize: number
  mimeType: string
}

export async function listFscEnteDocuments(
  category?: string,
  year?: number
): Promise<FscGestioneDocument[]> {
  return listDocumentsForModule('ente', category, year)
}

export async function listFscEnteYears(): Promise<number[]> {
  const ctx = await requireFscContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_documents')
    .select('reference_year')
    .eq('company_id', ctx.data.companyId)
    .eq('module', 'ente')
    .eq('status', 'active')
    .not('reference_year', 'is', null)

  if (error) {
    console.error('listFscEnteYears:', error)
    return []
  }

  const years = [
    ...new Set((data ?? []).map((r) => r.reference_year as number)),
  ]
  return years.sort((a, b) => b - a)
}

export async function listFscEnteDocumentVersions(
  documentId: string
): Promise<FscDocument[]> {
  return listVersionsForModule('ente', documentId)
}

export async function prepareFscEnteUpload(input: PrepareFscEnteUploadInput) {
  return prepareUploadForModule('ente', input)
}

export async function finalizeFscEnteUpload(
  documentId: string,
  meta: { fileName: string; mimeType: string; size: number }
) {
  return finalizeUploadForModule('ente', documentId, meta)
}

export async function abortFscEnteUpload(documentId: string) {
  return abortUploadForModule('ente', documentId)
}

export async function prepareFscEnteNewVersion(
  documentId: string,
  fileMeta: { fileName: string; fileSize: number; mimeType: string }
) {
  return prepareNewVersionForModule('ente', documentId, fileMeta)
}

export async function updateFscEnteMetadata(
  documentId: string,
  fields: {
    name?: string
    expires_at?: string | null
    reference_year?: number | null
  }
) {
  return updateMetadataForModule('ente', documentId, fields)
}

export async function deleteFscEnteDocument(documentId: string) {
  return hardDeleteDocumentForModule('ente', documentId)
}

/** @deprecated Use deleteFscEnteDocument */
export async function archiveFscEnteDocument(documentId: string) {
  return deleteFscEnteDocument(documentId)
}

export async function getFscEnteDownloadUrl(documentId: string) {
  return getDownloadUrlForModule('ente', documentId)
}
