'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'
import { UserService } from '@/actions/UserService'
import { requireToolAdmin } from '@/lib/tool-auth'
import { createServiceRoleClient } from '@/utils/supabase/admin'
import { deleteRecords } from '@/actions/actions'

const USER_UPLOADS_BUCKET = 'user-uploads'
const USER_UPLOADS_LIST_LIMIT = 1000
const USER_UPLOADS_REMOVE_CHUNK = 200

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
  limit: number = DEFAULT_PAGE_SIZE,
  opts?: { q?: string }
): Promise<{ data: ToolUserRow[] | null; totalCount: number; error: string | null }> {
  try {
    const supabase = await getSupabase()
    const service = new UserService(supabase)
    const { data, totalCount } = await service.getToolUsersPaginated(toolId, page, limit, opts)
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

export async function updateUsersRoleBulkAction(
  toolId: string,
  targetUserIds: string[],
  newRole: 'standard' | 'premium' | 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    if (targetUserIds.length === 0) return { success: true }
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('tool_access')
      .update({ role: newRole })
      .eq('tool_id', toolId)
      .in('user_id', targetUserIds)
      .select('user_id')
    if (error) return { success: false, error: error.message }
    if ((data?.length ?? 0) === 0) {
      return { success: false, error: 'Nessun utente aggiornato (permessi o criteri non validi).' }
    }
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

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function listAllStorageObjectsUnderPrefix(opts: {
  adminClient: ReturnType<typeof createServiceRoleClient>
  bucket: string
  prefix: string
}): Promise<{ paths: string[]; error?: string }> {
  const { adminClient, bucket } = opts
  const rootPrefix = opts.prefix.replace(/\/+$/, '')
  if (!rootPrefix) return { paths: [] }

  const files: string[] = []
  const queue: string[] = [rootPrefix]

  while (queue.length > 0) {
    const folder = queue.shift()!
    let offset = 0

    // Supabase Storage list is not recursive; we traverse folders manually.
    for (;;) {
      const { data, error } = await adminClient.storage.from(bucket).list(folder, {
        limit: USER_UPLOADS_LIST_LIMIT,
        offset,
      })
      if (error) return { paths: files, error: error.message }
      const entries = data ?? []

      for (const entry of entries) {
        const fullPath = `${folder}/${entry.name}`
        const isFolder = entry.id == null
        if (isFolder) queue.push(fullPath)
        else files.push(fullPath)
      }

      if (entries.length < USER_UPLOADS_LIST_LIMIT) break
      offset += USER_UPLOADS_LIST_LIMIT
    }
  }

  return { paths: files }
}

async function removeStorageObjects(opts: {
  adminClient: ReturnType<typeof createServiceRoleClient>
  bucket: string
  paths: string[]
}): Promise<{ removed: number; error?: string }> {
  const { adminClient, bucket, paths } = opts
  if (paths.length === 0) return { removed: 0 }

  let removed = 0
  for (const group of chunk(paths, USER_UPLOADS_REMOVE_CHUNK)) {
    const { error } = await adminClient.storage.from(bucket).remove(group)
    if (error) return { removed, error: error.message }
    removed += group.length
  }
  return { removed }
}

async function removeDocumentFilesByRows(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  rows: Array<{ id: string; storage_path: string | null }>
) {
  const storagePaths = rows
    .map((r) => r.storage_path)
    .filter((p): p is string => Boolean(p))
  if (storagePaths.length > 0) {
    await adminClient.storage.from('documents').remove(storagePaths)
  }
  const ids = rows.map((r) => r.id)
  if (ids.length > 0) {
    await adminClient.from('documents').delete().in('id', ids)
  }
}

export async function deleteUserFromToolAction(
  targetUserId: string,
  toolId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    const supabase = await getSupabase()
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser) return { success: false, error: 'Utente non autenticato.' }
    if (currentUser.id === targetUserId) {
      return { success: false, error: 'Non puoi eliminare completamente il tuo account admin corrente.' }
    }

    const { data: membership } = await supabase
      .from('tool_access')
      .select('user_id')
      .eq('tool_id', toolId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (!membership) {
      return { success: false, error: 'Utente non associato a questo tool.' }
    }

    const adminClient = createServiceRoleClient()

    // 1) Cleanup analisi e file correlati nel tool corrente
    const { data: sessionsForTool } = await adminClient
      .from('assessment_sessions')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('tool_id', toolId)
    const sessionIds = (sessionsForTool ?? []).map((s) => s.id)
    if (sessionIds.length > 0) {
      const res = await deleteRecords(sessionIds)
      if (!res.success) {
        return { success: false, error: res.error ?? 'Cleanup analisi non riuscito.' }
      }
    }

    // 2) Cleanup documenti creati dall'utente nel tool corrente (DB + bucket documents)
    const { data: docsByUserInTool } = await adminClient
      .from('documents')
      .select('id, storage_path')
      .eq('tool_id', toolId)
      .eq('created_by', targetUserId)
    await removeDocumentFilesByRows(adminClient, docsByUserInTool ?? [])

    // 2b) Cleanup entità tool-scoped create dall'utente (es. fornitori)
    const { error: suppliersErr } = await adminClient
      .from('suppliers')
      .delete()
      .eq('tool_id', toolId)
      .eq('user_id', targetUserId)
    if (suppliersErr) {
      return { success: false, error: `Cleanup fornitori fallito: ${suppliersErr.message}` }
    }

    // 3) Se l'utente e' presente solo su questo tool, elimina account completo
    const { data: allMemberships } = await adminClient
      .from('tool_access')
      .select('tool_id')
      .eq('user_id', targetUserId)

    const toolsCount = allMemberships?.length ?? 0
    if (toolsCount <= 1) {
      // Cleanup globale residuo documenti
      const { data: allDocsByUser } = await adminClient
        .from('documents')
        .select('id, storage_path')
        .eq('created_by', targetUserId)
      await removeDocumentFilesByRows(adminClient, allDocsByUser ?? [])

      // Cleanup storage globale (bucket user-uploads): rimuove anche eventuali file orfani non referenziati nel DB
      const { paths, error: listErr } = await listAllStorageObjectsUnderPrefix({
        adminClient,
        bucket: USER_UPLOADS_BUCKET,
        prefix: targetUserId,
      })
      if (listErr) {
        return { success: false, error: `Cleanup storage fallito: ${listErr}` }
      }
      const { error: removeErr } = await removeStorageObjects({
        adminClient,
        bucket: USER_UPLOADS_BUCKET,
        paths,
      })
      if (removeErr) {
        return { success: false, error: `Cleanup storage fallito: ${removeErr}` }
      }

      await adminClient.from('tool_access').delete().eq('user_id', targetUserId)
      await adminClient.from('profiles').delete().eq('id', targetUserId)
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId)
      if (deleteAuthError) {
        return { success: false, error: `Eliminazione Auth fallita: ${deleteAuthError.message}` }
      }
      return { success: true }
    }

    // 4) Altrimenti rimuovi solo dal tool corrente
    const { error: removeMembershipError } = await adminClient
      .from('tool_access')
      .delete()
      .eq('user_id', targetUserId)
      .eq('tool_id', toolId)
    if (removeMembershipError) {
      return { success: false, error: removeMembershipError.message }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

export async function cleanupPendingOnboardingUsersAction(
  toolId: string,
  olderThanDays: number = 7
): Promise<{ success: boolean; removed: number; error?: string }> {
  try {
    await requireToolAdmin(toolId)
    const thresholdIso = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    const adminClient = createServiceRoleClient()

    const { data, error } = await adminClient
      .from('tool_access')
      .select('user_id, profiles!inner(id, onboarding_completed, invited_at)')
      .eq('tool_id', toolId)
      .eq('profiles.onboarding_completed', false)
      .lte('profiles.invited_at', thresholdIso)

    if (error) return { success: false, removed: 0, error: error.message }

    const userIds = (data ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id))

    let removed = 0
    for (const userId of userIds) {
      const { paths } = await listAllStorageObjectsUnderPrefix({
        adminClient,
        bucket: USER_UPLOADS_BUCKET,
        prefix: userId,
      })
      if (paths.length > 0) {
        await removeStorageObjects({ adminClient, bucket: USER_UPLOADS_BUCKET, paths })
      }
      await adminClient.from('tool_access').delete().eq('user_id', userId)
      await adminClient.from('profiles').delete().eq('id', userId)
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId)
      if (!deleteAuthError) removed += 1
    }

    return { success: true, removed }
  } catch (e) {
    return { success: false, removed: 0, error: e instanceof Error ? e.message : 'Errore' }
  }
}
