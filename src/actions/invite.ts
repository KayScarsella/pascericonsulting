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
    redirectTo: `${site}/callback`,
  })

  if (error) {
    return {
      success: false,
      error: error.message,
    }
  }

  const userId = data.user?.id
  if (!userId) {
    return { success: false, error: 'Invito senza utente: controlla i log Auth in Supabase.' }
  }

  const { error: accessError } = await adminClient.from('tool_access').insert({
    user_id: userId,
    tool_id: toolId,
    role,
  })

  if (accessError) {
    return {
      success: false,
      error: `Utente invitato ma assegnazione al tool fallita: ${accessError.message}. Aggiungi il ruolo da dashboard o correggi i dati.`,
    }
  }

  return { success: true }
}
