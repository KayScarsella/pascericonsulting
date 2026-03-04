'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SupabaseClient } from "@supabase/supabase-js" // 🛠️ Aggiunto import per la tipizzazione
import { Database, TablesInsert, Json } from "@/types/supabase"
import { getToolAccess } from "@/lib/tool-auth"

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
}

async function requirePremiumAccess(toolId: string) {
  const { role } = await getToolAccess(toolId)
  if (!role) throw new Error("Accesso negato: Utente non autorizzato")
  if (role === 'standard') {
    throw new Error("Accesso negato: Questa funzionalità richiede un piano Premium")
  }
  return role
}

// 🛠️ FIX: supabase tipizzato correttamente invece di 'any'
async function validateSessionAccess(
  supabase: SupabaseClient<Database>, 
  toolId: string, 
  sessionId: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autenticato")

  await requirePremiumAccess(toolId)

  const { data: session, error } = await supabase
    .from('assessment_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .eq('tool_id', toolId)
    .single()

  if (error || !session) throw new Error("Sessione non trovata o non valida")

  if (session.user_id !== user.id) {
    const { role } = await getToolAccess(toolId)
    if (role !== 'admin') {
      throw new Error("Accesso negato: Non hai i permessi per modificare questa sessione")
    }
  }

  return { user, sessionOwnerId: session.user_id }
}

// ----------------------------------------------------------------------
// AZIONI DATABASE SINGOLE E MASSIVE
// ----------------------------------------------------------------------

export async function saveResponse(
  toolId: string, 
  sessionId: string, 
  questionId: string, 
  value: string | number | null, 
  inputType: 'text' | 'json'
) {
  try {
    const supabase = await getSupabase()
    const { sessionOwnerId } = await validateSessionAccess(supabase, toolId, sessionId)

    const payload: TablesInsert<'user_responses'> = {
      user_id: sessionOwnerId,
      tool_id: toolId,
      session_id: sessionId,
      question_id: questionId,
      updated_at: new Date().toISOString(),
      answer_text: inputType !== 'json' ? String(value ?? '') : null,
      answer_json: inputType === 'json' ? (value as unknown as Json) : null, 
    }

    const { error } = await supabase
      .from('user_responses')
      .upsert(payload, { onConflict: 'session_id, question_id' }) 

    if (error) throw new Error(error.message)
    return { success: true }

  } catch (err: unknown) { // 🛠️ FIX: 'unknown' invece di 'any'
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante il salvataggio"
    return { error: errorMessage }
  }
}

export async function saveResponsesBulk(
  toolId: string,
  sessionId: string, 
  responses: { questionId: string; value: string | number | null | unknown; inputType: 'text' | 'json' }[]
) {
  if (!responses.length) return { success: true }

  try {
    const supabase = await getSupabase()
    const { sessionOwnerId } = await validateSessionAccess(supabase, toolId, sessionId)

    const payloads: TablesInsert<'user_responses'>[] = responses.map(res => ({
      user_id: sessionOwnerId,
      tool_id: toolId,
      session_id: sessionId,
      question_id: res.questionId,
      updated_at: new Date().toISOString(),
      answer_text: res.inputType !== 'json' ? String(res.value ?? '') : null,
      answer_json: res.inputType === 'json' ? (res.value as unknown as Json) : null,
    }))

    const { error } = await supabase
      .from('user_responses')
      .upsert(payloads, { onConflict: 'session_id, question_id' })

    if (error) throw new Error(error.message)
    return { success: true }

  } catch (err: unknown) { // 🛠️ FIX
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante il salvataggio massivo"
    return { error: errorMessage }
  }
}

export async function deleteResponsesBulk(
  toolId: string, 
  sessionId: string, 
  questionIds: string[]
) {
  if (!questionIds.length) return { success: true }

  try {
    const supabase = await getSupabase()
    await validateSessionAccess(supabase, toolId, sessionId)

    const { data: rowsWithFiles } = await supabase
      .from('user_responses')
      .select('file_path')
      .eq('session_id', sessionId)
      .in('question_id', questionIds)
      .not('file_path', 'is', null)

    const filePaths = rowsWithFiles?.map(row => row.file_path).filter(Boolean) as string[]

    if (filePaths && filePaths.length > 0) {
      await supabase.storage.from('user-uploads').remove(filePaths)
    }

    const { error: dbError } = await supabase
      .from('user_responses')
      .delete()
      .eq('session_id', sessionId)
      .in('question_id', questionIds)

    if (dbError) throw new Error(dbError.message)
    return { success: true }

  } catch (err: unknown) { // 🛠️ FIX
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante l'eliminazione massiva"
    return { error: errorMessage }
  }
}

// ----------------------------------------------------------------------
// GESTIONE ALLEGATI (FILE STORAGE)
// ----------------------------------------------------------------------

export async function uploadQuestionAttachment(
  formData: FormData, 
  toolId: string, 
  sessionId: string, 
  questionId: string
) {
  try {
    const supabase = await getSupabase()
    const { sessionOwnerId } = await validateSessionAccess(supabase, toolId, sessionId)

    const file = formData.get('file') as File
    if (!file) throw new Error("File mancante")

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${sessionOwnerId}/${toolId}/${sessionId}/${questionId}/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(storagePath, file)

    if (uploadError) throw new Error(uploadError.message)

    const payload = {
      user_id: sessionOwnerId,
      tool_id: toolId,
      session_id: sessionId,
      question_id: questionId,
      file_path: storagePath,
      updated_at: new Date().toISOString()
    }

    const { error: dbError } = await supabase
      .from('user_responses')
      .upsert(payload, { onConflict: 'session_id, question_id' })

    if (dbError) throw new Error(dbError.message)

    return { success: true, path: storagePath }

  } catch (err: unknown) { // 🛠️ FIX
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante l'upload del file"
    return { error: errorMessage }
  }
}

export async function deleteQuestionAttachment(
  toolId: string, 
  sessionId: string, 
  questionId: string
) {
  try {
    const supabase = await getSupabase()
    await validateSessionAccess(supabase, toolId, sessionId)
  
    const { data: response, error: fetchError } = await supabase
      .from('user_responses')
      .select('id, file_path')
      .eq('session_id', sessionId)
      .eq('question_id', questionId)
      .single()
    
    if (fetchError || !response || !response.file_path) {
        return { success: true } 
    }

    const { error: storageError } = await supabase.storage
      .from('user-uploads')
      .remove([response.file_path])

    if (storageError) console.error("Errore storage", storageError)

    const { error: dbError } = await supabase
      .from('user_responses')
      .update({ file_path: null })
      .eq('id', response.id)

    if (dbError) throw new Error(dbError.message)
    return { success: true }

  } catch (err: unknown) { // 🛠️ FIX
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante l'eliminazione dell'allegato"
    return { error: errorMessage }
  }
}

export async function deleteQuestionRow(
  toolId: string, 
  sessionId: string, 
  questionId: string
) {
  try {
    const supabase = await getSupabase()
    await validateSessionAccess(supabase, toolId, sessionId)

    await deleteQuestionAttachment(toolId, sessionId, questionId);

    const { error } = await supabase
      .from('user_responses')
      .delete()
      .eq('session_id', sessionId)
      .eq('question_id', questionId)

    if (error) throw new Error(error.message)
    return { success: true }

  } catch (err: unknown) { // 🛠️ FIX
    const errorMessage = err instanceof Error ? err.message : "Errore sconosciuto durante l'eliminazione della risposta"
    return { error: errorMessage }
  }
}

// ----------------------------------------------------------------------
// FUNZIONI GENERICHE (Invariate)
// ----------------------------------------------------------------------

type AllowedTable = 'country' | 'eu_products' | 'documents' | 'species';

export async function fetchDynamicOptions(
  table: string, 
  labelCol: string, 
  valueCol: string,
  extraCols?: string[]
) {
  const supabase = await getSupabase()
  const ALLOWED_TABLES: AllowedTable[] = ['country', 'eu_products', 'species', 'documents']
  
  if (!ALLOWED_TABLES.includes(table as AllowedTable)) return []

  const isValidColumn = (col: string) => /^[a-zA-Z0-9_]+$/.test(col);
  if (!isValidColumn(labelCol) || !isValidColumn(valueCol)) return []

  let selectQuery = `${labelCol}, ${valueCol}`;
  const validExtras = (extraCols || []).filter(isValidColumn);
  if (validExtras.length > 0) {
      selectQuery += `, ${validExtras.join(', ')}`;
  }

  const { data, error } = await supabase
    .from(table as AllowedTable) 
    .select(selectQuery)
    .limit(100)

  if (error) return []

  const typedData = data as unknown as Record<string, unknown>[]
  
  return typedData.map((row) => {
    const extraData: Record<string, unknown> = {};
    validExtras.forEach(col => { extraData[col] = row[col]; });

    return {
      label: String(row[labelCol] ?? ''),
      value: String(row[valueCol] ?? ''),
      extra: extraData
    }
  })
}