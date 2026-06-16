import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { listFscCompanyMembers } from '@/actions/fsc/members'
import { FscCompanySettingsView } from '@/components/cloud-fsc/company/FscCompanySettingsView'
import { redirect } from 'next/navigation'

export default async function CloudFscImpostazioniPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (role === 'admin' && (companyCtx.needsSetup || !companyCtx.data)) {
    redirect('/cloud-fsc/master')
  }

  if (companyCtx.needsSetup || !companyCtx.data) {
    redirect('/cloud-fsc/setup')
  }

  const membersRes = await listFscCompanyMembers(companyCtx.data.company.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Impostazioni impresa</h1>
        <p className="mt-1 text-slate-500">{companyCtx.data.company.ragione_sociale}</p>
      </div>
      <FscCompanySettingsView
        company={companyCtx.data.company}
        membership={companyCtx.data.membership}
        initialMembers={membersRes.data}
        isAdmin={role === 'admin'}
      />
    </div>
  )
}
