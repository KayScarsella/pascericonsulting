'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'

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

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fsc_process_alert_outbox', {
    _tool_id: CLOUD_FSC_TOOL_ID,
  })

  if (error) {
    console.error('fsc_process_alert_outbox:', error)
    return { success: false, error: error.message }
  }

  return { success: true, processed: data ?? 0 }
}
