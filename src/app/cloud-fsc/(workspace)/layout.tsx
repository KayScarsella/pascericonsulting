import { redirect } from 'next/navigation'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'

export default async function CloudFscWorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getToolAccess / getFscCompanyContext are React.cache'd — deduped with parent layout.
  const [{ role }, companyCtx] = await Promise.all([
    getToolAccess(CLOUD_FSC_TOOL_ID),
    getFscCompanyContext(),
  ])

  if (role !== 'admin' && companyCtx.needsSetup) {
    redirect(role === 'premium' ? '/cloud-fsc/setup' : '/cloud-fsc/presentazione')
  }

  return children
}
