import { unstable_cache, updateTag } from "next/cache"
import { createServiceRoleClient } from "@/utils/supabase/admin"
import type { Database } from "@/types/supabase"

const DOCUMENT_LIST_COLUMNS =
  "id, name, type, parent_id, storage_path, size, mime_type, allowed_roles, min_role, tool_id, created_at" as const

const DOCUMENTS_PAGE_SIZE = 100

export type CachedDocumentListItem = Pick<
  Database["public"]["Tables"]["documents"]["Row"],
  | "id"
  | "name"
  | "type"
  | "parent_id"
  | "storage_path"
  | "size"
  | "mime_type"
  | "allowed_roles"
  | "min_role"
  | "tool_id"
  | "created_at"
>

/** Shared across tools. One tag per tool busts every folder listing for that tool. */
export function documentsTag(toolId: string) {
  return `documents:${toolId}`
}

/** Server Actions only — read-your-writes after a documents write. */
export function touchDocuments(toolId: string) {
  updateTag(documentsTag(toolId))
}

function folderCacheKey(folderId: string | null) {
  return folderId ?? "root"
}

async function loadDocumentsListing(
  toolId: string,
  folderId: string | null
): Promise<CachedDocumentListItem[]> {
  const supabase = createServiceRoleClient()
  let query = supabase
    .from("documents")
    .select(DOCUMENT_LIST_COLUMNS)
    .eq("tool_id", toolId)

  if (folderId) {
    query = query.eq("parent_id", folderId)
  } else {
    query = query.is("parent_id", null)
  }

  const { data, error } = await query
    .order("type", { ascending: false })
    .order("name", { ascending: true })
    .range(0, DOCUMENTS_PAGE_SIZE - 1)

  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * Unfiltered listing for one tool folder (root when folderId is null).
 * Callers apply the role check after this returns. Do not call cookies() here.
 */
export function getCachedDocumentsListing(toolId: string, folderId: string | null) {
  return unstable_cache(
    () => loadDocumentsListing(toolId, folderId),
    ["documents", toolId, folderCacheKey(folderId)],
    { tags: [documentsTag(toolId)], revalidate: 3600 }
  )()
}
