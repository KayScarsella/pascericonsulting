'use server'

import { revalidatePath } from 'next/cache'
import { validateSessionAccess } from '@/actions/questions'
import { EUDR_TOOL_ID, TIMBER_TOOL_ID } from '@/lib/constants'
import type { SessionMetadata } from '@/types/session'
import type { Json } from '@/types/supabase'
import { createClient } from '@/utils/supabase/server'

export type SessionNomeField = 'nome_operazione' | 'nome_commerciale'

const MANUAL_FLAG: Record<SessionNomeField, keyof SessionMetadata> = {
  nome_operazione: 'nome_operazione_manual',
  nome_commerciale: 'nome_commerciale_manual',
}

export async function updateSessionNome(
  toolId: string,
  sessionId: string,
  field: SessionNomeField,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = name.trim()
    if (!trimmed) {
      return { success: false, error: 'Il nome non può essere vuoto' }
    }
    if (trimmed.length > 200) {
      return { success: false, error: 'Nome troppo lungo (max 200 caratteri)' }
    }

    const supabase = await createClient()
    await validateSessionAccess(supabase, toolId, sessionId)

    const { data: session, error: fetchError } = await supabase
      .from('assessment_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .eq('tool_id', toolId)
      .single()

    if (fetchError || !session) {
      return { success: false, error: 'Sessione non trovata' }
    }

    const meta = (session.metadata as SessionMetadata | null) ?? {}
    const manualKey = MANUAL_FLAG[field]
    const nextMeta: SessionMetadata = {
      ...meta,
      [field]: trimmed,
      [manualKey]: true,
    }

    const { error: updateError } = await supabase
      .from('assessment_sessions')
      .update({ metadata: nextMeta as unknown as Json })
      .eq('id', sessionId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    if (toolId === EUDR_TOOL_ID) {
      revalidatePath('/EUDR/search')
    } else if (toolId === TIMBER_TOOL_ID) {
      revalidatePath('/timberRegulation/search')
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore durante il salvataggio'
    return { success: false, error: message }
  }
}
