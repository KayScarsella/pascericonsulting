import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { getBoscologLot } from '@/actions/boscolog/lots'
import { getBoscologLotMaterial } from '@/actions/boscolog/lot-operations'
import { listBoscologParties } from '@/actions/boscolog/parties'
import { BoscologLotMaterialPanel } from '@/components/boscolog/lots/BoscologLotMaterialPanel'
import { BoscologLotSectionNav } from '@/components/boscolog/lots/BoscologLotSectionNav'
import { Button } from '@/components/ui/button'

export default async function BoscoLogLottoMaterialePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Materiale</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Materiale</h1>
        <p className="text-slate-500">Configura prima l&apos;azienda.</p>
        <Button asChild>
          <Link href="/boscolog/azienda">Vai ad Azienda</Link>
        </Button>
      </div>
    )
  }

  const [lotRes, partiesRes, matRes] = await Promise.all([
    getBoscologLot(id),
    listBoscologParties(),
    getBoscologLotMaterial(id),
  ])

  if (!lotRes.success || !lotRes.lot) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <BoscologLotSectionNav lotId={id} lotName={lotRes.lot.name} active="materiale" />
      <p className="text-slate-500">
        Specie, uscite, movimenti e quantità del lotto.
      </p>

      {matRes.success && matRes.data ? (
        <BoscologLotMaterialPanel
          lotId={id}
          initial={matRes.data}
          parties={partiesRes.parties ?? []}
          canEdit={Boolean(ctx.canEdit)}
        />
      ) : (
        <p className="text-sm text-red-600">
          {matRes.error ?? 'Impossibile caricare il materiale del lotto.'}
        </p>
      )}
    </div>
  )
}
