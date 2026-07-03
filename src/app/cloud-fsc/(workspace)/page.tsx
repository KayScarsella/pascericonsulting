import { getFscCompanyContext } from '@/actions/fsc/company'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import { ToolNotificationsFeed } from '@/components/notifications/ToolNotificationsFeed'

export default async function CloudFscHomePage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getFscCompanyContext()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">CLOUD FSC</h1>
        <p className="text-slate-500">
          Cruscotto leggero: usa i tab in alto per accedere ai moduli.
        </p>
        {companyCtx.success && companyCtx.data && (
          <p className="text-sm font-medium text-slate-700">
            Impresa: {companyCtx.data.company.ragione_sociale}
          </p>
        )}
        {companyCtx.needsSetup && (
          <p className="text-sm text-amber-700">
            Completa la configurazione dell&apos;impresa per accedere ai moduli.
          </p>
        )}
      </div>

      {!companyCtx.needsSetup && <ToolNotificationsFeed toolId={CLOUD_FSC_TOOL_ID} />}
    </div>
  )
}
