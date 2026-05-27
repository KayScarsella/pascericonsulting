'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscCompany, FscCompanyMember } from '@/types/fsc'
import { createClient } from '@/utils/supabase/server'

export type FscCompanyContext = {
  company: FscCompany
  membership: FscCompanyMember
}

/** Ensures the user has a company for CLOUD FSC and returns it with membership. */
export async function getCurrentFscCompany(): Promise<{
  success: boolean
  data?: FscCompanyContext
  error?: string
}> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  const { data: companyId, error: rpcError } = await supabase.rpc('fsc_ensure_company_for_user', {
    _tool_id: CLOUD_FSC_TOOL_ID,
  })

  if (rpcError || !companyId) {
    console.error('fsc_ensure_company_for_user:', rpcError)
    return { success: false, error: rpcError?.message ?? 'Impossibile ottenere impresa FSC' }
  }

  const { data: company, error: companyError } = await supabase
    .from('fsc_companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { success: false, error: companyError?.message ?? 'Impresa non trovata' }
  }

  const { data: membership, error: memberError } = await supabase
    .from('fsc_company_members')
    .select('*')
    .eq('company_id', companyId)
    .eq('user_id', userData.user.id)
    .single()

  if (memberError || !membership) {
    return { success: false, error: memberError?.message ?? 'Membership non trovata' }
  }

  return {
    success: true,
    data: {
      company: company as FscCompany,
      membership: membership as FscCompanyMember,
    },
  }
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
