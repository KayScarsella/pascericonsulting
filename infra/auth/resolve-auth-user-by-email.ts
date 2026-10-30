import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Resolves auth user id by normalized email: profiles.email first, then paginated auth.admin.listUsers.
 */
export async function resolveAuthUserIdByEmail(
  adminClient: SupabaseClient<Database>,
  normalizedEmail: string
): Promise<{ userId: string } | { error: string }> {
  const { data: profileRow, error: profileLookupError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (profileLookupError) {
    return {
      error: `Utente gia' registrato ma lookup profilo fallito: ${profileLookupError.message}`,
    }
  }
  const profileId = (profileRow as { id?: string } | null)?.id
  if (profileId) {
    return { userId: profileId }
  }

  let page = 1
  const perPage = 200
  const maxPages = 100

  while (page <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return { error: `Utente gia' registrato ma lookup Auth fallito: ${error.message}` }
    }
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail)
    if (match?.id) {
      return { userId: match.id }
    }
    const next = data.nextPage
    if (next == null) break
    page = next
  }

  return {
    error: "Utente gia' registrato ma non trovato (profilo né Auth fino all'ultima pagina elenco).",
  }
}
