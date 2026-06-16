'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import { FSC_SUPPLIERS_PATH } from '@/lib/fsc/partners'
import type {
  FscProductClaim,
  FscSupplier,
  FscSupplierStatus,
  FscSupplierWithDetails,
} from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FscSupplierInput = {
  ragione_sociale: string
  certificate_number?: string | null
  certificate_valid_until?: string | null
  last_control_date?: string | null
  control_frequency?: 'annual' | 'semiannual'
  status?: FscSupplierStatus
  claims?: FscProductClaim[]
}

export type FscSupplierListFilters = {
  search?: string
  status?: FscSupplierStatus | 'all'
}

function revalidateSuppliers(): void {
  revalidatePath(FSC_SUPPLIERS_PATH)
}

async function syncSupplierClaims(
  supplierId: string,
  claims: FscProductClaim[]
): Promise<string | null> {
  const supabase = await createClient()
  const unique = [...new Set(claims)].slice(0, 2)

  const { error: deleteError } = await supabase
    .from('fsc_supplier_product_claims')
    .delete()
    .eq('supplier_id', supplierId)

  if (deleteError) return deleteError.message

  if (unique.length === 0) return null

  const { error: insertError } = await supabase.from('fsc_supplier_product_claims').insert(
    unique.map((claim) => ({ supplier_id: supplierId, claim }))
  )

  return insertError?.message ?? null
}

async function enrichSuppliers(
  rows: FscSupplier[]
): Promise<FscSupplierWithDetails[]> {
  if (rows.length === 0) return []

  const supabase = await createClient()
  const ids = rows.map((r) => r.id)

  const [claimsRes, attachmentsRes] = await Promise.all([
    supabase.from('fsc_supplier_product_claims').select('supplier_id, claim').in('supplier_id', ids),
    supabase.from('fsc_supplier_attachments').select('*').in('supplier_id', ids),
  ])

  const claimsBySupplier = new Map<string, FscProductClaim[]>()
  for (const row of claimsRes.data ?? []) {
    const list = claimsBySupplier.get(row.supplier_id) ?? []
    list.push(row.claim as FscProductClaim)
    claimsBySupplier.set(row.supplier_id, list)
  }

  const attachmentsBySupplier = new Map<string, FscSupplierWithDetails['attachments']>()
  for (const row of attachmentsRes.data ?? []) {
    const list = attachmentsBySupplier.get(row.supplier_id) ?? []
    list.push(row as FscSupplierWithDetails['attachments'][number])
    attachmentsBySupplier.set(row.supplier_id, list)
  }

  return rows.map((row) => ({
    ...row,
    claims: claimsBySupplier.get(row.id) ?? [],
    attachments: attachmentsBySupplier.get(row.id) ?? [],
  }))
}

export async function listFscSuppliers(
  filters?: FscSupplierListFilters
): Promise<FscSupplierWithDetails[]> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  let query = supabase
    .from('fsc_suppliers')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .order('ragione_sociale')

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) {
    console.error('listFscSuppliers:', error)
    return []
  }

  let rows = (data ?? []) as FscSupplier[]
  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.ragione_sociale.toLowerCase().includes(term) ||
        (r.certificate_number?.toLowerCase().includes(term) ?? false)
    )
  }

  return enrichSuppliers(rows)
}

export async function getFscSupplier(
  id: string
): Promise<{ success: boolean; data?: FscSupplierWithDetails; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_suppliers')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Fornitore non trovato' }
  }

  const [enriched] = await enrichSuppliers([data as FscSupplier])

  const { data: history } = await supabase
    .from('fsc_supplier_status_history')
    .select('*')
    .eq('supplier_id', id)
    .order('changed_at', { ascending: false })

  return {
    success: true,
    data: { ...enriched, status_history: history ?? [] },
  }
}

export async function createFscSupplier(
  input: FscSupplierInput
): Promise<{ success: boolean; data?: FscSupplier; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  if (!input.ragione_sociale.trim()) {
    return { success: false, error: 'Ragione sociale obbligatoria' }
  }

  const supabase = await createClient()
  const { data: supplier, error } = await supabase
    .from('fsc_suppliers')
    .insert({
      company_id: ctx.data.companyId,
      ragione_sociale: input.ragione_sociale.trim(),
      certificate_number: input.certificate_number?.trim() || null,
      certificate_valid_until: input.certificate_valid_until || null,
      last_control_date: input.last_control_date || null,
      control_frequency: input.control_frequency ?? 'annual',
      status: input.status ?? 'active',
    })
    .select()
    .single()

  if (error || !supplier) {
    return { success: false, error: error?.message ?? 'Errore creazione fornitore' }
  }

  const claimsErr = await syncSupplierClaims(supplier.id, input.claims ?? [])
  if (claimsErr) {
    return { success: false, error: claimsErr }
  }

  revalidateSuppliers()
  return { success: true, data: supplier as FscSupplier }
}

export async function updateFscSupplier(
  id: string,
  input: FscSupplierInput
): Promise<{ success: boolean; data?: FscSupplier; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  if (!input.ragione_sociale.trim()) {
    return { success: false, error: 'Ragione sociale obbligatoria' }
  }

  const supabase = await createClient()
  const { data: supplier, error } = await supabase
    .from('fsc_suppliers')
    .update({
      ragione_sociale: input.ragione_sociale.trim(),
      certificate_number: input.certificate_number?.trim() || null,
      certificate_valid_until: input.certificate_valid_until || null,
      last_control_date: input.last_control_date || null,
      control_frequency: input.control_frequency ?? 'annual',
    })
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .select()
    .single()

  if (error || !supplier) {
    return { success: false, error: error?.message ?? 'Errore aggiornamento fornitore' }
  }

  const claimsErr = await syncSupplierClaims(id, input.claims ?? [])
  if (claimsErr) {
    return { success: false, error: claimsErr }
  }

  revalidateSuppliers()
  return { success: true, data: supplier as FscSupplier }
}

export async function setFscSupplierStatus(
  id: string,
  status: FscSupplierStatus
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_suppliers')
    .update({ status })
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateSuppliers()
  return { success: true }
}
