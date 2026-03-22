'use server'

import { requireToolAdmin } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const DEFAULT_PAGE_SIZE = 25

async function getSupabase() {
  return createClient()
}

export async function listProfilesPaginated(
  toolId: string,
  page: number,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ data: ProfileRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (error) return { data: null, totalCount: 0, error: error.message }
    return { data, totalCount: count ?? 0, error: null }
  } catch (e) {
    return {
      data: null,
      totalCount: 0,
      error: e instanceof Error ? e.message : 'Errore',
    }
  }
}

export async function updateProfileAdmin(
  toolId: string,
  profileId: string,
  payload: Partial<
    Pick<
      ProfileRow,
      | 'full_name'
      | 'email'
      | 'username'
      | 'ragione_sociale'
      | 'cf_partita_iva'
      | 'recapito_telefonico'
      | 'indirizzo'
      | 'citta'
      | 'provincia'
      | 'cap'
      | 'settore_merceologico'
      | 'attivita'
      | 'sito_internet'
      | 'avatar_url'
    >
  >
): Promise<{ data: ProfileRow | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()

    const { error } = await supabase
      .from('profiles')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

