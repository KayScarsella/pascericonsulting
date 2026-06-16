'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { resolveAuthUserIdByEmail } from '@/lib/resolve-auth-user-by-email'
import { notifyUserOfFscCompanyAccess } from '@/lib/fsc/company-notify'
import { siteUrlForAuth } from '@/lib/site-url-for-auth'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscMemberType } from '@/types/fsc'
import { createServiceRoleClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentFscCompany } from './company'

export type FscInviteLookupStatus =
  | 'not_found'
  | 'no_tool_access'
  | 'pending_onboarding'
  | 'already_member'
  | 'eligible'

export type FscInviteLookupResult = {
  status: FscInviteLookupStatus
  userId?: string
  fullName?: string | null
  message: string
}

export type FscCompanyMemberRow = {
  user_id: string
  company_id: string
  member_type: FscMemberType
  can_edit: boolean
  created_at: string
  profiles: {
    email: string | null
    full_name: string | null
  } | null
}

async function assertCanManageMembers(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role === 'admin') return { ok: true }

  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) {
    return { ok: false, error: 'Impresa non trovata' }
  }
  if (ctx.data.company.id !== companyId) {
    return { ok: false, error: 'Impresa non valida' }
  }
  if (ctx.data.membership.member_type !== 'owner') {
    return { ok: false, error: 'Solo il titolare può gestire il team' }
  }
  return { ok: true }
}

export async function listFscCompanyMembers(
  companyId: string
): Promise<{ data: FscCompanyMemberRow[]; error?: string }> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { data: members, error } = await supabase
    .from('fsc_company_members')
    .select('user_id, company_id, member_type, can_edit, created_at')
    .eq('company_id', companyId)
    .order('created_at')

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = members ?? []
  if (rows.length === 0) return { data: [] }

  const userIds = rows.map((m) => m.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { email: p.email, full_name: p.full_name }])
  )

  return {
    data: rows.map((m) => ({
      ...m,
      profiles: profileMap.get(m.user_id) ?? null,
    })) as FscCompanyMemberRow[],
  }
}

export async function lookupFscInviteEmail(
  companyId: string,
  email: string
): Promise<FscInviteLookupResult> {
  const auth = await assertCanManageMembers(companyId)
  if (!auth.ok) {
    return { status: 'not_found', message: auth.error }
  }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed.includes('@')) {
    return { status: 'not_found', message: 'Email non valida' }
  }

  let adminClient
  try {
    adminClient = createServiceRoleClient()
  } catch {
    return { status: 'not_found', message: 'Configurazione server incompleta' }
  }

  const { data: profileRow } = await adminClient
    .from('profiles')
    .select('id, full_name, email, onboarding_completed')
    .eq('email', trimmed)
    .maybeSingle()

  if (!profileRow?.id) {
    const resolved = await resolveAuthUserIdByEmail(adminClient, trimmed)
    if ('error' in resolved) {
      return {
        status: 'not_found',
        message: 'Utente non trovato. Contatta l’amministratore per invitare nuovi utenti al portale.',
      }
    }
    const { data: profileById } = await adminClient
      .from('profiles')
      .select('id, full_name, email, onboarding_completed')
      .eq('id', resolved.userId)
      .maybeSingle()
    if (!profileById) {
      return {
        status: 'not_found',
        message: 'Utente non trovato. Contatta l’amministratore per invitare nuovi utenti al portale.',
      }
    }
    return evaluateInviteEligibility(adminClient, companyId, profileById)
  }

  return evaluateInviteEligibility(adminClient, companyId, profileRow)
}

async function evaluateInviteEligibility(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  companyId: string,
  profile: { id: string; full_name: string | null; email: string | null; onboarding_completed: boolean | null }
): Promise<FscInviteLookupResult> {
  const fullName = profile.full_name

  if (!profile.onboarding_completed) {
    return {
      status: 'pending_onboarding',
      userId: profile.id,
      fullName,
      message: 'Utente trovato ma onboarding non completato. Attendi che completi la registrazione.',
    }
  }

  const { data: toolAccess } = await adminClient
    .from('tool_access')
    .select('user_id')
    .eq('user_id', profile.id)
    .eq('tool_id', CLOUD_FSC_TOOL_ID)
    .maybeSingle()

  if (!toolAccess) {
    return {
      status: 'no_tool_access',
      userId: profile.id,
      fullName,
      message: 'Utente registrato ma senza accesso a CLOUD FSC. Contatta l’amministratore.',
    }
  }

  const { data: existingMember } = await adminClient
    .from('fsc_company_members')
    .select('company_id')
    .eq('company_id', companyId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existingMember) {
    return {
      status: 'already_member',
      userId: profile.id,
      fullName,
      message: 'Utente già membro di questa impresa.',
    }
  }

  return {
    status: 'eligible',
    userId: profile.id,
    fullName,
    message: 'Utente idoneo: può essere aggiunto al team.',
  }
}

