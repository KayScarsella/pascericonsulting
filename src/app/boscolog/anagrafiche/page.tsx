import Link from 'next/link'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { listBoscologParties } from '@/actions/boscolog/parties'
import { BoscologPartiesView } from '@/components/boscolog/parties/BoscologPartiesView'
import { Button } from '@/components/ui/button'

export default async function BoscoLogAnagrafichePage() {
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Anagrafiche</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Anagrafiche</h1>
        <p className="text-slate-500">
          Prima configura i dati della tua impresa, poi potrai gestire fornitori, acquirenti ed enti.
        </p>
        <Button asChild>
          <Link href="/boscolog/azienda">Vai ad Azienda</Link>
        </Button>
      </div>
    )
  }

  const listed = await listBoscologParties()
  const parties = listed.success ? (listed.parties ?? []) : []

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Anagrafiche</h1>
        <p className="text-slate-500">
          Fornitori, acquirenti ed enti collegati all&apos;impresa {ctx.company.name}.
        </p>
      </div>
      {!listed.success && listed.error !== 'needs_setup' ? (
        <p className="text-red-600">{listed.error}</p>
      ) : null}
      <BoscologPartiesView initialParties={parties} canEdit={Boolean(ctx.canEdit)} />
    </div>
  )
}
