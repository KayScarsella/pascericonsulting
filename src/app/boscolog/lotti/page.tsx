import Link from 'next/link'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { listBoscologLots } from '@/actions/boscolog/lots'
import { listBoscologParties } from '@/actions/boscolog/parties'
import { BoscologLotsView } from '@/components/boscolog/lots/BoscologLotsView'
import { Button } from '@/components/ui/button'

export default async function BoscoLogLottiPage() {
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lotti</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lotti</h1>
        <p className="text-slate-500">
          Prima configura i dati della tua impresa, poi potrai gestire i lotti forestali.
        </p>
        <Button asChild>
          <Link href="/boscolog/azienda">Vai ad Azienda</Link>
        </Button>
      </div>
    )
  }

  const [lotsRes, partiesRes] = await Promise.all([listBoscologLots(), listBoscologParties()])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lotti</h1>
        <p className="text-slate-500">
          Gestione lotti forestali per {ctx.company.name}. Geodati nella sezione Compliance del
          lotto; allegati nelle fasi successive.
        </p>
      </div>
      {!lotsRes.success ? <p className="text-red-600">{lotsRes.error}</p> : null}
      <BoscologLotsView
        initialLots={lotsRes.lots ?? []}
        parties={partiesRes.parties ?? []}
        canEdit={Boolean(ctx.canEdit)}
      />
    </div>
  )
}
