import { createHash, randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { ONBOARDING_PORTAL_TICKET_TTL_DAYS } from '@/lib/constants'

function ticketsTable(admin: SupabaseClient<Database>) {
  return (admin as SupabaseClient).from('onboarding_invite_tickets')
}

export function hashOnboardingPortalToken(plainToken: string): string {
  return createHash('sha256').update(plainToken, 'utf8').digest('hex')
}

export function generateOnboardingPortalToken(): string {
  return randomBytes(32).toString('base64url')
}

export function buildOnboardingPortalUrl(siteBase: string, plainToken: string): string {
  const base = siteBase.replace(/\/$/, '')
  return `${base}/auth/onboarding-entry?t=${encodeURIComponent(plainToken)}`
}

type TicketRow = {
  id: string
  user_id: string
  tool_id: string | null
  expires_at: string
  revoked_at: string | null
  portal_views_count: number
  magiclink_mints_count: number
}

async function incrementTicketCounter(
  admin: SupabaseClient<Database>,
  plainToken: string,
  kind: 'portal_view' | 'magiclink_mint'
): Promise<void> {
  const tokenHash = hashOnboardingPortalToken(plainToken.trim())
  const now = new Date().toISOString()

  const { data: row } = await ticketsTable(admin)
    .select('id, portal_views_count, magiclink_mints_count, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!row || row.revoked_at || new Date(row.expires_at as string).getTime() < Date.now()) {
    return
  }

  if (kind === 'portal_view') {
    await ticketsTable(admin)
      .update({
        portal_views_count: Number(row.portal_views_count ?? 0) + 1,
        last_portal_view_at: now,
      })
      .eq('id', row.id as string)
  } else {
    await ticketsTable(admin)
      .update({
        magiclink_mints_count: Number(row.magiclink_mints_count ?? 0) + 1,
        last_magiclink_mint_at: now,
      })
      .eq('id', row.id as string)
  }
}

/** Counts a visit to /auth/onboarding-entry (multi-use link; may include email scanners). */
export async function recordOnboardingPortalView(
  admin: SupabaseClient<Database>,
  plainToken: string
): Promise<void> {
  await incrementTicketCounter(admin, plainToken, 'portal_view')
}

/** Counts a successful «Continua e accedi» (single-use magic link generated). */
export async function recordOnboardingMagiclinkMint(
  admin: SupabaseClient<Database>,
  plainToken: string
): Promise<void> {
  await incrementTicketCounter(admin, plainToken, 'magiclink_mint')
}

/**
 * Revokes previous active tickets and inserts a new portal ticket.
 * Returns the plain token once (for the email link).
 */
export async function createOnboardingPortalTicket(
  admin: SupabaseClient<Database>,
  input: { userId: string; toolId?: string | null }
): Promise<{ plainToken: string } | { error: string }> {
  const plainToken = generateOnboardingPortalToken()
  const tokenHash = hashOnboardingPortalToken(plainToken)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + ONBOARDING_PORTAL_TICKET_TTL_DAYS)

  const now = new Date().toISOString()
  const { error: revokeError } = await ticketsTable(admin)
    .update({ revoked_at: now })
    .eq('user_id', input.userId)
    .is('revoked_at', null)

  if (revokeError) {
    return { error: revokeError.message }
  }

  const { error: insertError } = await ticketsTable(admin).insert({
    user_id: input.userId,
    token_hash: tokenHash,
    tool_id: input.toolId ?? null,
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) {
    return { error: insertError.message }
  }

  return { plainToken }
}

/** After Resend send: link provider id to the active ticket for this user. */
export async function attachResendEmailToActiveTicket(
  admin: SupabaseClient<Database>,
  userId: string,
  resendEmailId: string
): Promise<void> {
  const now = new Date().toISOString()
  await ticketsTable(admin)
    .update({
      last_resend_email_id: resendEmailId,
      last_resend_sent_at: now,
    })
    .eq('user_id', userId)
    .is('revoked_at', null)
}

export async function resolveOnboardingPortalTicket(
  admin: SupabaseClient<Database>,
  plainToken: string
): Promise<
  | { ok: true; ticket: TicketRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'revoked' }
> {
  const trimmed = plainToken.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid' }
  }

  const tokenHash = hashOnboardingPortalToken(trimmed)
  const { data, error } = await ticketsTable(admin)
    .select(
      'id, user_id, tool_id, expires_at, revoked_at, portal_views_count, magiclink_mints_count'
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, reason: 'invalid' }
  }

  const ticket = data as TicketRow
  if (ticket.revoked_at) {
    return { ok: false, reason: 'revoked' }
  }
  if (new Date(ticket.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, ticket }
}
