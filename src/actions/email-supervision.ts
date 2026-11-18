'use server'

import { unstable_cache, updateTag } from 'next/cache'
import { getToolUsersForAdminPaginated, type ToolUserRow } from '@/actions/users'
import { requireToolAdmin } from '@/lib/tool-auth'
import {
  listRecentInviteEmails,
  resendEventLabelIt,
  type InviteEmailIndexEntry,
} from '@/lib/resend-api'
import { deriveOnboardingInviteAccessStatus } from '@/lib/onboarding-invite-access-status'
import type { InviteAccessStatusKey } from '@/lib/onboarding-invite-access-status'
import { createServiceRoleClient } from '@/utils/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export type EmailSupervisionRow = {
  userId: string
  email: string
  fullName: string | null
  role: string
  onboardingCompleted: boolean
  invitedAt: string | null
  ticketId: string | null
  ticketCreatedAt: string | null
  ticketExpiresAt: string | null
  portalViewsCount: number
  magiclinkMintsCount: number
  lastPortalViewAt: string | null
  lastMagiclinkMintAt: string | null
  resendEmailId: string | null
  resendLastEvent: string | null
  resendLastEventLabel: string
  resendSentAt: string | null
  resendSubject: string | null
  inviteAccessStatus: InviteAccessStatusKey
  inviteAccessLabel: string
  inviteAccessHint: string
  needsInviteResend: boolean
}

type TicketRow = {
  id: string
  user_id: string
  tool_id: string | null
  expires_at: string
  created_at: string
  portal_views_count: number
  magiclink_mints_count: number
  last_portal_view_at: string | null
  last_magiclink_mint_at: string | null
  last_resend_email_id: string | null
  last_resend_sent_at: string | null
  revoked_at: string | null
}

type ResendSnapshot = {
  id: string
  last_event: string | null
  created_at: string
  subject: string | null
}

type InviteProfile = {
  email: string | null
  full_name: string | null
  onboarding_completed: boolean | null
  invited_at: string | null
  username?: string | null
  ragione_sociale?: string | null
}

type InviteUser = {
  user_id: string
  role: string
  profiles: InviteProfile | InviteProfile[] | null
}

const INVITE_INDEX_REVALIDATE_SECONDS = 60
const EMAIL_SUPERVISION_CACHE_TAG = 'email-supervision-resend'
const TICKET_SELECT =
  'id, user_id, tool_id, expires_at, created_at, portal_views_count, magiclink_mints_count, last_portal_view_at, last_magiclink_mint_at, last_resend_email_id, last_resend_sent_at, revoked_at'
const USER_COUNT_PAGE_SIZE = 1000
const TICKET_ID_CHUNK = 200

function ticketsTable(admin: SupabaseClient<Database>) {
  return (admin as SupabaseClient).from('onboarding_invite_tickets')
}

function latestTicketPerUser(tickets: TicketRow[]): Map<string, TicketRow> {
  const map = new Map<string, TicketRow>()
  for (const t of tickets) {
    if (t.revoked_at) continue
    const prev = map.get(t.user_id)
    if (!prev || t.created_at > prev.created_at) {
      map.set(t.user_id, t)
    }
  }
  return map
}

function profileFromRow(row: { profiles: InviteUser['profiles'] | ToolUserRow['profiles'] }): InviteProfile | null {
  const p = row.profiles
  if (!p) return null
  if (Array.isArray(p)) return (p[0] as InviteProfile | undefined) ?? null
  return p as InviteProfile
}

function indexByEmail(entries: InviteEmailIndexEntry[]): Map<string, InviteEmailIndexEntry> {
  return new Map(entries.map((entry) => [entry.email, entry]))
}

function resendSnapshot(
  email: string,
  index: Map<string, InviteEmailIndexEntry>
): ResendSnapshot | null {
  const hit = index.get(email.trim().toLowerCase())
  if (!hit) return null
  return {
    id: hit.id,
    last_event: hit.last_event,
    created_at: hit.created_at,
    subject: hit.subject,
  }
}

