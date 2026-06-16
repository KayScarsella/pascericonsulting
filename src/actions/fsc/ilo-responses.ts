'use server'

import { getCurrentFscCompany } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { Database, Json, TablesInsert } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type FscIloSessionMeta = {
  company_id: string
  reference_year: number
}

export type FscIloSavePayload = {
  questionId: string
  value: string | number | null | unknown
  inputType: 'text' | 'json'
}

async function getSupabase() {
  return createClient()
}

export async function validateFscIloSessionAccess(
  supabase: SupabaseClient<Database>,
  sessionId: string
): Promise<{ userId: string; sessionOwnerId: string; companyId: string; referenceYear: number }> {
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) throw new Error('Non autenticato')

  await getToolAccess(CLOUD_FSC_TOOL_ID)

  const companyCtx = await getCurrentFscCompany()
  if (!companyCtx.success || !companyCtx.data) {
    throw new Error(companyCtx.error ?? 'Impresa FSC non disponibile')
  }

  const { data: assessment, error: assessmentError } = await supabase
    .from('fsc_ilo_assessments')
    .select('company_id, reference_year, session_id')
    .eq('session_id', sessionId)
    .eq('company_id', companyCtx.data.company.id)
    .maybeSingle()

  if (assessmentError || !assessment?.session_id) {
    throw new Error('Sessione ILO non trovata o non valida')
  }

  const { data: session, error: sessionError } = await supabase
    .from('assessment_sessions')
    .select('user_id, tool_id, session_type, metadata')
    .eq('id', sessionId)
    .eq('tool_id', CLOUD_FSC_TOOL_ID)
    .eq('session_type', 'ilo')
    .single()

  if (sessionError || !session) {
    throw new Error('Sessione non trovata')
  }

  const meta = session.metadata as FscIloSessionMeta | null
  if (
    !meta?.company_id ||
    meta.company_id !== assessment.company_id ||
    meta.reference_year !== assessment.reference_year
  ) {
    throw new Error('Metadati sessione ILO non validi')
  }

  if (!companyCtx.data.membership.can_edit) {
    throw new Error('Permesso di modifica non disponibile')
  }

  return {
    userId: authData.user.id,
    sessionOwnerId: session.user_id,
    companyId: assessment.company_id,
    referenceYear: assessment.reference_year,
  }
}

export async function saveFscIloResponse(
  sessionId: string,
  questionId: string,
  value: string | number | null,
  inputType: 'text' | 'json'
) {
  try {
    const supabase = await getSupabase()
    const { sessionOwnerId } = await validateFscIloSessionAccess(supabase, sessionId)

    const payload: TablesInsert<'user_responses'> = {
      user_id: sessionOwnerId,
      tool_id: CLOUD_FSC_TOOL_ID,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore salvataggio'
    return { error: message }
  }
}

export async function saveFscIloResponsesBulk(
  sessionId: string,
  responses: FscIloSavePayload[]
) {
  if (!responses.length) return { success: true }

  try {
    const supabase = await getSupabase()
    const { sessionOwnerId } = await validateFscIloSessionAccess(supabase, sessionId)

    const payloads: TablesInsert<'user_responses'>[] = responses.map((res) => ({
      user_id: sessionOwnerId,
      tool_id: CLOUD_FSC_TOOL_ID,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore salvataggio massivo'
    return { error: message }
  }
}

export async function deleteFscIloResponsesBulk(sessionId: string, questionIds: string[]) {
  if (!questionIds.length) return { success: true }

  try {
    const supabase = await getSupabase()
    await validateFscIloSessionAccess(supabase, sessionId)

    const { error } = await supabase
      .from('user_responses')
      .delete()
      .eq('session_id', sessionId)
      .in('question_id', questionIds)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore eliminazione risposte'
    return { error: message }
  }
}

export async function copyFscIloUserResponses(
  sourceSessionId: string,
  targetSessionId: string,
  targetSessionOwnerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabase()

  const { data: sourceRows, error: readError } = await supabase
    .from('user_responses')
    .select('question_id, answer_text, answer_json, file_path')
    .eq('session_id', sourceSessionId)

  if (readError) return { success: false, error: readError.message }
  if (!sourceRows?.length) return { success: true }

  const payloads: TablesInsert<'user_responses'>[] = sourceRows.map((row) => ({
    user_id: targetSessionOwnerId,
    tool_id: CLOUD_FSC_TOOL_ID,
    session_id: targetSessionId,
    question_id: row.question_id,
    answer_text: row.answer_text,
    answer_json: row.answer_json,
    file_path: row.file_path,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await supabase
    .from('user_responses')
    .upsert(payloads, { onConflict: 'session_id, question_id' })

  if (upsertError) return { success: false, error: upsertError.message }
  return { success: true }
}
