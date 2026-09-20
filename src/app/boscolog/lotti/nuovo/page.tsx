import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { listBoscologParties } from '@/actions/boscolog/parties'
import { BoscologLotForm } from '@/components/boscolog/lots/BoscologLotForm'
import { Button } from '@/components/ui/button'

export default async function BoscoLogNuovoLottoPage() {
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nuovo lotto</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    redirect('/boscolog/azienda')
  }

  if (!ctx.canEdit) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nuovo lotto</h1>
        <p className="text-slate-500">Non hai permessi di modifica.</p>
        <Button asChild variant="outline">
          <Link href="/boscolog/lotti">Torna alla lista</Link>
        </Button>
      </div>
    )
  }

  const partiesRes = await listBoscologParties()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Nuovo lotto</h1>
        <p className="text-slate-500">Inserisci i dati anagrafici del lotto.</p>
      </div>
      <BoscologLotForm mode="create" parties={partiesRes.parties ?? []} canEdit />
    </div>
  )
}
