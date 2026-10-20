"use server"

import { getToolAccess } from "@/lib/tool-auth"
import type { ToolRole } from "@/lib/tool-auth"
import {
  canAccessAllowedRoles,
  DEFAULT_ALLOWED_ROLES,
  normalizeAllowedRoles,
} from "@/lib/tool-role-access"
import {
  assertStoragePathForTool,
  createDocumentSignedUrls,
  DOCUMENT_SIGNED_URL_TTL_SEC,
} from "@/lib/documents-download"
import {
  buildDocumentStoragePath,
  validateDocumentFileMetadata,
} from "@/lib/documents-upload"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

type AppRole = Database["public"]["Enums"]["app_role"]

async function getSupabase() {
  return createClient()
}

async function requireDocumentAdmin(toolId: string) {
  const { role, userId } = await getToolAccess(toolId)
  if (role !== "admin") return { error: "Non autorizzato: servono permessi admin" as const }

  const supabase = await getSupabase()
  return { supabase, user: { id: userId } }
}

const DOCUMENTS_STORAGE_REMOVE_CHUNK = 200

function chunkPaths<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function resolveEffectiveAllowedRoles(
  supabase: SupabaseClient<Database>,
  toolId: string,
  parentId: string | null,
  requested: ToolRole[]
): Promise<AppRole[]> {
  const normalized = normalizeAllowedRoles(requested) as AppRole[]
  if (!parentId) return normalized

  const { data: parent } = await supabase
    .from("documents")
    .select("allowed_roles, type")
    .eq("id", parentId)
    .eq("tool_id", toolId)
    .single()

  if (!parent || parent.type !== "folder") return normalized
  const parentRoles = (parent.allowed_roles ?? DEFAULT_ALLOWED_ROLES) as AppRole[]
  // Intersezione: figli non possono ampliare rispetto al padre
  const parentSet = new Set(parentRoles)
  const intersected = normalized.filter((r) => parentSet.has(r) || r === "admin")
  return normalizeAllowedRoles(intersected.length ? intersected : parentRoles) as AppRole[]
}

async function assertDocumentDownloadAccess(
  supabase: SupabaseClient<Database>,
  storagePath: string,
  toolId: string,
  role: ToolRole
): Promise<{ error?: string }> {
  const { data: doc } = await supabase
    .from("documents")
    .select("allowed_roles, min_role")
    .eq("storage_path", storagePath)
    .eq("tool_id", toolId)
    .eq("type", "file")
    .maybeSingle()

  if (!doc) return { error: "Documento non trovato" }
  const allowed =
    (doc.allowed_roles as string[] | null)?.length
      ? (doc.allowed_roles as string[])
      : DEFAULT_ALLOWED_ROLES
  if (!canAccessAllowedRoles(role, allowed)) {
    return { error: "Contenuto riservato: non hai accesso a questa cartella" }
  }
  return {}
}

/**
 * Crea una cartella.
 * Richiede ruolo 'admin' per quel tool_id.
 */
export async function createFolder(
  toolId: string,
  parentId: string | null,
  name: string,
  pathRevalidate: string,
  allowedRoles: ToolRole[] = DEFAULT_ALLOWED_ROLES
) {
  const { role } = await getToolAccess(toolId)
  if (role !== "admin") return { error: "Non autorizzato: servono permessi admin" }

  const supabase = await getSupabase()
  const effective = await resolveEffectiveAllowedRoles(
    supabase,
    toolId,
    parentId,
    allowedRoles
  )

  const { error } = await supabase.from("documents").insert({
    tool_id: toolId,
    parent_id: parentId,
    name,
    type: "folder",
    allowed_roles: effective,
    // Legacy sync: premium-only se manca standard
    min_role: effective.includes("standard") ? "standard" : "premium",
  })

  if (error) return { error: error.message }

  revalidatePath(pathRevalidate)
  return { success: true }
}

async function cascadeDocumentAllowedRoles(
  supabase: SupabaseClient<Database>,
  folderId: string,
  toolId: string,
  allowedRoles: AppRole[]
): Promise<void> {
  const minRole = allowedRoles.includes("standard") ? "standard" : "premium"
  const { error } = await supabase.rpc("cascade_document_allowed_roles", {
    p_folder_id: folderId,
    p_tool_id: toolId,
    p_allowed_roles: allowedRoles,
    p_min_role: minRole,
  })
  if (error) throw new Error(error.message)
}

