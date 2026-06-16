'use server'

import { requireFscPartnerContext } from '@/actions/fsc/partner-context'
import { assertFscPartnerCanEdit } from '@/lib/fsc/partner-auth'
import { FSC_SUBCONTRACTORS_PATH } from '@/lib/fsc/partners'
import type {
  FscSubcontractor,
  FscSubcontractorWithDetails,
  FscSupplierStatus,
} from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FscSubcontractorInput = {
  ragione_sociale: string
  is_certified: boolean
  work_type?: string | null
  coc_risk?: boolean
  certificate_number?: string | null
  certificate_valid_until?: string | null
  last_control_date?: string | null
  control_frequency?: 'annual' | 'semiannual'
  status?: FscSupplierStatus
}

export type FscSubcontractorListFilters = {
  search?: string
  status?: FscSupplierStatus | 'all'
}

function revalidateSubcontractors(): void {
  revalidatePath(FSC_SUBCONTRACTORS_PATH)
}

async function enrichSubcontractors(
  rows: FscSubcontractor[]
): Promise<FscSubcontractorWithDetails[]> {
  if (rows.length === 0) return []

  const supabase = await createClient()
  const ids = rows.map((r) => r.id)

  const { data: attachments } = await supabase
    .from('fsc_subcontractor_attachments')
    .select('*')
    .in('subcontractor_id', ids)

  const byId = new Map<string, FscSubcontractorWithDetails['attachments']>()
  for (const row of attachments ?? []) {
    const list = byId.get(row.subcontractor_id) ?? []
    list.push(row as FscSubcontractorWithDetails['attachments'][number])
    byId.set(row.subcontractor_id, list)
  }

  return rows.map((row) => ({
    ...row,
    attachments: byId.get(row.id) ?? [],
  }))
}

function validateSubcontractorInput(input: FscSubcontractorInput): string | null {
  if (!input.ragione_sociale.trim()) return 'Ragione sociale obbligatoria'
  if (input.is_certified) {
    if (!input.certificate_number?.trim()) {
      return 'Numero certificato obbligatorio per terzisti certificati'
    }
    if (!input.certificate_valid_until) {
      return 'Validità certificato obbligatoria per terzisti certificati'
    }
  }
  return null
}

export async function listFscSubcontractors(
  filters?: FscSubcontractorListFilters
): Promise<FscSubcontractorWithDetails[]> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return []

  const supabase = await createClient()
  let query = supabase
    .from('fsc_subcontractors')
    .select('*')
    .eq('company_id', ctx.data.companyId)
    .order('ragione_sociale')

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) {
    console.error('listFscSubcontractors:', error)
    return []
  }

  let rows = (data ?? []) as FscSubcontractor[]
  if (filters?.search?.trim()) {
    const term = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.ragione_sociale.toLowerCase().includes(term) ||
        (r.work_type?.toLowerCase().includes(term) ?? false) ||
        (r.certificate_number?.toLowerCase().includes(term) ?? false)
    )
  }

  return enrichSubcontractors(rows)
}

export async function getFscSubcontractor(
  id: string
): Promise<{ success: boolean; data?: FscSubcontractorWithDetails; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_subcontractors')
    .select('*')
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .maybeSingle()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Terzista non trovato' }
  }

  const [enriched] = await enrichSubcontractors([data as FscSubcontractor])

  const { data: history, error: historyError } = await supabase
    .from('fsc_subcontractor_status_history')
    .select('*')
    .eq('subcontractor_id', id)
    .order('changed_at', { ascending: false })

  if (historyError) {
    console.error('getFscSubcontractor history:', historyError)
  }

  return {
    success: true,
    data: { ...enriched, status_history: history ?? [] },
  }
}

export async function createFscSubcontractor(
  input: FscSubcontractorInput
): Promise<{ success: boolean; data?: FscSubcontractor; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const validationErr = validateSubcontractorInput(input)
  if (validationErr) return { success: false, error: validationErr }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('fsc_subcontractors')
    .insert({
      company_id: ctx.data.companyId,
      ragione_sociale: input.ragione_sociale.trim(),
      is_certified: input.is_certified,
      work_type: input.work_type?.trim() || null,
      coc_risk: input.coc_risk ?? false,
      certificate_number: input.is_certified ? input.certificate_number?.trim() || null : null,
      certificate_valid_until: input.is_certified ? input.certificate_valid_until || null : null,
      last_control_date: input.last_control_date || null,
      control_frequency: input.control_frequency ?? 'annual',
      status: input.status ?? 'active',
    })
    .select()
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Errore creazione terzista' }
  }

  revalidateSubcontractors()
  return { success: true, data: row as FscSubcontractor }
}

export async function updateFscSubcontractor(
  id: string,
  input: FscSubcontractorInput
): Promise<{ success: boolean; data?: FscSubcontractor; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const validationErr = validateSubcontractorInput(input)
  if (validationErr) return { success: false, error: validationErr }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('fsc_subcontractors')
    .update({
      ragione_sociale: input.ragione_sociale.trim(),
      is_certified: input.is_certified,
      work_type: input.work_type?.trim() || null,
      coc_risk: input.coc_risk ?? false,
      certificate_number: input.is_certified ? input.certificate_number?.trim() || null : null,
      certificate_valid_until: input.is_certified ? input.certificate_valid_until || null : null,
      last_control_date: input.last_control_date || null,
      control_frequency: input.control_frequency ?? 'annual',
    })
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)
    .select()
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Errore aggiornamento terzista' }
  }

  revalidateSubcontractors()
  return { success: true, data: row as FscSubcontractor }
}

export async function setFscSubcontractorStatus(
  id: string,
  status: FscSupplierStatus
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireFscPartnerContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  const editErr = assertFscPartnerCanEdit(ctx.data)
  if (editErr) return { success: false, error: editErr }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_subcontractors')
    .update({ status })
    .eq('id', id)
    .eq('company_id', ctx.data.companyId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateSubcontractors()
  return { success: true }
}
