'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { revalidatePath } from "next/cache"
import { getToolAccess } from "@/lib/tool-auth"

/**
 * Delete assessment sessions and clean up orphaned storage files.
 * Only the session owner or a tool admin can delete (per session's tool).
 * DB cascade will delete user_responses and mitigation_history, but storage
 * files (user-uploads bucket) are NOT cascade-deleted — we must remove them
 * explicitly before deleting sessions to avoid ghost/orphaned files.
 *
 * DB trigger delete_orphaned_parent_session: when we delete a child (analisi_finale)
 * that was the parent's only child, the trigger deletes the parent (verifica) too.
 * We must include such parents in our file cleanup.
 */
export async function deleteRecords(ids: string[]) {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  try {
    if (ids.length === 0) return { success: true }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: "Non autenticato" }

    const { data: sessions, error: fetchErr } = await supabase
      .from('assessment_sessions')
      .select('id, user_id, tool_id')
      .in('id', ids)

    if (fetchErr || !sessions?.length) return { success: false, error: "Sessione non trovata" }

    const toolIds = [...new Set(sessions.map((s) => s.tool_id))]
    const adminByTool = new Map<string, boolean>()
    for (const toolId of toolIds) {
      const { role } = await getToolAccess(toolId)
      adminByTool.set(toolId, role === 'admin')
    }

    const allowedIds = new Set<string>()
    for (const s of sessions) {
      const isOwner = s.user_id === user.id
      const isAdmin = adminByTool.get(s.tool_id) === true
      if (isOwner || isAdmin) allowedIds.add(s.id)
    }

    if (allowedIds.size !== ids.length) {
      return { success: false, error: "Non autorizzato a eliminare una o più analisi o verifiche." }
    }

    const idsToDelete = [...allowedIds]

    // 1a. Children: when deleting parent (verifica), get analisi_finale children
    const { data: children } = await supabase
      .from('assessment_sessions')
      .select('id')
      .in('parent_session_id', idsToDelete)
      .not('parent_session_id', 'is', null);

    // 1b. Parents orphaned by trigger: when we delete a child (analisi_finale) that is the
    //     parent's only child, delete_orphaned_parent_session deletes the parent too.
    const { data: sessionsBeingDeleted } = await supabase
      .from('assessment_sessions')
      .select('id, parent_session_id')
      .in('id', idsToDelete);

    const candidateParentIds = [...new Set(
      (sessionsBeingDeleted ?? [])
        .map(s => s.parent_session_id)
        .filter((p): p is string => Boolean(p))
    )];

    const parentIdsToClean: string[] = [];
    if (candidateParentIds.length > 0) {
      const { data: allChildrenOfCandidates } = await supabase
        .from('assessment_sessions')
        .select('id, parent_session_id')
        .in('parent_session_id', candidateParentIds);
      const childrenByParent = new Map<string, string[]>();
      for (const row of allChildrenOfCandidates ?? []) {
        const pid = row.parent_session_id;
        if (pid == null) continue;
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid)!.push(row.id);
      }
      const idsSet = new Set(idsToDelete);
      for (const parentId of candidateParentIds) {
        const children = childrenByParent.get(parentId) ?? [];
        const weAreDeletingAll = children.every(cid => idsSet.has(cid));
        if (weAreDeletingAll && children.length > 0) parentIdsToClean.push(parentId);
      }
    }

    const allSessionIds = [...new Set([
      ...idsToDelete,
      ...(children?.map(c => c.id) ?? []),
      ...parentIdsToClean,
    ])];

    // 2. Collect file paths from user_responses (question attachments)
    const { data: responseFiles } = await supabase
      .from('user_responses')
      .select('file_path')
      .in('session_id', allSessionIds)
      .not('file_path', 'is', null);

    // 3. Collect file paths from mitigation_history (mitigation attachments)
    const { data: mitigationFiles } = await supabase
      .from('mitigation_history')
      .select('file_path')
      .in('session_id', allSessionIds)
      .not('file_path', 'is', null);

    const filePaths = [
      ...(responseFiles?.map(r => r.file_path).filter((p): p is string => Boolean(p)) ?? []),
      ...(mitigationFiles?.map(m => m.file_path).filter((p): p is string => Boolean(p)) ?? []),
    ];

    // 4. Remove files from storage (ignore errors for missing files)
    if (filePaths.length > 0) {
      await supabase.storage.from('user-uploads').remove(filePaths);
    }

    // 5. Delete assessment sessions: children first (to avoid FK violations), then requested ids
    const childIds = (children?.map(c => c.id) ?? []).filter(id => !idsToDelete.includes(id));
    if (childIds.length > 0) {
      const { error: childErr } = await supabase.from('assessment_sessions').delete().in('id', childIds);
      if (childErr) throw childErr;
    }
    const { error } = await supabase.from('assessment_sessions').delete().in('id', idsToDelete);
    if (error) throw error;

    revalidatePath('/timberRegulation/search');
    revalidatePath('/EUDR/search');
    revalidatePath('/search');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante l'eliminazione";
    return { success: false, error: errorMessage };
  }
}