'use server'

import { requireToolAdmin } from '@/lib/tool-auth'

type TriggerResult =
  | {
      success: true
      data: {
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
    }
  | { success: false; error: string }

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

    const payload = (await resp.json().catch(() => null)) as any
    if (!resp.ok) {
      const msg = payload?.error ? String(payload.error) : `HTTP ${resp.status}`
      return { success: false, error: `Invio fallito: ${msg}` }
    }

    return { success: true, data: payload }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}

