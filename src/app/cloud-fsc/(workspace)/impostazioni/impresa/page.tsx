import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { listFscCompanyMembers } from '@/actions/fsc/members'
import { FscCompanySettingsView } from '@/components/cloud-fsc/company/FscCompanySettingsView'
import { redirect } from 'next/navigation'

export default async function CloudFscImpostazioniImpresaPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.data) {
    redirect('/cloud-fsc/impostazioni/profilo')
  }

  const canManageCompany =
    companyCtx.data.membership.member_type === 'owner' || role === 'admin'

  if (!canManageCompany) {
    redirect('/cloud-fsc/impostazioni/profilo')
  }

  const membersRes = await listFscCompanyMembers(companyCtx.data.company.id)

  return (
    <FscCompanySettingsView
      company={companyCtx.data.company}
      membership={companyCtx.data.membership}
      initialMembers={membersRes.data ?? []}
      isAdmin={role === 'admin'}
    />
  )
}
