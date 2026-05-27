'use server'

import { getCurrentFscCompany } from '@/actions/fsc/company'
import type { FscProductClaim, FscSupplier, FscSupplierStatus } from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'

export type FscSupplierInput = {
  ragione_sociale: string
  certificate_number?: string | null
  certificate_valid_until?: string | null
  last_control_date?: string | null
  control_frequency?: 'annual' | 'semiannual'
  status?: FscSupplierStatus
  claims?: FscProductClaim[]
}

export async function listFscSuppliers(): Promise<FscSupplier[]> {
  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fsc_suppliers')
    .select('*')
    .eq('company_id', ctx.data.company.id)
    .order('ragione_sociale')

  if (error) {
    console.error('listFscSuppliers:', error)
    return []
  }
  return (data ?? []) as FscSupplier[]
}

export async function createFscSupplier(
  input: FscSupplierInput
): Promise<{ success: boolean; data?: FscSupplier; error?: string }> {
  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) return { success: false, error: ctx.error }
  if (!ctx.data.membership.can_edit) {
    return { success: false, error: 'Permesso di modifica non disponibile' }
  }

  const supabase = await createClient()
  const { data: supplier, error } = await supabase
    .from('fsc_suppliers')
    .insert({
      company_id: ctx.data.company.id,
      ragione_sociale: input.ragione_sociale,
      certificate_number: input.certificate_number ?? null,
      certificate_valid_until: input.certificate_valid_until ?? null,
      last_control_date: input.last_control_date ?? null,
      control_frequency: input.control_frequency ?? 'annual',
      status: input.status ?? 'active',
    })
    .select()
    .single()

  if (error || !supplier) {
    return { success: false, error: error?.message ?? 'Errore creazione fornitore' }
  }

  const claims = (input.claims ?? []).slice(0, 2)
  if (claims.length > 0) {
    const { error: claimsError } = await supabase.from('fsc_supplier_product_claims').insert(
      claims.map((claim) => ({ supplier_id: supplier.id, claim }))
    )
    if (claimsError) {
      return { success: false, error: claimsError.message }
    }
  }

  return { success: true, data: supplier as FscSupplier }
}
