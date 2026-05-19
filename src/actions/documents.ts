"use server"

import { getToolAccess } from "@/lib/tool-auth"
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

/**
 * Crea una cartella.
 * Richiede ruolo 'admin' per quel tool_id.
 */
export async function createFolder(toolId: string, parentId: string | null, name: string, pathRevalidate: string) {
  const { role } = await getToolAccess(toolId)
  if (role !== 'admin') return { error: "Non autorizzato: servono permessi admin" }

  const supabase = await getSupabase()
  const { error } = await supabase.from('documents').insert({
    tool_id: toolId,
    parent_id: parentId,
    name,
    type: 'folder'
  })

  if (error) return { error: error.message }
  
  revalidatePath(pathRevalidate)
  return { success: true }
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

  const { error: dbError } = await supabase.from("documents").insert({
    tool_id: toolId,
    parent_id: parentId,
    name: fileName,
    type: "file",
    storage_path: storagePath,
    mime_type: mimeType || null,
    size,
    created_by: user.id,
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

// actions/documents.ts

export async function deleteItem(id: string, toolId: string, pathRevalidate: string) {
  // 1. Verifica permessi Admin
  const { role } = await getToolAccess(toolId)
  if (role !== 'admin') return { error: "Non autorizzato" }

  const supabase = await getSupabase()

  try {
    const { data: pathsToDelete, error: rpcError } = await supabase
      .rpc('get_recursive_storage_paths', { target_id: id })

    if (rpcError) {
      console.error("Errore RPC:", rpcError)
      return { error: "Impossibile recuperare i file da eliminare" }
    }
    if (pathsToDelete && pathsToDelete.length > 0) {
      // Estraiamo l'array di stringhe, es: ['tool/123.pdf', 'tool/456.jpg']
      const paths = pathsToDelete.map((row: { storage_path: string }) => row.storage_path)
      
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove(paths) // Supabase accetta un array per eliminazione multipla

      if (storageError) {
        console.error("Errore Storage:", storageError)
      }
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('tool_id', toolId) // Sicurezza extra

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
  const urls = await createDocumentSignedUrls(supabase, toolId, storagePaths)
  return { urls }
}

