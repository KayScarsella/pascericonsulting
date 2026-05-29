'use server'

import { siteUrlForAuth } from '@/lib/site-url-for-auth'
import {
  buildOnboardingPortalUrl,
  createOnboardingPortalTicket,
  recordOnboardingMagiclinkMint,
  recordOnboardingPortalView,
  resolveOnboardingPortalTicket,
} from '@/lib/onboarding-invite-ticket'
import { createServiceRoleClient } from '@/utils/supabase/admin'

export type OnboardingEntryState =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'already_onboarded' }
  | { status: 'ready'; toolName: string | null }

export async function getOnboardingEntryStateAction(
  plainToken: string
): Promise<OnboardingEntryState> {
  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { status: 'invalid' }
  }

  const resolved = await resolveOnboardingPortalTicket(admin, plainToken)
  if (!resolved.ok) {
    if (resolved.reason === 'expired') return { status: 'expired' }
    return { status: 'invalid' }
  }

  await recordOnboardingPortalView(admin, plainToken)

  const { user_id: userId, tool_id: toolId } = resolved.ticket

  const { data: profile } = await admin
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.onboarding_completed) {
    return { status: 'already_onboarded' }
  }

  let toolName: string | null = null
  if (toolId) {
    const { data: toolRow } = await admin.from('tools').select('name').eq('id', toolId).maybeSingle()
    toolName = toolRow?.name?.trim() ?? null
  }

  return { status: 'ready', toolName }
}

export type ContinueOnboardingResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string; code: 'invalid' | 'expired' | 'already_onboarded' | 'config' }

/**
 * Called only on explicit user click. Mints a fresh one-time Supabase magic link.
 * Email scanners that only GET /auth/onboarding-entry never reach this action.
 */
export async function continueOnboardingFromTicketAction(
  plainToken: string
): Promise<ContinueOnboardingResult> {
  const site = siteUrlForAuth()
  if (!site) {
    return {
      success: false,
      code: 'config',
      error: 'Configurazione sito mancante (NEXT_PUBLIC_SITE_URL).',
    }
  }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return {
      success: false,
      code: 'config',
      error: 'Server non configurato per gli inviti.',
    }
  }

  const resolved = await resolveOnboardingPortalTicket(admin, plainToken)
  if (!resolved.ok) {
    return {
      success: false,
      code: resolved.reason === 'expired' ? 'expired' : 'invalid',
      error:
        resolved.reason === 'expired'
          ? 'Questo link di accesso è scaduto. Chiedi un nuovo invito all’amministratore.'
          : 'Link di accesso non valido. Chiedi un nuovo invito all’amministratore.',
    }
  }

  const { user_id: userId, tool_id: toolId } = resolved.ticket

  const { data: profile } = await admin
    .from('profiles')
    .select('email, onboarding_completed')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.email) {
    return {
      success: false,
      code: 'invalid',
      error: 'Profilo utente non trovato.',
    }
  }

  if (profile.onboarding_completed) {
    return {
      success: false,
      code: 'already_onboarded',
      error: 'Onboarding già completato. Accedi dalla pagina di login.',
    }
  }

  const email = profile.email.trim().toLowerCase()

  let invitedToolName = 'Pasceri Consulting'
  const templateData: Record<string, string> = {
    invitation_context: 'tool',
  }
  if (toolId) {
    templateData.invited_tool_id = toolId
    const { data: toolRow } = await admin.from('tools').select('name').eq('id', toolId).maybeSingle()
    invitedToolName = toolRow?.name?.trim() || invitedToolName
    templateData.invited_tool_name = invitedToolName
  }

  const { data: linkGen, error: genLinkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${site}/auth/callback`,
      data: templateData,
    },
  })

  if (genLinkError) {
    return {
      success: false,
      code: 'invalid',
      error: `Impossibile avviare l’accesso: ${genLinkError.message}`,
    }
  }

  const actionLink = linkGen?.properties?.action_link
  if (!actionLink) {
    return {
      success: false,
      code: 'invalid',
      error: 'Risposta Auth senza link di accesso.',
    }
  }

  await recordOnboardingMagiclinkMint(admin, plainToken)

  return { success: true, redirectUrl: actionLink }
}

/** Used by invite flow: create ticket and build portal URL for emails. */
export async function createOnboardingPortalLinkForUser(input: {
  userId: string
  toolId: string
}): Promise<{ portalUrl: string } | { error: string }> {
  const site = siteUrlForAuth()
  if (!site) {
    return { error: 'NEXT_PUBLIC_SITE_URL non configurato.' }
  }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY mancante.' }
  }

  const ticket = await createOnboardingPortalTicket(admin, {
    userId: input.userId,
    toolId: input.toolId,
  })

  if ('error' in ticket) {
    return { error: ticket.error }
  }

  return {
    portalUrl: buildOnboardingPortalUrl(site, ticket.plainToken),
  }
}
