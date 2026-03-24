'use server'

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

/**
 * Sends a Supabase invite email and grants access to the tool.
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server.
 * In Supabase Dashboard: Authentication → disable "Allow new users to sign up" for invite-only mode.
 */
export async function inviteUserToToolAction(
  toolId: string,
  email: string,
  role: 'standard' | 'premium' = 'standard'
): Promise<{ success: boolean; error?: string }> {
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
      return {
        success: false,
        error:
          "L'utente e' gia' registrato e ha completato l'onboarding. Non e' possibile reinviare l'invito.",
      }
    }

    const { error: resendError } = await adminClient.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${site}/auth/callback`,
    })
    if (resendError) {
      return {
        success: false,
        error: `Utente pending trovato ma invio email fallito: ${resendError.message}`,
      }
    }
  }

  if (!userId) {
    return { success: false, error: 'Invito senza utente: controlla i log Auth in Supabase.' }
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

  // Keep a profile shell so admins can see pending onboarding users.
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

  return { success: true }
}
