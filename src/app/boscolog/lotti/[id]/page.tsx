import { notFound } from 'next/navigation'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { getBoscologLot } from '@/actions/boscolog/lots'
import { listBoscologParties } from '@/actions/boscolog/parties'
import { BoscologLotForm } from '@/components/boscolog/lots/BoscologLotForm'
import { BoscologLotSectionNav } from '@/components/boscolog/lots/BoscologLotSectionNav'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function BoscoLogLottoAnagraficaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lotto</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lotto</h1>
        <p className="text-slate-500">Configura prima l&apos;azienda.</p>
        <Button asChild>
          <Link href="/boscolog/azienda">Vai ad Azienda</Link>
        </Button>
      </div>
    )
  }

  const [lotRes, partiesRes] = await Promise.all([getBoscologLot(id), listBoscologParties()])

  if (!lotRes.success || !lotRes.lot) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <BoscologLotSectionNav lotId={id} lotName={lotRes.lot.name} active="anagrafica" />
      <p className="text-slate-500">Dati anagrafici del lotto.</p>
      <BoscologLotForm
        mode="edit"
        lot={lotRes.lot}
        parties={partiesRes.parties ?? []}
        canEdit={Boolean(ctx.canEdit)}
      />
    </div>
  )
}
