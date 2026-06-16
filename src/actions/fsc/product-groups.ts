'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { createFscDocumentSignedUrls } from '@/lib/fsc/documents-download'
import { validateFscDocumentFileMetadata } from '@/lib/fsc/documents-upload'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import {
  buildFscProductGroupAddendumPath,
  createEmptyAddendumMetadata,
  FSC_PRODUCT_GROUPS_PATH,
} from '@/lib/fsc/product-groups'
import { requireToolAdmin } from '@/lib/tool-auth'
import type {
  FscCompanyProductGroup,
  FscCompanyProductGroupWithDetails,
  FscProductClaim,
  FscProductGroupAddendum,
  FscProductGroupAddendumMetadata,
  FscProductGroupCatalog,
  FscSpeciesOption,
} from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const FSC_BUCKET = 'fsc-documents'

export type FscProductGroupCatalogInput = {
  code?: string | null
  name: string
  keywords?: string | null
  is_active?: boolean
}

export type FscCompanyProductGroupInput = {
  catalog_group_id?: string | null
  custom_label?: string | null
  species_id?: string | null
  required_inputs?: string | null
  claims?: FscProductClaim[]
}

export type FscCompanyProductGroupListFilters = {
  search?: string
  status?: 'active' | 'inactive' | 'all'
}

export type FscProductGroupCatalogAdminResult = {
  official: FscProductGroupCatalog[]
  unofficial: FscProductGroupCatalog[]
}

export type PrepareFscProductGroupAddendumUploadInput = {
  companyProductGroupId: string
  addendumId: string
  fileName: string
  fileSize: number
  mimeType: string
}

function revalidateProductGroups(): void {
  revalidatePath(FSC_PRODUCT_GROUPS_PATH)
}

async function syncCompanyProductGroupClaims(
  groupId: string,
  claims: FscProductClaim[]
): Promise<string | null> {
  const supabase = await createClient()
  const unique = [...new Set(claims)]

  const { error: deleteError } = await supabase
    .from('fsc_company_product_group_claims')
    .delete()
    .eq('company_product_group_id', groupId)

  if (deleteError) return deleteError.message

  if (unique.length === 0) return null

  const { error: insertError } = await supabase.from('fsc_company_product_group_claims').insert(
    unique.map((claim) => ({ company_product_group_id: groupId, claim }))
  )

  return insertError?.message ?? null
}

async function verifyCompanyProductGroupOwnership(
  groupId: string,
  companyId: string
): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fsc_company_product_groups')
    .select('id')
    .eq('id', groupId)
    .eq('company_id', companyId)
    .maybeSingle()
  return !!data
}

