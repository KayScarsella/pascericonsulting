import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscSettingsModuleNav } from '@/components/cloud-fsc/FscSettingsModuleNav'
import { redirect } from 'next/navigation'

export default async function CloudFscImpostazioniLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (role === 'admin' && (companyCtx.needsSetup || !companyCtx.data)) {
    redirect('/cloud-fsc/master')
  }

  if (companyCtx.needsSetup || !companyCtx.data) {
    redirect(role === 'premium' ? '/cloud-fsc/setup' : '/cloud-fsc/presentazione')
  }

  const showCompany = Boolean(
    companyCtx.data &&
      (companyCtx.data.membership.member_type === 'owner' || role === 'admin')
  )

  return (
    <div className="space-y-6">
      <FscSettingsModuleNav showCompany={showCompany} />
      {children}
    </div>
  )
}
