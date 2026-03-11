'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { UserService } from '@/actions/UserService'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

export type ToolUserRow = Awaited<ReturnType<UserService['getToolUsers']>>[number]

export async function getToolUsersForAdmin(toolId: string): Promise<{ data: ToolUserRow[] | null; error: string | null }> {
  try {
    const supabase = await getSupabase()
    const service = new UserService(supabase)
    const data = await service.getToolUsers(toolId)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore' }
  }
}

const DEFAULT_PAGE_SIZE = 25

export async function getToolUsersForAdminPaginated(
  toolId: string,
  page: number,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<{ data: ToolUserRow[] | null; totalCount: number; error: string | null }> {
  try {
    const supabase = await getSupabase()
    const service = new UserService(supabase)
    const { data, totalCount } = await service.getToolUsersPaginated(toolId, page, limit)
    return { data, totalCount, error: null }
  } catch (e) {
    return { data: null, totalCount: 0, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function updateUserRoleAction(
  targetUserId: string,
  toolId: string,
  newRole: 'standard' | 'premium' | 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase()
    const service = new UserService(supabase)
    await service.updateUserRole(targetUserId, toolId, newRole)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function removeUserFromToolAction(
  targetUserId: string,
  toolId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase()
    const service = new UserService(supabase)
    await service.removeUserFromTool(targetUserId, toolId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}
