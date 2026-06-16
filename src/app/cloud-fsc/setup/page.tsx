import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { FscCompanySetupForm } from '@/components/cloud-fsc/company/FscCompanySetupForm'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function CloudFscSetupPage() {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const ctx = await getFscCompanyContext()

  if (ctx.success && !ctx.needsSetup && ctx.data) {
    redirect('/cloud-fsc')
  }

  if (role === 'admin') {
    redirect('/cloud-fsc')
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const defaultEmail = userData.user?.email ?? null

  const canCreateCompany = role === 'premium'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {canCreateCompany ? 'Configura la tua impresa FSC' : 'In attesa di assegnazione'}
        </h1>
        <p className="mt-2 text-slate-500">
          {canCreateCompany
            ? 'Prima di usare i moduli CLOUD FSC, crea l\'anagrafica della tua azienda certificata. Potrai modificarla in seguito dalle impostazioni.'
            : 'Non sei ancora associato a nessuna impresa FSC. Chiedi al titolare o all\'amministratore di aggiungerti al team oppure di invitarti al tool.'}
        </p>
      </div>
      {canCreateCompany ? (
        <FscCompanySetupForm defaultEmail={defaultEmail} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">
            Una volta aggiunto a un&apos;impresa, ricarica questa pagina o torna alla home del tool.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/cloud-fsc">Torna alla home</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