/**
 * Aggiorna visibilità di una cartella esistente (e propaga ai contenuti).
 * Richiede ruolo admin.
 */
export async function updateFolderAllowedRoles(
  folderId: string,
  toolId: string,
  allowedRoles: ToolRole[],
  pathRevalidate: string
) {
  const auth = await requireDocumentAdmin(toolId)
  if ("error" in auth) return { error: auth.error }
  const { supabase } = auth

  const { data: folder, error: fetchError } = await supabase
    .from("documents")
    .select("id, type, parent_id, name")
    .eq("id", folderId)
    .eq("tool_id", toolId)
    .single()

  if (fetchError || !folder) return { error: "Cartella non trovata" }
  if (folder.type !== "folder") return { error: "L'elemento selezionato non è una cartella" }

  const effective = await resolveEffectiveAllowedRoles(
    supabase,
    toolId,
    folder.parent_id,
    allowedRoles
  )

  const { data: updatedFolder, error: updateError } = await supabase
    .from("documents")
    .update({
      allowed_roles: effective,
      min_role: effective.includes("standard") ? "standard" : "premium",
    })
    .eq("id", folderId)
    .eq("tool_id", toolId)
    .select("id, allowed_roles")

  if (updateError) return { error: updateError.message }
  if (!updatedFolder?.length) {
    return {
      error:
        "Aggiornamento non applicato: verifica i permessi admin sul tool o riprova.",
    }
  }

  try {
    await cascadeDocumentAllowedRoles(supabase, folderId, toolId, effective)
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Errore durante l'aggiornamento dei contenuti",
    }
  }

  revalidatePath(pathRevalidate)
  return {
    success: true,
    allowedRoles: updatedFolder[0].allowed_roles as ToolRole[],
  }
}

/** @deprecated Use updateFolderAllowedRoles */
export async function updateFolderMinRole(
  folderId: string,
  toolId: string,
  minRole: "standard" | "premium",
  pathRevalidate: string
) {
  const allowed =
    minRole === "premium"
      ? (["premium", "admin"] as ToolRole[])
      : (["standard", "premium", "admin"] as ToolRole[])
  return updateFolderAllowedRoles(folderId, toolId, allowed, pathRevalidate)
}

/** Step 1: autorizza admin e riserva path storage (payload leggero, niente file). */
export async function prepareDocumentUpload(
  toolId: string,
  fileName: string,
  fileSize: number,
  mimeType: string
) {
  const auth = await requireDocumentAdmin(toolId)
  if ("error" in auth) return { error: auth.error }

  const validationError = validateDocumentFileMetadata({ fileName, fileSize, mimeType })
  if (validationError) return { error: validationError }

  const storagePath = buildDocumentStoragePath(toolId, fileName)
  return { storagePath }
}

