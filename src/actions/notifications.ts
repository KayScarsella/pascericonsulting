'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getToolAccess } from '@/lib/tool-auth'
import { Database } from '@/types/supabase'

type NotificationRow = Database['public']['Tables']['notifications']['Row']
type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

const PAGE_SIZE = 25

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

/** List active, not expired notifications for a tool (e.g. for the tool home page). User must have access to the tool. */
export async function listNotificationsForTool(toolId: string): Promise<NotificationRow[]> {
  const supabase = await getSupabase()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('tool_id', toolId)
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order('created_at', { ascending: false })
  if (error) return []
  return data ?? []
}

/** Paginated list for admin table (requires admin of given tool). */
export async function listNotificationsPaginated(
  toolId: string,
  page: number,
  limit: number = PAGE_SIZE
): Promise<{ data: NotificationRow[] | null; totalCount: number; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const from = (page - 1) * limit
    const to = from + limit - 1
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) return { data: null, totalCount: 0, error: error.message }
    return { data, totalCount: count ?? 0, error: null }
  } catch (e) {
    return { data: null, totalCount: 0, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function createNotification(
  toolId: string,
  payload: { title: string; message?: string | null; expires_at?: string | null; is_active?: boolean }
): Promise<{ data: NotificationRow | null; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const insert: NotificationInsert = {
      tool_id: toolId,
      title: payload.title.trim() || 'Senza titolo',
      message: payload.message?.trim() || null,
      expires_at: payload.expires_at || null,
      is_active: payload.is_active ?? true,
    }
    const { data, error } = await supabase.from('notifications').insert(insert).select().single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateNotification(
  toolId: string,
  id: string,
  payload: { title?: string; message?: string | null; expires_at?: string | null; is_active?: boolean }
): Promise<{ data: NotificationRow | null; error: string | null }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('notifications')
      .update({
        title: payload.title !== undefined ? payload.title.trim() : undefined,
        message: payload.message !== undefined ? payload.message?.trim() || null : undefined,
        expires_at: payload.expires_at !== undefined ? payload.expires_at || null : undefined,
        is_active: payload.is_active,
      })
      .eq('id', id)
      .eq('tool_id', toolId)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteNotification(toolId: string, id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin(toolId)
    const supabase = await getSupabase()
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('tool_id', toolId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function deleteNotificationsBulk(toolId: string, ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin(toolId)
    if (ids.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('tool_id', toolId)
      .in('id', ids)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}
