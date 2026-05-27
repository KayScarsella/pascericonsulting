"use server"

import { getToolAccess } from "@/lib/tool-auth"
import type { ToolRole } from "@/lib/tool-auth"
import {
  canAccessMinRole,
  type DocumentMinRole,
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
async function getSupabase() {
  return createClient()
}

async function requireDocumentAdmin(toolId: string) {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" as const }

  const { role } = await getToolAccess(toolId)
  if (role !== "admin") return { error: "Non autorizzato: servono permessi admin" as const }

  return { supabase, user }
}

async function resolveEffectiveMinRole(
  supabase: SupabaseClient<Database>,
  toolId: string,
  parentId: string | null,
  requestedMinRole: DocumentMinRole
): Promise<DocumentMinRole> {
  if (!parentId) return requestedMinRole

  const { data: parent } = await supabase
    .from("documents")
    .select("min_role, type")
    .eq("id", parentId)
    .eq("tool_id", toolId)
    .single()

  if (!parent || parent.type !== "folder") return requestedMinRole
  const parentMin = parent.min_role as DocumentMinRole
  if (parentMin === "premium") return "premium"
  return requestedMinRole
}

async function assertDocumentDownloadAccess(
  supabase: SupabaseClient<Database>,
  storagePath: string,
  toolId: string,
  role: ToolRole
): Promise<{ error?: string }> {
  const { data: doc } = await supabase
    .from("documents")
    .select("min_role")
    .eq("storage_path", storagePath)
    .eq("tool_id", toolId)
    .eq("type", "file")
    .maybeSingle()

  if (!doc) return { error: "Documento non trovato" }
  if (!canAccessMinRole(role, doc.min_role as DocumentMinRole)) {
    return { error: "Contenuto riservato agli utenti Premium" }
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
  minRole: DocumentMinRole = "standard"
) {
  const { role } = await getToolAccess(toolId)
  if (role !== "admin") return { error: "Non autorizzato: servono permessi admin" }

  const supabase = await getSupabase()
  const effectiveMinRole = await resolveEffectiveMinRole(supabase, toolId, parentId, minRole)

  const { error } = await supabase.from("documents").insert({
    tool_id: toolId,
    parent_id: parentId,
    name,
    type: "folder",
    min_role: effectiveMinRole,
  })

  if (error) return { error: error.message }

  revalidatePath(pathRevalidate)
  return { success: true }
}

async function cascadeDocumentMinRole(
  supabase: SupabaseClient<Database>,
  folderId: string,
  toolId: string,
  minRole: DocumentMinRole
): Promise<void> {
  const { data: children } = await supabase
    .from("documents")
    .select("id, type")
    .eq("parent_id", folderId)
    .eq("tool_id", toolId)

  for (const child of children ?? []) {
    const { data: updatedChild, error: childError } = await supabase
      .from("documents")
      .update({ min_role: minRole })
      .eq("id", child.id)
      .eq("tool_id", toolId)
      .select("id")

    if (childError) throw new Error(childError.message)
    if (!updatedChild?.length) {
      throw new Error("Impossibile aggiornare un elemento nella cartella")
    }

    if (child.type === "folder") {
      await cascadeDocumentMinRole(supabase, child.id, toolId, minRole)
    }
  }
}

/**
 * Aggiorna visibilità di una cartella esistente (e propaga ai contenuti).
 * Richiede ruolo admin.
 */
export async function updateFolderMinRole(
  folderId: string,
  toolId: string,
  minRole: DocumentMinRole,
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

  const effectiveMinRole = await resolveEffectiveMinRole(
    supabase,
    toolId,
    folder.parent_id,
    minRole
  )

  const { data: updatedFolder, error: updateError } = await supabase
    .from("documents")
    .update({ min_role: effectiveMinRole })
    .eq("id", folderId)
    .eq("tool_id", toolId)
    .select("id, min_role")

  if (updateError) return { error: updateError.message }
  if (!updatedFolder?.length) {
    return {
      error:
        "Aggiornamento non applicato: verifica i permessi admin sul tool o riprova.",
    }
  }

  try {
    await cascadeDocumentMinRole(supabase, folderId, toolId, effectiveMinRole)
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Errore durante l'aggiornamento dei contenuti",
    }
  }

  revalidatePath(pathRevalidate)
  return { success: true, minRole: updatedFolder[0].min_role as DocumentMinRole }
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

  const { error: existsError } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60)
  if (existsError) {
    return { error: "File non trovato in storage. Riprova l'upload." }
  }

  const fileMinRole = await resolveEffectiveMinRole(supabase, toolId, parentId, "standard")

  const { error: dbError } = await supabase.from("documents").insert({
    tool_id: toolId,
    parent_id: parentId,
    name: fileName,
    type: "file",
    storage_path: storagePath,
    mime_type: mimeType || null,
    size,
    created_by: user.id,
    min_role: fileMinRole,
  })

  if (dbError) {
    await supabase.storage.from("documents").remove([storagePath])
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

      const { error: storageError } = await supabase.storage.from("documents").remove(paths)

      if (storageError) {
        console.error("Errore Storage:", storageError)
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

/** Batch signed URLs — 1 server action per N file (es. download multiplo). */
export async function getDownloadUrls(storagePaths: string[], toolId: string) {
  const { role } = await getToolAccess(toolId)
  if (!role) return { error: "Accesso negato al tool", urls: {} as Record<string, string> }

  const supabase = await getSupabase()
  const allowedPaths: string[] = []

  for (const path of storagePaths) {
    try {
      assertStoragePathForTool(path, toolId)
      const access = await assertDocumentDownloadAccess(supabase, path, toolId, role)
      if (!access.error) allowedPaths.push(path)
    } catch {
      // skip invalid paths
    }
  }

  const urls =
    allowedPaths.length > 0
      ? await createDocumentSignedUrls(supabase, toolId, allowedPaths)
      : {}

  return { urls }
}
