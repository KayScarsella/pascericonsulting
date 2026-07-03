'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess, requireToolAdmin } from '@/lib/tool-auth'
import { createServiceRoleClient } from '@/utils/supabase/admin'

/** Manually triggers FSC alert queue processing (admin or cron). */
export async function processFscAlerts(): Promise<{
  success: boolean
  processed?: number
  error?: string
}> {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') {
    return { success: false, error: 'Solo admin tool' }
  }

  const admin = createServiceRoleClient()
  const { data, error } = await admin.rpc('fsc_process_alert_outbox', {
    _tool_id: CLOUD_FSC_TOOL_ID,
  })

  if (error) {
    console.error('fsc_process_alert_outbox:', error)
    return { success: false, error: error.message }
  }

  return { success: true, processed: data ?? 0 }
}

type FscExpiryEmailTriggerData = {
  daysAhead: number
  targetDate: string
  toolId: string
  candidates: number
  sent: number
  skipped: number
  errors: Array<{ outboxId: string; error: string }>
}

type FscExpiryEmailTriggerResult =
  | { success: true; data: FscExpiryEmailTriggerData }
  | { success: false; error: string }

function isFscExpiryEmailPayload(value: unknown): value is FscExpiryEmailTriggerData {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.daysAhead === 'number' &&
    typeof obj.targetDate === 'string' &&
    typeof obj.toolId === 'string' &&
    typeof obj.candidates === 'number' &&
    typeof obj.sent === 'number' &&
    typeof obj.skipped === 'number' &&
    Array.isArray(obj.errors)
  )
}

/** Manually triggers FSC expiry email sends via Resend (admin test / recovery). */
export async function triggerFscExpiryEmailsNowAction(
  daysAhead = 30
): Promise<FscExpiryEmailTriggerResult> {
  try {
    await requireToolAdmin(CLOUD_FSC_TOOL_ID)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return {
        success: false,
        error: 'Config mancante: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.',
      }
    }

    const resp = await fetch(`${supabaseUrl}/functions/v1/fsc-expiry-emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        daysAhead,
        toolId: CLOUD_FSC_TOOL_ID,
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

    if (!isFscExpiryEmailPayload(payload)) {
      return { success: false, error: 'Risposta non valida dalla funzione fsc-expiry-emails.' }
    }
    return { success: true, data: payload }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore' }
  }
}
