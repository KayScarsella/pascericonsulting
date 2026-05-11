'use server'

import {
  notifyUserOfToolAccess,
  sendPendingInviteActionLinkViaResend,
} from '@/lib/tool-access-notify'
import { resolveAuthUserIdByEmail } from '@/lib/resolve-auth-user-by-email'
import { requireToolAdmin } from '@/lib/tool-auth'
import { siteUrlForAuth } from '@/lib/site-url-for-auth'
import { createServiceRoleClient } from '@/utils/supabase/admin'
import { PENDING_INVITE_BULK_RESEND_MAX } from '@/lib/constants'

export type AppInviteRole = 'standard' | 'premium' | 'admin'

export type InviteUserIntent = 'default' | 'resend_pending_onboarding'

/** Esito invio email link pending (reinvio admin); utile per toast mirati. */
export type InviteEmailDelivery =
  | 'pending_emailed'
  | 'pending_email_failed'
  | 'pending_email_missing_env'
  | 'supabase_invite_sent'
  | 'none'

export type InviteUserToToolResult = {
  success: boolean
  error?: string
  message?: string
  /** Set when access was saved but optional email delivery failed (tool notify or pending invite link). */
  warning?: string
  /** Popolato quando si gestisce un link pending via Resend. */
  inviteEmailDelivery?: InviteEmailDelivery
}

type InviteTemplateData = {
  invitation_context: 'tool'
  invited_tool_id: string
  invited_tool_name: string
}

const INVITE_LOG = '[inviteUserToTool]'

async function generatePendingInviteActionLink(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  trimmed: string,
  site: string,
  templateData: InviteTemplateData
): Promise<{ actionLink: string } | { error: string }> {
  const { data: linkGen, error: genLinkError } = await adminClient.auth.admin.generateLink({
    // For already-registered (pending) users, Supabase does not allow generating an "invite" link.
    // A magic link sets a valid session and can continue to /auth/callback -> /onboarding.
    type: 'magiclink',
    email: trimmed,
    options: {
      redirectTo: `${site}/auth/callback`,
      data: templateData,
    },
  })
  if (genLinkError) {
    return {
      error: `Generazione link invito fallita: ${genLinkError.message}`,
    }
  }
  const actionLink = linkGen?.properties?.action_link
  if (!actionLink) {
    return {
      error: 'La risposta Auth non contiene il link di invito (action_link).',
    }
  }
  return { actionLink }
}