export async function addExistingUserToFscCompany(input: {
  companyId: string
  email: string
  memberType: Exclude<FscMemberType, 'owner'>
  canEdit: boolean
}): Promise<{ success: boolean; error?: string; warning?: string }> {
  const lookup = await lookupFscInviteEmail(input.companyId, input.email)
  if (lookup.status !== 'eligible' || !lookup.userId) {
    return { success: false, error: lookup.message }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('fsc_company_members').insert({
    company_id: input.companyId,
    user_id: lookup.userId,
    member_type: input.memberType,
    can_edit: input.canEdit,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const { data: company } = await supabase
    .from('fsc_companies')
    .select('ragione_sociale')
    .eq('id', input.companyId)
    .single()

  const site = siteUrlForAuth()
  let warning: string | undefined
  if (site) {
    try {
      const adminClient = createServiceRoleClient()
      const notify = await notifyUserOfFscCompanyAccess(adminClient, {
        appPublicUrl: site,
        userId: lookup.userId,
        email: input.email.trim().toLowerCase(),
        companyName: company?.ragione_sociale ?? 'Impresa FSC',
        memberType: input.memberType,
        canEdit: input.canEdit,
      })
      if (!notify.ok) {
        warning = `Membro aggiunto ma email non inviata: ${notify.error}`
      }
    } catch {
      warning = 'Membro aggiunto ma notifica email non configurata.'
    }
  }

  revalidatePath('/cloud-fsc')
  return { success: true, ...(warning ? { warning } : {}) }
}

export async function updateFscCompanyMember(input: {
  companyId: string
  userId: string
  memberType: FscMemberType
  canEdit: boolean
}): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManageMembers(input.companyId)
  if (!auth.ok) return { success: false, error: auth.error }

  if (input.memberType === 'owner') {
    const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
    if (role !== 'admin') {
      return { success: false, error: 'Solo un admin può assegnare il ruolo titolare' }
    }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_company_members')
    .update({
      member_type: input.memberType,
      can_edit: input.canEdit,
    })
    .eq('company_id', input.companyId)
    .eq('user_id', input.userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/cloud-fsc')
  return { success: true }
}

export async function removeFscCompanyMember(input: {
  companyId: string
  userId: string
}): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManageMembers(input.companyId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('fsc_company_members')
    .delete()
    .eq('company_id', input.companyId)
    .eq('user_id', input.userId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/cloud-fsc')
  return { success: true }
}

/** Admin or service: add membership without owner check (used from invite flow). */
export async function upsertFscCompanyMemberAdmin(input: {
  companyId: string
  userId: string
  memberType: FscMemberType
  canEdit: boolean
}): Promise<{ success: boolean; error?: string }> {
  let adminClient
  try {
    adminClient = createServiceRoleClient()
  } catch {
    return { success: false, error: 'Service role non configurato' }
  }

  const { error } = await adminClient.from('fsc_company_members').upsert(
    {
      company_id: input.companyId,
      user_id: input.userId,
      member_type: input.memberType,
      can_edit: input.canEdit,
    },
    { onConflict: 'company_id,user_id' }
  )

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getFscMembershipsForUsers(
  userIds: string[]
): Promise<
  Record<
    string,
    { company_id: string; ragione_sociale: string; member_type: FscMemberType; can_edit: boolean }[]
  >
> {
  if (userIds.length === 0) return {}

  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { data: memberships, error } = await supabase
    .from('fsc_company_members')
    .select('user_id, company_id, member_type, can_edit')
    .in('user_id', userIds)

  if (error || !memberships) return {}

  const companyIds = [...new Set(memberships.map((m) => m.company_id))]
  const { data: companies } = await supabase
    .from('fsc_companies')
    .select('id, ragione_sociale, tool_id')
    .in('id', companyIds)
    .eq('tool_id', CLOUD_FSC_TOOL_ID)

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.ragione_sociale]))

  const out: Record<
    string,
    { company_id: string; ragione_sociale: string; member_type: FscMemberType; can_edit: boolean }[]
  > = {}

  for (const row of memberships) {
    const ragione = companyMap.get(row.company_id)
    if (!ragione) continue
    if (!out[row.user_id]) out[row.user_id] = []
    out[row.user_id].push({
      company_id: row.company_id,
      ragione_sociale: ragione,
      member_type: row.member_type as FscMemberType,
      can_edit: row.can_edit,
    })
  }

  return out
}

export async function listFscMembersByCompanyForAdmin(): Promise<
  Record<
    string,
    {
      user_id: string
      full_name: string | null
      email: string | null
      member_type: FscMemberType
      can_edit: boolean
    }[]
  >
> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('fsc_companies')
    .select('id')
    .eq('tool_id', CLOUD_FSC_TOOL_ID)

  if (!companies?.length) return {}

  const companyIds = companies.map((c) => c.id)
  const { data: members, error } = await supabase
    .from('fsc_company_members')
    .select('company_id, user_id, member_type, can_edit')
    .in('company_id', companyIds)

  if (error || !members) return {}

  const userIds = [...new Set(members.map((m) => m.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }])
  )

  const out: Record<
    string,
    {
      user_id: string
      full_name: string | null
      email: string | null
      member_type: FscMemberType
      can_edit: boolean
    }[]
  > = {}

  for (const row of members) {
    const profile = profileMap.get(row.user_id)
    if (!out[row.company_id]) out[row.company_id] = []
    out[row.company_id].push({
      user_id: row.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      member_type: row.member_type as FscMemberType,
      can_edit: row.can_edit,
    })
  }

  return out
}
