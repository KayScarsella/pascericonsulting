'use server'

import { requireToolAdmin } from '@/lib/tool-auth'

type TriggerResult =
  | {
      success: true
      data: TriggerSuccessData
    }
  | { success: false; error: string }

type TriggerSuccessData = {
  reminderType: string
  daysAhead: number
  targetDate: string
  toolId: string | null
  candidates: number
  inserted: number
  sent: number
  skipped: number
  errors: Array<{ sessionId: string; error: string }>
}

function isTriggerPayload(value: unknown): value is TriggerSuccessData {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.reminderType === 'string' &&
    typeof obj.daysAhead === 'number' &&
    typeof obj.targetDate === 'string' &&
    (typeof obj.toolId === 'string' || obj.toolId === null) &&
    typeof obj.candidates === 'number' &&
    typeof obj.inserted === 'number' &&
    typeof obj.sent === 'number' &&
    typeof obj.skipped === 'number' &&
    Array.isArray(obj.errors)
  )
}

export async function triggerExpiryRemindersNowAction(
  toolId: string
): Promise<TriggerResult> {
  try {
    await requireToolAdmin(toolId)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return { success: false, error: 'Config mancante: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' }
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/expiry-reminders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        daysAhead: 0,
        reminderType: 'expiry_today',
        toolId,
      }),
      cache: 'no-store',
    })

    const payload: unknown = await resp.json().catch(() => null)
    if (!resp.ok) {
      const msg =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: unknown }).error ?? `HTTP ${resp.status}`)
          : `HTTP ${resp.status}`
      return { success: false, error: `Invio fallito: ${msg}` }
    }

    if (!isTriggerPayload(payload)) {
      return { success: false, error: 'Risposta non valida dalla funzione reminder.' }
    }
    return { success: true, data: payload }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

