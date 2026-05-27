import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { redirect } from 'next/navigation'

/** Master CLOUD FSC: per ora solo gestione utenti del tool. */
export default async function CloudFscMasterPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') redirect('/landingPage')
  redirect('/cloud-fsc/master/users')
}
