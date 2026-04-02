'use server'

import { requireToolAdmin } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/supabase'
import type { SortDir } from '@/lib/table-query'

type SpeciesRow = Database['public']['Tables']['species']['Row']
type SpeciesInsert = Database['public']['Tables']['species']['Insert']
type CountryRow = Database['public']['Tables']['country']['Row']
type CountryInsert = Database['public']['Tables']['country']['Insert']

async function getSupabase() {
  return createClient()
}

// ---------------------------------------------------------------------------
// SPECIES
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 25

export async function listSpecies(toolId: string): Promise<{ data: SpeciesRow[] | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('species')
      .select('*')
      .order('scientific_name', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function listSpeciesPaginated(
  toolId: string,
  page: number,
  limit: number = DEFAULT_PAGE_SIZE,
  opts?: {
    q?: string
    sort?: 'scientific_name' | 'common_name' | 'cites'
    dir?: SortDir
  }
): Promise<{ data: SpeciesRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const query = supabase
      .from('species')
      .select('*', { count: 'exact' })
      .range(from, to)
    const q = (opts?.q ?? '').trim()
    if (q) {
      const n = Number.parseInt(q, 10)
      const numericClause = Number.isFinite(n) ? `,cites.eq.${n}` : ''
      query.or(
        [
          `scientific_name.ilike.%${q}%`,
          `common_name.ilike.%${q}%`,
        ].join(',') + numericClause
      )
    }
    const sort = opts?.sort ?? 'scientific_name'
    const dir = opts?.dir ?? 'asc'
    query.order(sort, { ascending: dir === 'asc' })

    const { data, error, count } = await query
    if (error) return { data: null, totalCount: 0, error: error.message }
    return { data, totalCount: count ?? 0, error: null }
  } catch (e) {
    return { data: null, totalCount: 0, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function createSpecies(
  toolId: string,
  payload: { scientific_name?: string | null; common_name?: string | null; cites?: number | null }
): Promise<{ data: SpeciesRow | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const insert: SpeciesInsert = {
      scientific_name: payload.scientific_name ?? null,
      common_name: payload.common_name ?? null,
      cites: payload.cites ?? null,
    }
    const { data, error } = await supabase.from('species').insert(insert).select().single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateSpecies(
  toolId: string,
  id: string,
  payload: { scientific_name?: string | null; common_name?: string | null; cites?: number | null }
): Promise<{ data: SpeciesRow | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('species')
      .update({
        scientific_name: payload.scientific_name,
        common_name: payload.common_name,
        cites: payload.cites,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteSpecies(toolId: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { error } = await supabase.from('species').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteSpeciesBulk(toolId: string, ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    if (ids.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { error } = await supabase.from('species').delete().in('id', ids)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateSpeciesBulk(
  toolId: string,
  ids: string[],
  patch: Partial<Pick<SpeciesRow, 'cites'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    if (ids.length === 0) return { success: true }

    const update: Partial<SpeciesInsert> = {}
    if (patch.cites === null) update.cites = null
    if (typeof patch.cites === 'number') update.cites = patch.cites

    if (Object.keys(update).length === 0) {
      return { success: false, error: 'Nessun campo valido da aggiornare.' }
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('species')
      .update(update)
      .in('id', ids)
      .select('id')
    if (error) return { success: false, error: error.message }
    if ((data?.length ?? 0) === 0) {
      return { success: false, error: 'Nessun record aggiornato (permessi o criteri non validi).' }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

// ---------------------------------------------------------------------------
// COUNTRY
// ---------------------------------------------------------------------------

export async function listCountries(toolId: string): Promise<{ data: CountryRow[] | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('country')
      .select('*')
      .order('country_name', { ascending: true })
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function listCountriesPaginated(
  toolId: string,
  page: number,
  limit: number = DEFAULT_PAGE_SIZE,
  opts?: {
    q?: string
    sort?:
      | 'country_name'
      | 'extra_eu'
      | 'conflicts'
      | 'sanction'
      | 'corruption_code'
      | 'country_risk'
      | 'fao'
      | 'FSI'
      | 'RLI'
      | 'ILO'
    dir?: SortDir
  }
): Promise<{ data: CountryRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const query = supabase
      .from('country')
      .select('*', { count: 'exact' })
      .range(from, to)
    const qRaw = (opts?.q ?? '').trim()
    // PostgREST `.or()` does NOT support SQL expressions (e.g. `::text` casts).
    // Keep the `.or()` clause restricted to PostgREST-safe filters.
    const qSafe = qRaw.replace(/[,%()]/g, ' ').trim()
    if (qSafe) {
      const enumValues = ['AA', 'MA', 'MB', 'MM', 'TT'] as const
      const qUpper = qSafe.toUpperCase()
      const enumMatches = enumValues.filter((v) => v.includes(qUpper))

      const clauses = [`country_name.ilike.%${qSafe}%`]
      if (enumMatches.length === 1) {
        clauses.push(`corruption_code.eq.${enumMatches[0]}`)
      } else if (enumMatches.length > 1) {
        clauses.push(`corruption_code.in.(${enumMatches.join(',')})`)
      }

      query.or(clauses.join(','))
    }
    const sort = opts?.sort ?? 'country_name'
    const dir = opts?.dir ?? 'asc'
    query.order(sort, { ascending: dir === 'asc' })

    const { data, error, count } = await query
    if (error) return { data: null, totalCount: 0, error: error.message }
    return { data, totalCount: count ?? 0, error: null }
  } catch (e) {
    return { data: null, totalCount: 0, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function createCountry(
  toolId: string,
  payload: {
    country_name?: string | null
    extra_eu?: boolean | null
    conflicts?: boolean | null
    sanction?: boolean | null
    corruption_code?: string | null
    country_risk?: Database['public']['Enums']['country_risk'] | null
    fao?: number | null
    FSI?: number | null
    RLI?: number | null
    ILO?: number | null
  }
): Promise<{ data: CountryRow | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const insert: CountryInsert = {
      country_name: payload.country_name ?? null,
      extra_eu: payload.extra_eu ?? null,
      conflicts: payload.conflicts ?? null,
      sanction: payload.sanction ?? null,
      corruption_code: (payload.corruption_code ?? null) as CountryInsert["corruption_code"],
      country_risk: payload.country_risk ?? null,
      fao: payload.fao ?? null,
      FSI: payload.FSI ?? null,
      RLI: payload.RLI ?? null,
      ILO: payload.ILO ?? null,
    }
    const { data, error } = await supabase.from('country').insert(insert).select().single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateCountry(
  toolId: string,
  id: string,
  payload: {
    country_name?: string | null
    extra_eu?: boolean | null
    conflicts?: boolean | null
    sanction?: boolean | null
    corruption_code?: string | null
    country_risk?: Database['public']['Enums']['country_risk'] | null
    fao?: number | null
    FSI?: number | null
    RLI?: number | null
    ILO?: number | null
  }
): Promise<{ data: CountryRow | null; error: string | null }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('country')
      .update({
        country_name: payload.country_name,
        extra_eu: payload.extra_eu,
        conflicts: payload.conflicts,
        sanction: payload.sanction,
        corruption_code: payload.corruption_code as CountryInsert["corruption_code"],
        country_risk: payload.country_risk,
        fao: payload.fao,
        FSI: payload.FSI,
        RLI: payload.RLI,
        ILO: payload.ILO,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteCountry(toolId: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const { error } = await supabase.from('country').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteCountriesBulk(toolId: string, ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    if (ids.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { error } = await supabase.from('country').delete().in('id', ids)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateCountriesBulk(
  toolId: string,
  ids: string[],
  patch: Partial<Pick<CountryRow, 'extra_eu' | 'conflicts' | 'sanction' | 'corruption_code'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    if (ids.length === 0) return { success: true }

    const allowedEnum = new Set(['AA', 'MA', 'MB', 'MM', 'TT'])
    if (patch.corruption_code != null && !allowedEnum.has(String(patch.corruption_code))) {
      return { success: false, error: 'Codice corruzione non valido.' }
    }

    const update: Partial<CountryInsert> = {}
    if (typeof patch.extra_eu === 'boolean') update.extra_eu = patch.extra_eu
    if (typeof patch.conflicts === 'boolean') update.conflicts = patch.conflicts
    if (typeof patch.sanction === 'boolean') update.sanction = patch.sanction
    if (patch.corruption_code === null) update.corruption_code = null
    if (typeof patch.corruption_code === 'string' && patch.corruption_code.trim()) {
      update.corruption_code = patch.corruption_code.trim() as CountryInsert['corruption_code']
    }

    if (Object.keys(update).length === 0) {
      return { success: false, error: 'Nessun campo valido da aggiornare.' }
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('country')
      .update(update)
      .in('id', ids)
      .select('id')
    if (error) return { success: false, error: error.message }
    if ((data?.length ?? 0) === 0) {
      return { success: false, error: 'Nessun record aggiornato (permessi o criteri non validi).' }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}
