'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscCompany, FscCompanyMember } from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type FscCompanyContext = {
  company: FscCompany
  membership: FscCompanyMember
}

export type FscCompanyContextResult = {
  success: boolean
  needsSetup?: boolean
  data?: FscCompanyContext
  companies?: FscCompany[]
  error?: string
}

export type FscCompanyInput = {
  ragione_sociale: string
  cf_partita_iva?: string | null
  indirizzo?: string | null
  cap?: string | null
  citta?: string | null
  provincia?: string | null
  recapito_telefonico?: string | null
  sito_internet?: string | null
  email?: string | null
}

export type FscCompanyAdminRow = {
  id: string
  ragione_sociale: string
  cf_partita_iva: string | null
  email: string | null
  member_count: number
  created_at: string
}

async function loadCompanyById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  userId: string
): Promise<FscCompanyContext | null> {
  const { data: company, error: companyError } = await supabase
    .from('fsc_companies')
    .select('*')
    .eq('id', companyId)
    .eq('tool_id', CLOUD_FSC_TOOL_ID)
    .single()

  if (companyError || !company) return null

  const { data: membership, error: memberError } = await supabase
    .from('fsc_company_members')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .single()

  if (memberError || !membership) return null

  return {
    company: company as FscCompany,
    membership: membership as FscCompanyMember,
  }
}

/** Full context: active company, setup flag, all companies for switcher. */
export async function getFscCompanyContext(): Promise<FscCompanyContextResult> {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  const companies = await listUserFscCompanies()
  if (companies.length === 0) {
    if (role === 'admin') {
      return { success: true, needsSetup: false, companies: [] }
    }
    return { success: true, needsSetup: true, companies: [] }
  }

  const { data: companyId, error: rpcError } = await supabase.rpc('fsc_ensure_company_for_user', {
    _tool_id: CLOUD_FSC_TOOL_ID,
  })

  if (rpcError) {
    console.error('fsc_ensure_company_for_user:', rpcError)
    return { success: false, error: rpcError.message }
  }

  if (!companyId) {
    return { success: true, needsSetup: true, companies }
  }

  const ctx = await loadCompanyById(supabase, companyId as string, userData.user.id)
  if (!ctx) {
    return { success: true, needsSetup: true, companies }
  }

  return { success: true, data: ctx, companies }
}

/** Ensures the user has a company for CLOUD FSC and returns it with membership. */
export async function getCurrentFscCompany(): Promise<{
  success: boolean
  needsSetup?: boolean
  data?: FscCompanyContext
  error?: string
}> {
  const result = await getFscCompanyContext()
  if (!result.success) {
    return { success: false, error: result.error }
  }
  if (result.needsSetup || !result.data) {
    return { success: false, needsSetup: true, error: 'Impresa FSC non configurata' }
  }
  return { success: true, data: result.data }
}

export async function listUserFscCompanies(): Promise<FscCompany[]> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { data: ids, error: idsError } = await supabase.rpc('fsc_current_user_company_ids')
  if (idsError || !ids?.length) return []

  const { data, error } = await supabase
    .from('fsc_companies')
    .select('*')
    .in('id', ids as string[])
    .eq('tool_id', CLOUD_FSC_TOOL_ID)
    .order('ragione_sociale')

  if (error) {
    console.error('listUserFscCompanies:', error)
    return []
  }

  return (data ?? []) as FscCompany[]
}

export async function createFscCompany(
  input: FscCompanyInput
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)

  const supabase = await createClient()
  const { data: companyId, error } = await supabase.rpc('fsc_create_company_for_user', {
    _tool_id: CLOUD_FSC_TOOL_ID,
    _ragione_sociale: input.ragione_sociale.trim(),
    _cf_partita_iva: input.cf_partita_iva?.trim() || null,
    _indirizzo: input.indirizzo?.trim() || null,
    _cap: input.cap?.trim() || null,
    _citta: input.citta?.trim() || null,
    _provincia: input.provincia?.trim() || null,
    _recapito_telefonico: input.recapito_telefonico?.trim() || null,
    _sito_internet: input.sito_internet?.trim() || null,
    _email: input.email?.trim() || null,
  })

  if (error || !companyId) {
    return { success: false, error: error?.message ?? 'Creazione impresa fallita' }
  }

  revalidatePath('/cloud-fsc')
  return { success: true, companyId: companyId as string }
}

export async function updateFscCompany(
  companyId: string,
  input: FscCompanyInput
): Promise<{ success: boolean; error?: string }> {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  if (role !== 'admin') {
    const ctx = await getCurrentFscCompany()
    if (!ctx.success || ctx.data?.company.id !== companyId || !ctx.data.membership.can_edit) {
      return { success: false, error: 'Non autorizzato a modificare questa impresa' }
    }
  }

  const { error } = await supabase
    .from('fsc_companies')
    .update({
      ragione_sociale: input.ragione_sociale.trim(),
      cf_partita_iva: input.cf_partita_iva?.trim() || null,
      indirizzo: input.indirizzo?.trim() || null,
      cap: input.cap?.trim() || null,
      citta: input.citta?.trim() || null,
      provincia: input.provincia?.trim() || null,
      recapito_telefonico: input.recapito_telefonico?.trim() || null,
      sito_internet: input.sito_internet?.trim() || null,
      email: input.email?.trim() || null,
    })
    .eq('id', companyId)
    .eq('tool_id', CLOUD_FSC_TOOL_ID)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/cloud-fsc')
  return { success: true }
}

export async function setActiveFscCompany(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { error } = await supabase.rpc('fsc_set_active_company', {
    _company_id: companyId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/cloud-fsc')
  return { success: true }
}

export async function listFscCompaniesForAdmin(): Promise<{
  data: FscCompanyAdminRow[]
  error?: string
}> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fsc_list_companies_for_admin', {
    _tool_id: CLOUD_FSC_TOOL_ID,
  })

  if (error) {
    return { data: [], error: error.message }
  }

  return {
    data: ((data ?? []) as FscCompanyAdminRow[]).map((row) => ({
      ...row,
      member_count: Number(row.member_count),
    })),
  }
}
