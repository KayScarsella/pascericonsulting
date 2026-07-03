'use server'

import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { createFscFileService } from '@/lib/fsc/file-service'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'

/** Manually triggers FSC storage reconciliation (admin or cron via service_role). */
export async function processFscStorageReconciliation(): Promise<{
  success: boolean
  result?: Record<string, unknown>
  outboxProcessed?: number
  error?: string
}> {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') {
    return { success: false, error: 'Non autorizzato' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('fsc_process_storage_reconciliation')

  if (error) {
    console.error('processFscStorageReconciliation:', error)
    return { success: false, error: error.message }
  }

  const fileService = createFscFileService(supabase)
  const outboxProcessed = await fileService.processDeleteOutbox()

  return {
    success: true,
    result: (data ?? {}) as Record<string, unknown>,
    outboxProcessed,
  }
}