async function loadInviteIndex(): Promise<InviteEmailIndexEntry[]> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return []
  return listRecentInviteEmails(apiKey)
}

function getCachedInviteIndex() {
  return unstable_cache(loadInviteIndex, ['resend-invite-email-index'], {
    revalidate: INVITE_INDEX_REVALIDATE_SECONDS,
    tags: [EMAIL_SUPERVISION_CACHE_TAG],
  })()
}

/** Server Action: il reinvio deve rileggere Resend al refresh subito dopo. */
export async function touchEmailSupervisionCache() {
  updateTag(EMAIL_SUPERVISION_CACHE_TAG)
}

function buildEmailSupervisionRow(
  row: { user_id: string; role: string; profiles: InviteUser['profiles'] | ToolUserRow['profiles'] },
  ticket: TicketRow | undefined,
  resend: ResendSnapshot | null
): EmailSupervisionRow {
  const profile = profileFromRow(row)
  const email = profile?.email?.trim() ?? ''
  const lastEvent = resend?.last_event ?? null
  const access = deriveOnboardingInviteAccessStatus({
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    ticketId: ticket?.id ?? null,
    ticketExpiresAt: ticket?.expires_at ?? null,
    portalViewsCount: ticket?.portal_views_count ?? 0,
    magiclinkMintsCount: ticket?.magiclink_mints_count ?? 0,
    resendLastEvent: lastEvent,
  })

  return {
    userId: row.user_id,
    email,
    fullName: profile?.full_name?.trim() ?? null,
    role: row.role,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    invitedAt: profile?.invited_at ?? null,
    ticketId: ticket?.id ?? null,
    ticketCreatedAt: ticket?.created_at ?? null,
    ticketExpiresAt: ticket?.expires_at ?? null,
    portalViewsCount: ticket?.portal_views_count ?? 0,
    magiclinkMintsCount: ticket?.magiclink_mints_count ?? 0,
    lastPortalViewAt: ticket?.last_portal_view_at ?? null,
    lastMagiclinkMintAt: ticket?.last_magiclink_mint_at ?? null,
    resendEmailId: resend?.id ?? ticket?.last_resend_email_id ?? null,
    resendLastEvent: lastEvent,
    resendLastEventLabel: resendEventLabelIt(lastEvent),
    resendSentAt: resend?.created_at ?? ticket?.last_resend_sent_at ?? null,
    resendSubject: resend?.subject ?? null,
    inviteAccessStatus: access.key,
    inviteAccessLabel: access.label,
    inviteAccessHint: access.adminHint,
    needsInviteResend: access.needsResend,
  }
}

async function loadTicketsForUsers(
  admin: SupabaseClient<Database>,
  toolId: string,
  userIds: string[]
): Promise<TicketRow[]> {
  if (userIds.length === 0) return []
  const tickets: TicketRow[] = []
  for (let i = 0; i < userIds.length; i += TICKET_ID_CHUNK) {
    const chunk = userIds.slice(i, i + TICKET_ID_CHUNK)
    const { data, error } = await ticketsTable(admin)
      .select(TICKET_SELECT)
      .eq('tool_id', toolId)
      .in('user_id', chunk)
    if (error) throw new Error(error.message)
    tickets.push(...((data ?? []) as TicketRow[]))
  }
  return tickets
}

