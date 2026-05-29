'use server'

import {
  notifyUserOfToolAccess,
  sendPendingInviteActionLinkViaResend,
} from '@/lib/tool-access-notify'
import { createOnboardingPortalLinkForUser } from '@/actions/onboarding-entry'
import { attachResendEmailToActiveTicket } from '@/lib/onboarding-invite-ticket'
import { resolveAuthUserIdByEmail } from '@/lib/resolve-auth-user-by-email'
import { requireToolAdmin } from '@/lib/tool-auth'
import { siteUrlForAuth } from '@/lib/site-url-for-auth'
import { createServiceRoleClient } from '@/utils/supabase/admin'
import { PENDING_INVITE_BULK_RESEND_MAX } from '@/lib/constants'

export type AppInviteRole = 'standard' | 'premium' | 'admin'

export type InviteUserIntent = 'default' | 'resend_pending_onboarding'

/** Esito invio email invito onboarding (sempre Resend + link porta). */
export type InviteEmailDelivery =
  | 'pending_emailed'
  | 'pending_email_failed'
  | 'pending_email_missing_env'
  | 'none'

export type InviteUserToToolResult = {
  success: boolean
  error?: string
  message?: string
  warning?: string
  inviteEmailDelivery?: InviteEmailDelivery
}

type InviteTemplateData = {
  invitation_context: 'tool'
  invited_tool_id: string
  invited_tool_name: string
}

const INVITE_LOG = '[inviteUserToTool]'

const RESEND_REQUIRED_ERROR =
  'Gli inviti onboarding richiedono RESEND_API_KEY e FROM_EMAIL sul server (email Resend con link porta /auth/onboarding-entry). Non si usa più la mail di invito Supabase.'

async function resolveOrCreateInvitedUser(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  trimmed: string,
  templateData: InviteTemplateData
): Promise<
  | { ok: true; userId: string; inviteKind: 'new_invite' | 'existing_pending' | 'existing_onboarded' }
  | { ok: false; error: string }
> {
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: trimmed,
    email_confirm: true,
    user_metadata: templateData as unknown as Record<string, unknown>,
  })

  if (!createError && created.user?.id) {
    return { ok: true, userId: created.user.id, inviteKind: 'new_invite' }
  }

  const alreadyRegistered = createError?.message.toLowerCase().includes('already been registered')
  if (!alreadyRegistered) {
    return { ok: false, error: createError?.message ?? 'Creazione utente fallita.' }
  }

  const resolved = await resolveAuthUserIdByEmail(adminClient, trimmed)
  if ('error' in resolved) {
    return { ok: false, error: resolved.error }
  }

  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', resolved.userId)
    .maybeSingle()

  const onboardingCompleted = Boolean(
    (existingProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed
  )

  return {
    ok: true,
    userId: resolved.userId,
    inviteKind: onboardingCompleted ? 'existing_onboarded' : 'existing_pending',
  }
}

/**
 * Grants tool access and sends onboarding invite email via Resend (link porta multiuso).
 * Requires SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL, NEXT_PUBLIC_SITE_URL.
 */
