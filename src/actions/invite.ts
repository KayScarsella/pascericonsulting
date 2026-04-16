'use server'

import { notifyUserOfToolAccess } from '@/lib/tool-access-notify'
import { requireToolAdmin } from '@/lib/tool-auth'
import { createServiceRoleClient } from '@/utils/supabase/admin'

function siteUrlForAuth(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '')
    return `https://${host}`
  }
  return null
}

export type InviteUserToToolResult = {
  success: boolean
  error?: string
  message?: string
  /** Set when access was saved but the optional Resend notify Edge Function failed. */
  warning?: string
}

/**
 * Sends a Supabase invite email and grants access to the tool.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 * In Supabase Dashboard: Authentication → disable "Allow new users to sign up" for invite-only mode.
 */
export async function inviteUserToToolAction(
  toolId: string,
  email: string,
  role: 'standard' | 'premium' = 'standard'
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

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${site}/auth/callback`,
  })

  let userId = data.user?.id ?? null
  /** New Auth invite vs existing account (pending or fully onboarded). */
  let inviteKind: 'new_invite' | 'existing_pending' | 'existing_onboarded' = 'new_invite'

  if (error) {
    const alreadyRegistered = error.message.toLowerCase().includes('already been registered')
    if (!alreadyRegistered) {
      return {
        success: false,
        error: error.message,
      }
    }

    // Existing user path: reuse the existing account and (re)grant tool access.
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    if (listError) {
      return { success: false, error: `Utente gia' registrato ma lookup fallito: ${listError.message}` }
    }
    userId =
      usersData.users.find((u) => (u.email ?? '').toLowerCase() === trimmed)?.id ?? null
    if (!userId) {
      return {
        success: false,
        error: "Utente gia' registrato ma non trovato nella lista utenti Auth.",
      }
    }

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
      const { error: resendInviteError } = await adminClient.auth.admin.generateLink({
        type: 'invite',
        email: trimmed,
        options: {
          redirectTo: `${site}/auth/callback`,
        },
      })
      if (resendInviteError) {
        return {
          success: false,
          error: `Utente pending trovato ma reinvio invito fallito: ${resendInviteError.message}`,
        }
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

  const existingRole = existingAccess?.role as 'standard' | 'premium' | 'admin' | undefined
  if (existingRole === role) {
    return {
      success: true,
      message: "L'utente ha gia' accesso a questo tool con lo stesso ruolo.",
    }
  }

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
    message = 'Email di accesso inviata e tool assegnato.'
  } else if (existingRole !== undefined && existingRole !== role) {
    message = 'Ruolo aggiornato per questo tool.'
  } else {
    message = 'Accesso al tool aggiunto. L’utente lo vedrà in dashboard.'
  }

  let warning: string | undefined
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
      warning = `Accesso salvato ma l’email di notifica non è stata inviata: ${notify.error}`
    }
  }

  return { success: true, message, ...(warning ? { warning } : {}) }
}