/**
 * Sends a Supabase invite email and grants access to the tool.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 * In Supabase Dashboard: Authentication → disable "Allow new users to sign up" for invite-only mode.
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

  let userId: string | null = null
  /** New Auth invite vs existing account (pending or fully onboarded). */
  let inviteKind: 'new_invite' | 'existing_pending' | 'existing_onboarded' = 'new_invite'
  /** Set for `existing_pending`: must be emailed via Resend (generateLink does not send). */
  let pendingInviteActionLink: string | null = null

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

    const onboardingCompleted = Boolean(
      (existingProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed
    )
    if (onboardingCompleted) {
      return {
        success: false,
        error: 'Onboarding già completato: non serve reinvio del link di invito.',
      }
    }

    inviteKind = 'existing_pending'
    const linkResult = await generatePendingInviteActionLink(adminClient, trimmed, site, templateData)
    if ('error' in linkResult) {
      return { success: false, error: linkResult.error }
    }
    pendingInviteActionLink = linkResult.actionLink
  } else {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(trimmed, {
      redirectTo: `${site}/auth/callback`,
      data: templateData,
    })

    userId = data.user?.id ?? null

    if (error) {
      const alreadyRegistered = error.message.toLowerCase().includes('already been registered')
      if (!alreadyRegistered) {
        return {
          success: false,
          error: error.message,
        }
      }

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

      const onboardingCompleted = Boolean(
        (existingProfile as { onboarding_completed?: boolean } | null)?.onboarding_completed
      )
      if (onboardingCompleted) {
        inviteKind = 'existing_onboarded'
      } else {
        inviteKind = 'existing_pending'
        const linkResult = await generatePendingInviteActionLink(adminClient, trimmed, site, templateData)
        if ('error' in linkResult) {
          return {
            success: false,
            error: `Utente pending trovato ma ${linkResult.error}`,
          }
        }
        pendingInviteActionLink = linkResult.actionLink
      }
    }
  }

  if (!userId) {
    return { success: false, error: 'Invito senza utente: controlla i log Auth in Supabase.' }
  }

  const { data: existingAccess } = await adminClient
    .from('tool_access')
    .select('role')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle()

  const existingRole = existingAccess?.role as AppInviteRole | undefined
  /** Pending user + fresh generateLink: must still send email even if tool_access role unchanged. */
  const mustSendPendingLink =
    inviteKind === 'existing_pending' && pendingInviteActionLink !== null
  const forcePendingResend = options?.intent === 'resend_pending_onboarding'
  if (existingRole === role && !mustSendPendingLink && !forcePendingResend) {
    return {
      success: true,
      message: "L'utente ha gia' accesso a questo tool con lo stesso ruolo.",
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

  // Pending / new users: keep a profile shell so admins can see onboarding state.
  // Onboarded existing users: never reset onboarding_completed or invited_at.
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
    message = 'Invito inviato.'
  } else if (inviteKind === 'existing_pending') {
    message =
      hadSameRoleBeforeUpsert && pendingInviteActionLink
        ? 'Nuovo link di invito inviato (controllare la casella email).'
        : 'Tool assegnato; email con link di accesso inviata (se Resend è configurato).'
  } else if (existingRole !== undefined && existingRole !== role) {
    message = 'Ruolo aggiornato per questo tool.'
  } else {
    message = 'Accesso al tool aggiunto. L’utente lo vedrà in dashboard.'
  }

  const warnings: string[] = []
  let inviteEmailDelivery: InviteEmailDelivery = 'none'

  if (pendingInviteActionLink) {
    const resendKey = process.env.RESEND_API_KEY?.trim()
    const fromEmail = process.env.FROM_EMAIL?.trim()
    if (!resendKey || !fromEmail) {
      const w =
        'Accesso salvato ma il link di invito non è stato inviato: configurare RESEND_API_KEY e FROM_EMAIL sul server. Chiedi all’utente di contattare un amministratore per un nuovo invito (o completa la configurazione email e reinvia).'
      warnings.push(w)
      inviteEmailDelivery = 'pending_email_missing_env'
      console.warn(INVITE_LOG, 'pending invite link not emailed (missing Resend env)', {
        email: trimmed,
        toolId,
      })
    } else {
      const sent = await sendPendingInviteActionLinkViaResend({
        apiKey: resendKey,
        from: fromEmail,
        to: trimmed,
        actionLink: pendingInviteActionLink,
        toolName: invitedToolName,
      })
      if (!sent.ok) {
        const w = `Accesso salvato ma l’email con il link di invito non è stata inviata: ${sent.error}`
        warnings.push(w)
        inviteEmailDelivery = 'pending_email_failed'
        console.warn(INVITE_LOG, 'pending invite Resend failed', {
          email: trimmed,
          toolId,
          error: sent.error,
        })
      } else {
        inviteEmailDelivery = 'pending_emailed'
      }
    }
  } else if (inviteKind === 'new_invite' && options?.intent !== 'resend_pending_onboarding') {
    inviteEmailDelivery = 'supabase_invite_sent'
  }

  if (options?.intent === 'resend_pending_onboarding') {
    if (inviteEmailDelivery === 'pending_emailed') {
      message =
        'Reinvio completato: nuova email con link di invito inviata. Chiedi all’utente di controllare la posta (anche spam).'
    } else if (inviteEmailDelivery === 'pending_email_missing_env') {
      message =
        'Link di invito rigenerato sul server, ma nessuna email è partita: configura RESEND_API_KEY e FROM_EMAIL, poi reinvia.'
    } else if (inviteEmailDelivery === 'pending_email_failed') {
      message =
        'Link di invito rigenerato ma l’invio email è fallito: controlla l’avviso sotto e riprova.'
    }
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
 * Uses the same email pipeline as inviteUserToToolAction (generateLink + Resend for pending accounts).
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
