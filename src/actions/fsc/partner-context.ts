'use server'

import { getCurrentFscCompany } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'

export type FscPartnerEditorContext = {
  companyId: string
  userId: string
  canEdit: boolean
}

export async function requireFscPartnerContext(): Promise<
  { success: true; data: FscPartnerEditorContext } | { success: false; error: string }
> {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getCurrentFscCompany()
  if (!ctx.success || !ctx.data) {
    return { success: false, error: ctx.error ?? 'Impresa FSC non disponibile' }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  return {
    success: true,
    data: {
      companyId: ctx.data.company.id,
      userId: userData.user.id,
      canEdit: ctx.data.membership.can_edit,
    },
  }
}