async function listUsersForInviteCount(toolId: string, q: string): Promise<InviteUser[]> {
  const admin = createServiceRoleClient()
  const qSafe = q.trim().replace(/[,%()]/g, ' ').trim()
  const users: InviteUser[] = []
  let from = 0

  while (true) {
    let query = admin
      .from('tool_access')
      .select(
        `
        user_id,
        role,
        profiles!inner (
          email,
          full_name,
          onboarding_completed,
          invited_at,
          username,
          ragione_sociale
        )
      `
      )
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false })
      .range(from, from + USER_COUNT_PAGE_SIZE - 1)

    if (qSafe) {
      query = query.or(
        [
          `full_name.ilike.%${qSafe}%`,
          `email.ilike.%${qSafe}%`,
          `username.ilike.%${qSafe}%`,
          `ragione_sociale.ilike.%${qSafe}%`,
        ].join(','),
        { foreignTable: 'profiles' }
      )
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as InviteUser[]
    users.push(...batch)
    if (batch.length < USER_COUNT_PAGE_SIZE) break
    from += USER_COUNT_PAGE_SIZE
  }

  return users
}

/** Badge «da reinviare» su tutto il tool (o sul filtro `q`), senza GET Resend per utente. */
async function countNeedsInviteResend(toolId: string, q: string): Promise<number> {
  const [entries, users] = await Promise.all([
    getCachedInviteIndex(),
    listUsersForInviteCount(toolId, q),
  ])
  const index = indexByEmail(entries)
  const pending = users.filter((row) => !profileFromRow(row)?.onboarding_completed)
  const admin = createServiceRoleClient()
  const ticketByUser = latestTicketPerUser(
    await loadTicketsForUsers(
      admin,
      toolId,
      pending.map((row) => row.user_id)
    )
  )

  let count = 0
  for (const row of pending) {
    const email = profileFromRow(row)?.email?.trim() ?? ''
    const resend = email ? resendSnapshot(email, index) : null
    if (buildEmailSupervisionRow(row, ticketByUser.get(row.user_id), resend).needsInviteResend) {
      count += 1
    }
  }
  return count
}

function getCachedNeedsResendCount(toolId: string, q: string) {
  return unstable_cache(countNeedsInviteResend, ['email-supervision-needs-resend'], {
    revalidate: INVITE_INDEX_REVALIDATE_SECONDS,
    tags: [EMAIL_SUPERVISION_CACHE_TAG],
  })(toolId, q)
}

export async function getEmailSupervisionForTool(
  toolId: string,
  page: number,
  limit: number = 25,
  opts?: { q?: string }
): Promise<{
  data: EmailSupervisionRow[]
  totalCount: number
  needsResendTotalCount: number
  error: string | null
  resendConfigured: boolean
}> {
  try {
    await requireToolAdmin(toolId)

    const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim())
    let admin: SupabaseClient<Database>
    try {
      admin = createServiceRoleClient()
    } catch {
      return {
        data: [],
        totalCount: 0,
        needsResendTotalCount: 0,
        error: 'Service role non configurato per i ticket invito.',
        resendConfigured,
      }
    }

    const q = opts?.q ?? ''
    const [usersRes, indexEntries, needsResendTotalCount] = await Promise.all([
      getToolUsersForAdminPaginated(toolId, page, limit, opts),
      getCachedInviteIndex(),
      getCachedNeedsResendCount(toolId, q),
    ])

    if (usersRes.error) {
      return {
        data: [],
        totalCount: 0,
        needsResendTotalCount: 0,
        error: usersRes.error,
        resendConfigured,
      }
    }

    const rows = usersRes.data ?? []
    const index = indexByEmail(indexEntries)
    const ticketRows = await loadTicketsForUsers(
      admin,
      toolId,
      rows.map((row) => row.user_id)
    )
    const ticketByUser = latestTicketPerUser(ticketRows)
    const data = rows.map((row) => {
      const email = profileFromRow(row)?.email?.trim() ?? ''
      const resend = email ? resendSnapshot(email, index) : null
      return buildEmailSupervisionRow(row, ticketByUser.get(row.user_id), resend)
    })

    return {
      data,
      totalCount: usersRes.totalCount,
      needsResendTotalCount,
      error: null,
      resendConfigured,
    }
  } catch (e) {
    return {
      data: [],
      totalCount: 0,
      needsResendTotalCount: 0,
      error: e instanceof Error ? e.message : 'Errore supervisione email',
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
    }
  }
}