/** Step 2: registra metadati DB dopo upload diretto client → Storage. */
export async function finalizeDocumentUpload(
  toolId: string,
  parentId: string | null,
  storagePath: string,
  fileName: string,
  mimeType: string,
  size: number,
  pathRevalidate: string
) {
  const auth = await requireDocumentAdmin(toolId)
  if ("error" in auth) return { error: auth.error }
  const { supabase, user } = auth

  const validationError = validateDocumentFileMetadata({ fileName, fileSize: size, mimeType })
  if (validationError) return { error: validationError }

  try {
    assertStoragePathForTool(storagePath, toolId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Percorso non valido" }
  }

  const fileAllowed = await resolveEffectiveAllowedRoles(
    supabase,
    toolId,
    parentId,
    DEFAULT_ALLOWED_ROLES
  )

  const { error: dbError } = await supabase.from("documents").insert({
    tool_id: toolId,
    parent_id: parentId,
    name: fileName,
    type: "file",
    storage_path: storagePath,
    mime_type: mimeType || null,
    size,
    created_by: user.id,
    allowed_roles: fileAllowed,
    min_role: fileAllowed.includes("standard") ? "standard" : "premium",
  })

  if (dbError) {
    await supabase.storage.from("documents").remove([storagePath])
    // Unique/FK failures usually mean missing upload or race; surface a clear message.
    if (dbError.code === "23505" || dbError.message.toLowerCase().includes("duplicate")) {
      return { error: "File non trovato in storage o già registrato. Riprova l'upload." }
    }
    return { error: dbError.message }
  }

  revalidatePath(pathRevalidate)
  return { success: true }
}

/** Cleanup se l'upload client fallisce dopo prepare. */
export async function abortDocumentUpload(toolId: string, storagePath: string) {
  const auth = await requireDocumentAdmin(toolId)
  if ("error" in auth) return { error: auth.error }
  const { supabase } = auth

  try {
    assertStoragePathForTool(storagePath, toolId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Percorso non valido" }
  }

  await supabase.storage.from("documents").remove([storagePath])
  return { success: true }
}

export async function deleteItem(id: string, toolId: string, pathRevalidate: string) {
  const { role } = await getToolAccess(toolId)
  if (role !== "admin") return { error: "Non autorizzato" }

  const supabase = await getSupabase()

  try {
    const { data: pathsToDelete, error: rpcError } = await supabase.rpc(
      "get_recursive_storage_paths",
      { target_id: id }
    )

    if (rpcError) {
      console.error("Errore RPC:", rpcError)
      return { error: "Impossibile recuperare i file da eliminare" }
    }
    if (pathsToDelete && pathsToDelete.length > 0) {
      const paths = pathsToDelete.map((row: { storage_path: string }) => row.storage_path)
      for (const group of chunkPaths(paths, DOCUMENTS_STORAGE_REMOVE_CHUNK)) {
        const { error: storageError } = await supabase.storage.from("documents").remove(group)
        if (storageError) {
          console.error("Errore Storage:", storageError)
          return { error: "Impossibile eliminare i file dallo storage. Riprova." }
        }
      }
    }

    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("tool_id", toolId)

    if (dbError) return { error: dbError.message }

    revalidatePath(pathRevalidate)
    return { success: true }
  } catch (err) {
    console.error(err)
    return { error: "Errore imprevisto durante l'eliminazione" }
  }
}

/**
 * URL firmato singolo (fallback se prefetch scaduto).
 * Richiede accesso al tool; il path deve essere sotto `{toolId}/`.
 */
export async function getDownloadUrl(storagePath: string, toolId: string) {
  const { role } = await getToolAccess(toolId)
  if (!role) return { error: "Accesso negato al tool" }

  try {
    assertStoragePathForTool(storagePath, toolId)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Percorso non valido" }
  }

  const supabase = await getSupabase()
  const access = await assertDocumentDownloadAccess(supabase, storagePath, toolId, role)
  if (access.error) return { error: access.error }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, DOCUMENT_SIGNED_URL_TTL_SEC, { download: true })

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}

/** Batch signed URLs — 1 query ACL + 1 batch Storage (es. download multiplo). */
export async function getDownloadUrls(storagePaths: string[], toolId: string) {
  const { role } = await getToolAccess(toolId)
  if (!role) return { error: "Accesso negato al tool", urls: {} as Record<string, string> }

  const validPaths = storagePaths.filter((path) => {
    try {
      assertStoragePathForTool(path, toolId)
      return true
    } catch {
      return false
    }
  })
  if (validPaths.length === 0) return { urls: {} as Record<string, string> }

  const supabase = await getSupabase()
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path, allowed_roles, min_role")
    .eq("tool_id", toolId)
    .eq("type", "file")
    .in("storage_path", validPaths)

  const allowedPaths: string[] = []
  for (const doc of docs ?? []) {
    if (!doc.storage_path) continue
    const allowed =
      (doc.allowed_roles as string[] | null)?.length
        ? (doc.allowed_roles as string[])
        : doc.min_role === "premium"
          ? (["premium", "admin"] as string[])
          : DEFAULT_ALLOWED_ROLES
    if (canAccessAllowedRoles(role, allowed)) {
      allowedPaths.push(doc.storage_path)
    }
  }

  const urls =
    allowedPaths.length > 0
      ? await createDocumentSignedUrls(supabase, toolId, allowedPaths)
      : {}

  return { urls }
}
