'use server'

import { getToolUsersForAdminPaginated, type ToolUserRow } from '@/actions/users'
import { requireToolAdmin } from '@/lib/tool-auth'
import {
  buildInviteEmailIndexByRecipient,
  getResendEmail,
  resendEventLabelIt,
  type ResendEmailListItem,
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

function profileFromRow(row: ToolUserRow) {
  const p = row.profiles
  if (Array.isArray(p)) return p[0] ?? null
  return p
}

async function resolveResendForUser(
  apiKey: string,
  email: string,
  ticket: TicketRow | undefined,
  indexByRecipient: Map<string, ResendEmailListItem>,
  detailCache: Map<string, ResendEmailListItem | null>
): Promise<ResendEmailListItem | null> {
  const emailLower = email.trim().toLowerCase()

  if (ticket?.last_resend_email_id) {
    const cached = detailCache.get(ticket.last_resend_email_id)
    if (cached !== undefined) return cached
    const { data } = await getResendEmail(apiKey, ticket.last_resend_email_id)
    detailCache.set(ticket.last_resend_email_id, data)
    if (data) return data
  }

  return indexByRecipient.get(emailLower) ?? null
}

const NEEDS_RESEND_COUNT_PAGE_SIZE = 100

function buildEmailSupervisionRow(
  row: ToolUserRow,
  ticket: TicketRow | undefined,
  resend: ResendEmailListItem | null
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

/** Conteggio reinvii su tutti gli utenti del tool (rispetta il filtro ricerca `q`). */
async function countNeedsInviteResendForTool(
  toolId: string,
  opts: { q?: string } | undefined,
  ticketByUser: Map<string, TicketRow>,
  resendKey: string | undefined,
  indexByRecipient: Map<string, ResendEmailListItem>
): Promise<number> {
  let count = 0
  let page = 1
  const detailCache = new Map<string, ResendEmailListItem | null>()

  while (true) {
    const batch = await getToolUsersForAdminPaginated(
      toolId,
      page,
      NEEDS_RESEND_COUNT_PAGE_SIZE,
      opts
    )
    if (batch.error || !batch.data?.length) break

    for (const row of batch.data) {
      const profile = profileFromRow(row)
      const email = profile?.email?.trim() ?? ''
      const ticket = ticketByUser.get(row.user_id)
      const resend =
        resendKey && email
          ? await resolveResendForUser(resendKey, email, ticket, indexByRecipient, detailCache)
          : null
      const built = buildEmailSupervisionRow(row, ticket, resend)
      if (built.needsInviteResend) count += 1
    }

    if (page * NEEDS_RESEND_COUNT_PAGE_SIZE >= batch.totalCount) break
    page += 1
  }

  return count
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

    const resendKey = process.env.RESEND_API_KEY?.trim()
    const resendConfigured = Boolean(resendKey)

    const usersRes = await getToolUsersForAdminPaginated(toolId, page, limit, opts)
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

    let admin
    try {
      admin = createServiceRoleClient()
    } catch {
      return {
        data: [],
        totalCount: usersRes.totalCount,
        needsResendTotalCount: 0,
        error: 'Service role non configurato per i ticket invito.',
        resendConfigured,
      }
    }

    const { data: ticketRows, error: ticketError } = await ticketsTable(admin)
      .select(
        'id, user_id, tool_id, expires_at, created_at, portal_views_count, magiclink_mints_count, last_portal_view_at, last_magiclink_mint_at, last_resend_email_id, last_resend_sent_at, revoked_at'
      )
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false })

    if (ticketError) {
      return {
        data: [],
        totalCount: usersRes.totalCount,
        needsResendTotalCount: 0,
        error: ticketError.message,
        resendConfigured,
      }
    }

    const ticketByUser = latestTicketPerUser((ticketRows ?? []) as TicketRow[])

    let indexByRecipient = new Map<string, ResendEmailListItem>()
    if (resendKey) {
      indexByRecipient = await buildInviteEmailIndexByRecipient(resendKey)
    }

    const detailCache = new Map<string, ResendEmailListItem | null>()
    const [needsResendTotalCount, data] = await Promise.all([
      countNeedsInviteResendForTool(toolId, opts, ticketByUser, resendKey, indexByRecipient),
      (async () => {
        const pageRows: EmailSupervisionRow[] = []
        for (const row of rows) {
          const profile = profileFromRow(row)
          const email = profile?.email?.trim() ?? ''
          const ticket = ticketByUser.get(row.user_id)
          const resend =
            resendKey && email
              ? await resolveResendForUser(
                  resendKey,
                  email,
                  ticket,
                  indexByRecipient,
                  detailCache
                )
              : null
          pageRows.push(buildEmailSupervisionRow(row, ticket, resend))
        }
        return pageRows
      })(),
    ])

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
