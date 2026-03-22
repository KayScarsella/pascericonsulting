'use server'

import { getToolAccess } from "@/lib/tool-auth"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"

async function getSupabase() {
  return createClient()
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

/**
 * Carica un file.
 * Richiede ruolo 'admin' per quel tool_id.
 * Salva nello storage con path: {toolId}/{timestamp}_{filename} per isolamento.
 */
export async function uploadFile(formData: FormData, parentId: string | null, toolId: string, pathRevalidate: string) {
  const supabase = await getSupabase()
  
  // 1. Verifica Sessione
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  // 2. Verifica Ruolo nel Tool specifico
  const { role } = await getToolAccess(toolId)
  if (role !== 'admin') return { error: "Non autorizzato: servono permessi admin" }

  const file = formData.get('file') as File
  if (!file) return { error: "File mancante" }

  // 3. Preparazione Path (Isolamento per Tool)
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${toolId}/${Date.now()}_${safeName}`

  // 4. Upload Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file)

  if (uploadError) return { error: uploadError.message }

  // 5. Insert DB
  const { error: dbError } = await supabase.from('documents').insert({
    tool_id: toolId,
    parent_id: parentId,
    name: file.name,
    type: 'file',
    storage_path: storagePath,
    mime_type: file.type,
    size: file.size,
    created_by: user.id
  })

  // Rollback se fallisce il DB
  if (dbError) {
    await supabase.storage.from('documents').remove([storagePath])
    return { error: dbError.message }
  }

  revalidatePath(pathRevalidate)
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
 * Ottiene URL firmato per il download.
 * Accessibile a chiunque abbia accesso al tool (anche 'standard').
 */
export async function getDownloadUrl(storagePath: string) {
  const supabase = await getSupabase()
  
  // Verifica minima sessione
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Utente non autenticato" }

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60, { 
      download: true 
    })

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}

