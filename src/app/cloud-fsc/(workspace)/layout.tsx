import { redirect } from 'next/navigation'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'

export default async function CloudFscWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getFscCompanyContext()

  if (role !== 'admin' && companyCtx.needsSetup) {
    redirect(role === 'premium' ? '/cloud-fsc/setup' : '/cloud-fsc/presentazione')
  }

  return children
}