async function enrichCompanyProductGroups(
  rows: FscCompanyProductGroup[]
): Promise<FscCompanyProductGroupWithDetails[]> {
  if (rows.length === 0) return []

  const supabase = await createClient()
  const ids = rows.map((r) => r.id)
  const catalogIds = [...new Set(rows.map((r) => r.catalog_group_id).filter(Boolean))] as string[]
  const speciesIds = [...new Set(rows.map((r) => r.species_id).filter(Boolean))] as string[]

  const [claimsRes, addendaRes, catalogRes, speciesRes] = await Promise.all([
    supabase
      .from('fsc_company_product_group_claims')
      .select('company_product_group_id, claim')
      .in('company_product_group_id', ids),
    supabase.from('fsc_product_group_addenda').select('*').in('company_product_group_id', ids),
    catalogIds.length > 0
      ? supabase.from('fsc_product_groups_catalog').select('*').in('id', catalogIds)
      : Promise.resolve({ data: [] as FscProductGroupCatalog[] }),
    speciesIds.length > 0
      ? supabase.from('species').select('id, common_name, scientific_name').in('id', speciesIds)
      : Promise.resolve({ data: [] as FscSpeciesOption[] }),
  ])

  const catalogById = new Map((catalogRes.data ?? []).map((c) => [c.id, c as FscProductGroupCatalog]))
  const speciesById = new Map((speciesRes.data ?? []).map((s) => [s.id, s as FscSpeciesOption]))

  const claimsByGroup = new Map<string, FscProductClaim[]>()
  for (const row of claimsRes.data ?? []) {
    const list = claimsByGroup.get(row.company_product_group_id) ?? []
    list.push(row.claim as FscProductClaim)
    claimsByGroup.set(row.company_product_group_id, list)
  }

  const addendaByGroup = new Map<string, FscProductGroupAddendum[]>()
  for (const row of addendaRes.data ?? []) {
    const list = addendaByGroup.get(row.company_product_group_id) ?? []
    list.push({
      ...row,
      metadata: (row.metadata ?? {}) as FscProductGroupAddendumMetadata,
    } as FscProductGroupAddendum)
    addendaByGroup.set(row.company_product_group_id, list)
  }

  return rows.map((row) => ({
    ...row,
    catalog: row.catalog_group_id ? (catalogById.get(row.catalog_group_id) ?? null) : null,
    species: row.species_id ? (speciesById.get(row.species_id) ?? null) : null,
    claims: claimsByGroup.get(row.id) ?? [],
    addenda: addendaByGroup.get(row.id) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Catalog (read for company users)
// ---------------------------------------------------------------------------

export async function searchFscProductGroupsCatalog(
  q?: string
): Promise<FscProductGroupCatalog[]> {
  await requireFscPartnerContext()

  const supabase = await createClient()
  let query = supabase
    .from('fsc_product_groups_catalog')
    .select('*')
    .eq('is_active', true)
    .order('name')

  const { data, error } = await query
  if (error) {
    console.error('searchFscProductGroupsCatalog:', error)
    return []
  }

  let rows = (data ?? []) as FscProductGroupCatalog[]
  if (q?.trim()) {
    const term = q.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.code?.toLowerCase().includes(term) ?? false) ||
        (r.keywords?.toLowerCase().includes(term) ?? false)
    )
  }

  return rows
}

export async function listFscOfficialProductGroupsCatalog(): Promise<FscProductGroupCatalog[]> {
  await requireFscPartnerContext()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_product_groups_catalog')
    .select('*')
    .eq('is_active', true)
    .not('code', 'is', null)
    .order('code')

  if (error) {
    console.error('listFscOfficialProductGroupsCatalog:', error)
    return []
  }

  return (data ?? []) as FscProductGroupCatalog[]
}

// ---------------------------------------------------------------------------
// Catalog admin
// ---------------------------------------------------------------------------

export async function listFscProductGroupsCatalogAdmin(): Promise<{
  success: boolean
  data?: FscProductGroupCatalogAdminResult
  error?: string
}> {
  try {
    await requireToolAdmin(CLOUD_FSC_TOOL_ID)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fsc_product_groups_catalog')
      .select('*')
      .order('name')

    if (error) return { success: false, error: error.message }

    const rows = (data ?? []) as FscProductGroupCatalog[]
    return {
      success: true,
      data: {
        official: rows.filter((r) => r.code != null && r.code.trim() !== ''),
        unofficial: rows.filter((r) => r.code == null || r.code.trim() === ''),
      },
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function createFscProductGroupCatalog(
  input: FscProductGroupCatalogInput,
  isOfficial: boolean
): Promise<{ success: boolean; data?: FscProductGroupCatalog; error?: string }> {
  try {
    await requireToolAdmin(CLOUD_FSC_TOOL_ID)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Non autorizzato' }
  }

  if (!input.name.trim()) {
    return { success: false, error: 'Nome obbligatorio' }
  }

  const code = isOfficial ? input.code?.trim() || null : null
  if (isOfficial && !code) {
    return { success: false, error: 'Codice FSC obbligatorio per gruppi ufficiali' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_product_groups_catalog')
    .insert({
      code,
      name: input.name.trim(),
      keywords: input.keywords?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Errore creazione catalogo' }
  }

  revalidatePath(FSC_PRODUCT_GROUPS_PATH)
  return { success: true, data: data as FscProductGroupCatalog }
}

export async function updateFscProductGroupCatalog(
  id: string,
  input: FscProductGroupCatalogInput,
  isOfficial: boolean
): Promise<{ success: boolean; data?: FscProductGroupCatalog; error?: string }> {
  try {
    await requireToolAdmin(CLOUD_FSC_TOOL_ID)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Non autorizzato' }
  }

  if (!input.name.trim()) {
    return { success: false, error: 'Nome obbligatorio' }
  }

  const code = isOfficial ? input.code?.trim() || null : null
  if (isOfficial && !code) {
    return { success: false, error: 'Codice FSC obbligatorio per gruppi ufficiali' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_product_groups_catalog')
    .update({
      code,
      name: input.name.trim(),
      keywords: input.keywords?.trim() || null,
      is_active: input.is_active ?? true,
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Errore aggiornamento catalogo' }
  }

  revalidatePath(FSC_PRODUCT_GROUPS_PATH)
  return { success: true, data: data as FscProductGroupCatalog }
}

export async function deleteFscProductGroupCatalog(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(CLOUD_FSC_TOOL_ID)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Non autorizzato' }
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from('fsc_company_product_groups')
    .select('id', { count: 'exact', head: true })
    .eq('catalog_group_id', id)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Impossibile eliminare: il gruppo è usato da una o più aziende',
    }
  }

  const { error } = await supabase.from('fsc_product_groups_catalog').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath(FSC_PRODUCT_GROUPS_PATH)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Company product groups
// ---------------------------------------------------------------------------

export async function listFscCompanyProductGroups(
  filters?: FscCompanyProductGroupListFilters
): Promise<FscCompanyProductGroupWithDetails[]> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  let query = supabase
    .from('fsc_company_product_groups')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .order('activated_at', { ascending: false })

  if (filters?.status === 'active') {
    query = query.eq('is_active', true)
  } else if (filters?.status === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data, error } = await query
  if (error) {
    console.error('listFscCompanyProductGroups:', error)
    return []
  }

  let rows = (data ?? []) as FscCompanyProductGroup[]
  const enriched = await enrichCompanyProductGroups(rows)

  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    return enriched.filter((g) => {
      const name = g.catalog?.name ?? g.custom_label ?? ''
      const code = g.catalog?.code ?? ''
      return (
        name.toLowerCase().includes(term) ||
        code.toLowerCase().includes(term) ||
        (g.required_inputs?.toLowerCase().includes(term) ?? false)
      )
    })
  }

  return enriched
}

export async function getFscCompanyProductGroup(
  id: string
): Promise<{ success: boolean; data?: FscCompanyProductGroupWithDetails; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_company_product_groups')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Gruppo non trovato' }
  }

  const [enriched] = await enrichCompanyProductGroups([data as FscCompanyProductGroup])
  return { success: true, data: enriched }
}

export async function createFscCompanyProductGroup(
  input: FscCompanyProductGroupInput
): Promise<{ success: boolean; data?: FscCompanyProductGroupWithDetails; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const catalogId = input.catalog_group_id?.trim() || null
  const customLabel = input.custom_label?.trim() || null

  if (!catalogId && !customLabel) {
    return { success: false, error: 'Seleziona un gruppo dal catalogo o inserisci un nome personalizzato' }
  }
  if (catalogId && customLabel) {
    return { success: false, error: 'Usa catalogo oppure nome personalizzato, non entrambi' }
  }

  const supabase = await createClient()

  if (catalogId) {
    const { data: catalog } = await supabase
      .from('fsc_product_groups_catalog')
      .select('id, is_active')
      .eq('id', catalogId)
      .maybeSingle()

    if (!catalog?.is_active) {
      return { success: false, error: 'Gruppo catalogo non trovato o non attivo' }
    }
  }

  const { data: group, error } = await supabase
    .from('fsc_company_product_groups')
    .insert({
      company_id: ctx.data.companyId,
      catalog_group_id: catalogId,
      custom_label: customLabel,
      species_id: input.species_id || null,
      required_inputs: input.required_inputs?.trim() || null,
      is_active: true,
    })
    .select()
    .single()

  if (error || !group) {
    if (error?.code === '23505') {
      return { success: false, error: 'Questo gruppo FSC è già attivo per la tua azienda' }
    }
    return { success: false, error: error?.message ?? 'Errore creazione gruppo' }
  }

  const claimsErr = await syncCompanyProductGroupClaims(group.id, input.claims ?? [])
  if (claimsErr) return { success: false, error: claimsErr }

  const { error: addendumError } = await supabase.from('fsc_product_group_addenda').insert({
    company_product_group_id: group.id,
    metadata: createEmptyAddendumMetadata(),
  })

  if (addendumError) {
    return { success: false, error: addendumError.message }
  }

  revalidateProductGroups()
  const detail = await getFscCompanyProductGroup(group.id)
  return { success: true, data: detail.data }
}

export async function updateFscCompanyProductGroup(
  id: string,
  input: FscCompanyProductGroupInput
): Promise<{ success: boolean; data?: FscCompanyProductGroupWithDetails; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('fsc_company_product_groups')
    .select('catalog_group_id, custom_label')
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Gruppo non trovato' }

  const { data: group, error } = await supabase
    .from('fsc_company_product_groups')
    .update({
      species_id: input.species_id || null,
      required_inputs: input.required_inputs?.trim() || null,
    })
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .select()
    .single()

  if (error || !group) {
    return { success: false, error: error?.message ?? 'Errore aggiornamento gruppo' }
  }

  const claimsErr = await syncCompanyProductGroupClaims(id, input.claims ?? [])
  if (claimsErr) return { success: false, error: claimsErr }

  revalidateProductGroups()
  const detail = await getFscCompanyProductGroup(id)
  return { success: true, data: detail.data }
}

export async function setFscCompanyProductGroupActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const updatePayload: { is_active: boolean; activated_at?: string } = { is_active: isActive }
  if (isActive) {
    updatePayload.activated_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('fsc_company_product_groups')
    .update(updatePayload)
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  revalidateProductGroups()
  return { success: true }
}

export async function deleteFscCompanyProductGroup(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()

  const { data: addenda } = await supabase
    .from('fsc_product_group_addenda')
    .select('storage_path')
    .eq('company_product_group_id', id)

  const paths = (addenda ?? [])
    .map((a) => a.storage_path)
    .filter((p): p is string => !!p)

  if (paths.length > 0) {
    await supabase.storage.from(FSC_BUCKET).remove(paths)
  }

  const { error } = await supabase
    .from('fsc_company_product_groups')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)

  if (error) return { success: false, error: error.message }

  revalidateProductGroups()
  return { success: true }
}

// ---------------------------------------------------------------------------
// Addendum
// ---------------------------------------------------------------------------

export async function updateFscProductGroupAddendumMetadata(
  addendumId: string,
  metadata: FscProductGroupAddendumMetadata
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { data: addendum } = await supabase
    .from('fsc_product_group_addenda')
    .select('company_product_group_id')
    .eq('id', addendumId)
    .maybeSingle()

  if (!addendum) return { success: false, error: 'Addendum non trovato' }

  const owned = await verifyCompanyProductGroupOwnership(
    addendum.company_product_group_id,
    ctx.data.companyId
  )
  if (!owned) return { success: false, error: 'Addendum non trovato' }

  const { error } = await supabase
    .from('fsc_product_group_addenda')
    .update({ metadata })
    .eq('id', addendumId)

  if (error) return { success: false, error: error.message }

  revalidateProductGroups()
  return { success: true }
}

export async function prepareFscProductGroupAddendumUpload(
  input: PrepareFscProductGroupAddendumUploadInput
): Promise<{ success: boolean; storagePath?: string; error?: string }> {
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

  const owned = await verifyCompanyProductGroupOwnership(
    input.companyProductGroupId,
    ctx.data.companyId
  )
  if (!owned) return { success: false, error: 'Gruppo non trovato' }

  const storagePath = buildFscProductGroupAddendumPath(
    ctx.data.companyId,
    input.companyProductGroupId,
    input.addendumId,
    input.fileName
  )

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_product_group_addenda')
    .update({ storage_path: storagePath })
    .eq('id', input.addendumId)
    .eq('company_product_group_id', input.companyProductGroupId)

  if (error) return { success: false, error: error.message }

  return { success: true, storagePath }
}

export async function finalizeFscProductGroupAddendumUpload(
  addendumId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  revalidateProductGroups()
  return { success: true }
}

export async function getFscProductGroupAddendumDownloadUrl(
  addendumId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const { data: addendum } = await supabase
    .from('fsc_product_group_addenda')
    .select('*')
    .eq('id', addendumId)
    .maybeSingle()

  if (!addendum?.storage_path) {
    return { success: false, error: 'File addendum non disponibile' }
  }

  const owned = await verifyCompanyProductGroupOwnership(
    addendum.company_product_group_id,
    ctx.data.companyId
  )
  if (!owned) return { success: false, error: 'Addendum non trovato' }

  const urls = await createFscDocumentSignedUrls(supabase, [addendum.storage_path])
  const url = urls[addendum.storage_path]
  if (!url) return { success: false, error: 'Impossibile generare URL di download' }

  return { success: true, url }
}

export async function deleteFscProductGroupAddendumFile(
  addendumId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { data: addendum } = await supabase
    .from('fsc_product_group_addenda')
    .select('*')
    .eq('id', addendumId)
    .maybeSingle()

  if (!addendum) return { success: false, error: 'Addendum non trovato' }

  const owned = await verifyCompanyProductGroupOwnership(
    addendum.company_product_group_id,
    ctx.data.companyId
  )
  if (!owned) return { success: false, error: 'Addendum non trovato' }

  if (addendum.storage_path) {
    await supabase.storage.from(FSC_BUCKET).remove([addendum.storage_path])
  }

  const { error } = await supabase
    .from('fsc_product_group_addenda')
    .update({ storage_path: null })
    .eq('id', addendumId)

  if (error) return { success: false, error: error.message }

  revalidateProductGroups()
  return { success: true }
}

// ---------------------------------------------------------------------------
// Species select
// ---------------------------------------------------------------------------

export async function listSpeciesForFscSelect(): Promise<FscSpeciesOption[]> {
  await requireFscPartnerContext()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('species')
    .select('id, common_name, scientific_name')
    .order('common_name')

  if (error) {
    console.error('listSpeciesForFscSelect:', error)
    return []
  }

  return (data ?? []) as FscSpeciesOption[]
}
