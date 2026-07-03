import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { FscCompanySetupForm } from '@/components/cloud-fsc/company/FscCompanySetupForm'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function CloudFscSetupPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getFscCompanyContext()

  if (ctx.success && !ctx.needsSetup && ctx.data) {
    redirect('/cloud-fsc')
  }

  if (role === 'admin') {
    redirect('/cloud-fsc')
  }

  if (role !== 'premium') {
    redirect('/cloud-fsc/presentazione')
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const defaultEmail = userData.user?.email ?? null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configura la tua impresa FSC</h1>
        <p className="mt-2 text-slate-500">
          Prima di usare i moduli CLOUD FSC, crea l&apos;anagrafica della tua azienda certificata.
          Potrai modificarla in seguito dalle impostazioni.
        </p>
      </div>
      <FscCompanySetupForm defaultEmail={defaultEmail} />
    </div>
  )
}