export async function inviteUserToToolAction(
  toolId: string,
  email: string,
  role: AppInviteRole = 'standard',
  options?: { intent?: InviteUserIntent }
): Promise<InviteUserToToolResult> {
  await requireToolAdmin(toolId)

  const site = siteUrlForAuth()
  if (!site) {
    return {
      success: false,
      error:
        'Configura NEXT_PUBLIC_SITE_URL con l’URL pubblico dell’app (non l’URL *.supabase.co), es. https://tuo-dominio.vercel.app',
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.FROM_EMAIL?.trim()

  let adminClient
  try {
    adminClient = createServiceRoleClient()
  } catch {
    return {
      success: false,
      error:
        'Inviti non attivi: aggiungi SUPABASE_SERVICE_ROLE_KEY alle variabili d’ambiente del server (mai nel client).',
    }
  }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) {
    return { success: false, error: 'Email non valida' }
  }

  const { data: toolRow } = await adminClient
    .from('tools')
    .select('name')
    .eq('id', toolId)
    .maybeSingle()
  const invitedToolName =
    (toolRow as { name?: string } | null)?.name?.trim() || 'Piattaforma Pasceri Consulting'
  const templateData: InviteTemplateData = {
    invitation_context: 'tool',
    invited_tool_id: toolId,
    invited_tool_name: invitedToolName,
  }

  let userId: string
  let inviteKind: 'new_invite' | 'existing_pending' | 'existing_onboarded'

  if (options?.intent === 'resend_pending_onboarding') {
    const resolved = await resolveAuthUserIdByEmail(adminClient, trimmed)
    if ('error' in resolved) {
      return { success: false, error: resolved.error }
    }
    userId = resolved.userId

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', userId)
      .maybeSingle()

    if (Boolean((existingProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed)) {
      return {
        success: false,
        error: 'Onboarding già completato: non serve reinvio del link di invito.',
      }
    }

    inviteKind = 'existing_pending'
  } else {
    const resolved = await resolveOrCreateInvitedUser(adminClient, trimmed, templateData)
    if (!resolved.ok) {
      return { success: false, error: resolved.error }
    }
    userId = resolved.userId
    inviteKind = resolved.inviteKind
  }

  const needsOnboardingEmail = inviteKind !== 'existing_onboarded'

  if (needsOnboardingEmail && (!resendKey || !fromEmail)) {
    return { success: false, error: RESEND_REQUIRED_ERROR }
  }

  const { data: existingAccess } = await adminClient
    .from('tool_access')
    .select('role')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle()

  const existingRole = existingAccess?.role as AppInviteRole | undefined
  const forcePendingResend = options?.intent === 'resend_pending_onboarding'
  if (existingRole === role && !needsOnboardingEmail && !forcePendingResend) {
    return {
      success: true,
      message: "L'utente ha gia' accesso a questo tool con lo stesso ruolo.",
      inviteEmailDelivery: 'none',
    }
  }

  const hadSameRoleBeforeUpsert = existingRole === role

  const { error: accessError } = await adminClient.from('tool_access').upsert(
    {
      user_id: userId,
      tool_id: toolId,
      role,
    },
    { onConflict: 'user_id,tool_id' }
  )

  if (accessError) {
    return {
      success: false,
      error: `Utente invitato ma assegnazione al tool fallita: ${accessError.message}. Aggiungi il ruolo da dashboard o correggi i dati.`,
    }
  }

  if (inviteKind !== 'existing_onboarded') {
    const { error: profileError } = await adminClient.from('profiles').upsert(
      {
        id: userId,
        email: trimmed,
        onboarding_completed: false,
        invited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    if (profileError) {
      return {
        success: false,
        error: `Accesso assegnato ma profilo pending non aggiornato: ${profileError.message}`,
      }
    }
  }

  let message: string
  if (inviteKind === 'new_invite') {
    message = 'Invito inviato via email (link porta onboarding).'
  } else if (inviteKind === 'existing_pending') {
    message = hadSameRoleBeforeUpsert
      ? 'Nuovo link di invito inviato (controllare la casella email).'
      : 'Tool assegnato; email con link di accesso inviata.'
  } else if (existingRole !== undefined && existingRole !== role) {
    message = 'Ruolo aggiornato per questo tool.'
  } else {
    message = 'Accesso al tool aggiunto. L’utente lo vedrà in dashboard.'
  }

  const warnings: string[] = []
  let inviteEmailDelivery: InviteEmailDelivery = 'none'

  if (needsOnboardingEmail) {
    const portal = await createOnboardingPortalLinkForUser({ userId, toolId })
    if ('error' in portal) {
      return {
        success: false,
        error: `Accesso salvato ma link di invito non generato: ${portal.error}`,
      }
    }

    const sent = await sendPendingInviteActionLinkViaResend({
      apiKey: resendKey!,
      from: fromEmail!,
      to: trimmed,
      portalUrl: portal.portalUrl,
      toolName: invitedToolName,
    })

    if (!sent.ok) {
      console.warn(INVITE_LOG, 'portal invite Resend failed', {
        email: trimmed,
        toolId,
        error: sent.error,
      })
      return {
        success: false,
        error: `Accesso salvato ma l’email di invito non è stata inviata: ${sent.error}`,
        inviteEmailDelivery: 'pending_email_failed',
      }
    }

    await attachResendEmailToActiveTicket(adminClient, userId, sent.id)
    inviteEmailDelivery = 'pending_emailed'
  }

  if (options?.intent === 'resend_pending_onboarding' && inviteEmailDelivery === 'pending_emailed') {
    message =
      'Reinvio completato: nuova email inviata. L’utente deve aprire il link e premere «Continua e accedi».'
  }

  if (inviteKind === 'existing_onboarded') {
    const notifyKind =
      existingRole !== undefined && existingRole !== role ? 'role_updated' : 'access_granted'
    const notify = await notifyUserOfToolAccess(adminClient, {
      appPublicUrl: site,
      userId,
      email: trimmed,
      toolId,
      kind: notifyKind,
      role,
    })
    if (!notify.ok) {
      warnings.push(`Accesso salvato ma l’email di notifica non è stata inviata: ${notify.error}`)
    }
  }

  const warning = warnings.length > 0 ? warnings.join(' ') : undefined

  return {
    success: true,
    message,
    inviteEmailDelivery,
    ...(warning ? { warning } : {}),
  }
}

/**
 * Re-sends onboarding invite link for a user who already has tool access but has not completed onboarding.
 */
export async function resendPendingOnboardingInviteAction(
  toolId: string,
  userId: string
): Promise<InviteUserToToolResult> {
  await requireToolAdmin(toolId)
  let adminClient
  try {
    adminClient = createServiceRoleClient()
  } catch {
    return {
      success: false,
      error:
        'Inviti non attivi: aggiungi SUPABASE_SERVICE_ROLE_KEY alle variabili d’ambiente del server (mai nel client).',
    }
  }

  const { data: access, error: accessError } = await adminClient
    .from('tool_access')
    .select('role')
    .eq('tool_id', toolId)
    .eq('user_id', userId)
    .maybeSingle()

  if (accessError || !access?.role) {
    return { success: false, error: 'Utente non trovato per questo tool o accesso mancante.' }
  }

  const role = access.role as AppInviteRole
  if (role !== 'standard' && role !== 'premium' && role !== 'admin') {
    return { success: false, error: 'Ruolo non valido per reinvio.' }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('email, onboarding_completed')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile?.email) {
    return { success: false, error: 'Profilo o email non trovati per questo utente.' }
  }

  if (profile.onboarding_completed) {
    return {
      success: false,
      error: 'Onboarding già completato: non serve reinvio del link di invito.',
    }
  }

  return inviteUserToToolAction(toolId, profile.email, role, {
    intent: 'resend_pending_onboarding',
  })
}

export type BulkResendPendingResult = {
  success: boolean
  processed: number
  succeeded: number
  failed: number
  errors: string[]
  error?: string
}

/**
 * Reinvia il link di onboarding per più utenti pending (limite per non saturare email).
 */
export async function resendPendingOnboardingInvitesBulkAction(
  toolId: string,
  userIds: string[]
): Promise<BulkResendPendingResult> {
  await requireToolAdmin(toolId)
  const unique = [...new Set(userIds)].filter(Boolean).slice(0, PENDING_INVITE_BULK_RESEND_MAX)
  if (unique.length === 0) {
    return { success: false, processed: 0, succeeded: 0, failed: 0, errors: [], error: 'Nessun utente selezionato.' }
  }

  let succeeded = 0
  let failed = 0
  const errors: string[] = []

  for (const uid of unique) {
    const res = await resendPendingOnboardingInviteAction(toolId, uid)
    if (res.success) {
      succeeded += 1
      if (res.warning) {
        errors.push(`${uid}: ${res.warning}`)
      }
    } else {
      failed += 1
      errors.push(`${uid}: ${res.error ?? 'Errore sconosciuto'}`)
    }
  }

  return {
    success: failed === 0,
    processed: unique.length,
    succeeded,
    failed,
    errors,
    ...(failed > 0
      ? { error: `${failed} reinvii non riusciti su ${unique.length}. Vedere dettagli nei messaggi.` }
      : {}),
  }
}
