'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { BoscologParty, BoscologPartyInput, BoscologPartyRole } from '@/types/boscolog'
import { BOSCOLOG_PARTY_ROLES } from '@/types/boscolog'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'

function isPartyRole(value: string): value is BoscologPartyRole {
  return (BOSCOLOG_PARTY_ROLES as string[]).includes(value)
}

export async function listBoscologParties(filters?: {
  role?: BoscologPartyRole | ''
  q?: string
}): Promise<{ success: boolean; parties?: BoscologParty[]; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }

  const supabase = await createClient()
  let query = supabase
    .from('boscolog_parties')
    .select('*')
    .eq('company_id', ctx.company.id)
    .order('name', { ascending: true })

  if (filters?.role) {
    query = query.eq('role', filters.role)
  }

  const { data, error } = await query
  if (error) {
    return { success: false, error: error.message }
  }

  let parties = (data ?? []) as BoscologParty[]
  const q = filters?.q?.trim().toLowerCase()
  if (q) {
    parties = parties.filter((p) => {
      const hay = `${p.name} ${p.vat ?? ''} ${p.address ?? ''} ${p.notes ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  return { success: true, parties }
}

export async function createBoscologParty(
  input: BoscologPartyInput
): Promise<{ success: boolean; id?: string; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) {
    return { success: false, error: 'Non autorizzato' }
  }

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Inserisci il nome / ragione sociale.' }
  if (!isPartyRole(input.role)) return { success: false, error: 'Ruolo non valido.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boscolog_parties')
    .insert({
      company_id: ctx.company.id,
      name,
      role: input.role,
      vat: input.vat?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      bp_cert_id: input.bp_cert_id?.trim() || null,
      bp_expire: input.bp_expire?.trim() || null,
      bp_org: input.bp_org?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message ?? 'Creazione fallita' }
  }

  revalidatePath('/boscolog/anagrafiche')
  return { success: true, id: data.id }
}

export async function updateBoscologParty(
  partyId: string,
  input: BoscologPartyInput
): Promise<{ success: boolean; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) {
    return { success: false, error: 'Non autorizzato' }
  }

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Inserisci il nome / ragione sociale.' }
  if (!isPartyRole(input.role)) return { success: false, error: 'Ruolo non valido.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_parties')
    .update({
      name,
      role: input.role,
      vat: input.vat?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      bp_cert_id: input.bp_cert_id?.trim() || null,
      bp_expire: input.bp_expire?.trim() || null,
      bp_org: input.bp_org?.trim() || null,
    })
    .eq('id', partyId)
    .eq('company_id', ctx.company.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/boscolog/anagrafiche')
  return { success: true }
}

export async function deleteBoscologParty(
  partyId: string
): Promise<{ success: boolean; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) {
    return { success: false, error: 'Non autorizzato' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_parties')
    .delete()
    .eq('id', partyId)
    .eq('company_id', ctx.company.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/boscolog/anagrafiche')
  return { success: true }
}
