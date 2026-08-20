'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireToolAdmin } from '@/lib/tool-auth'
import {
  clearToolImpersonationCookie,
  isImpersonationAllowedTool,
  setToolImpersonationCookie,
  toolHomePathForImpersonation,
} from '@/lib/tool-impersonation'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function startToolImpersonationAction(
  toolId: string,
  targetUserId: string
): Promise<{ error?: string }> {
  if (!isImpersonationAllowedTool(toolId)) {
    return { error: 'Impersonazione non disponibile per questo tool.' }
  }
  if (!UUID_RE.test(targetUserId)) {
    return { error: 'Utente non valido.' }
  }

  try {
    await requireToolAdmin(toolId)
  } catch {
    return { error: 'Non autorizzato: servono permessi admin.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }
  if (user.id === targetUserId) {
    return { error: 'Non puoi impersonare te stesso.' }
  }

  const { data: access, error } = await supabase
    .from('tool_access')
    .select('user_id')
    .eq('tool_id', toolId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (error || !access) {
    return { error: 'L’utente non ha accesso a questo tool.' }
  }

  await setToolImpersonationCookie(toolId, targetUserId)
  redirect(toolHomePathForImpersonation(toolId))
}

export async function stopToolImpersonationAction(
  toolId?: string
): Promise<void> {
  await clearToolImpersonationCookie()
  if (toolId && isImpersonationAllowedTool(toolId)) {
    redirect(toolHomePathForImpersonation(toolId))
  }
}
