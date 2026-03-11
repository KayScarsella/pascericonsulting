'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getToolAccess } from '@/lib/tool-auth'
import { Database } from '@/types/supabase'

type SpeciesRow = Database['public']['Tables']['species']['Row']
type SpeciesInsert = Database['public']['Tables']['species']['Insert']
type CountryRow = Database['public']['Tables']['country']['Row']
type CountryInsert = Database['public']['Tables']['country']['Insert']

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function requireAdmin(toolId: string) {
  const { role } = await getToolAccess(toolId)
  if (role !== 'admin') throw new Error('Non autorizzato: servono permessi admin')
}

// ---------------------------------------------------------------------------
// SPECIES
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 25

export async function listSpecies(toolId: string): Promise<{ data: SpeciesRow[] | null; error: string | null }> {
  try {
    await requireAdmin(toolId)
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
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ data: SpeciesRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error, count } = await supabase
      .from('species')
      .select('*', { count: 'exact' })
      .order('scientific_name', { ascending: true })
      .range(from, to)
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
    await requireAdmin(toolId)
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
    await requireAdmin(toolId)
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
    await requireAdmin(toolId)
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
    await requireAdmin(toolId)
    if (ids.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { error } = await supabase.from('species').delete().in('id', ids)
    if (error) return { success: false, error: error.message }
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
    await requireAdmin(toolId)
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
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ data: CountryRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error, count } = await supabase
      .from('country')
      .select('*', { count: 'exact' })
      .order('country_name', { ascending: true })
      .range(from, to)
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
  }
): Promise<{ data: CountryRow | null; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const insert: CountryInsert = {
      country_name: payload.country_name ?? null,
      extra_eu: payload.extra_eu ?? null,
      conflicts: payload.conflicts ?? null,
      sanction: payload.sanction ?? null,
      corruption_code: payload.corruption_code ?? null,
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
  }
): Promise<{ data: CountryRow | null; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('country')
      .update({
        country_name: payload.country_name,
        extra_eu: payload.extra_eu,
        conflicts: payload.conflicts,
        sanction: payload.sanction,
        corruption_code: payload.corruption_code,
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
    await requireAdmin(toolId)
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
    await requireAdmin(toolId)
    if (ids.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { error } = await supabase.from('country').delete().in('id', ids)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}
