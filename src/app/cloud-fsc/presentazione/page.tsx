import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { FscToolPresentationView } from '@/components/cloud-fsc/company/FscToolPresentationView'
import { redirect } from 'next/navigation'

export default async function CloudFscPresentazionePage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getFscCompanyContext()

  if (role === 'admin') {
    redirect('/cloud-fsc')
  }

  if (ctx.success && !ctx.needsSetup && ctx.data) {
    redirect('/cloud-fsc')
  }

  if (role === 'premium') {
    redirect('/cloud-fsc/setup')
  }

  return <FscToolPresentationView />
}
