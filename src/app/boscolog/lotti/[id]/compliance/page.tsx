import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { getBoscologLotGeo } from '@/actions/boscolog/geo'
import { getBoscologLot } from '@/actions/boscolog/lots'
import { getBoscologLotPermits } from '@/actions/boscolog/lot-operations'
import { getBoscologLotCompliance } from '@/actions/boscolog/risk'
import { BoscologLotGeoPanel } from '@/components/boscolog/lots/BoscologLotGeoPanel'
import { BoscologLotPermitsPanel } from '@/components/boscolog/lots/BoscologLotPermitsPanel'
import { BoscologLotRiskPanel } from '@/components/boscolog/lots/BoscologLotRiskPanel'
import { BoscologLotSectionNav } from '@/components/boscolog/lots/BoscologLotSectionNav'
import { Button } from '@/components/ui/button'

export default async function BoscoLogLottoCompliancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compliance</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Compliance</h1>
        <p className="text-slate-500">Configura prima l&apos;azienda.</p>
        <Button asChild>
          <Link href="/boscolog/azienda">Vai ad Azienda</Link>
        </Button>
      </div>
    )
  }

  const [lotRes, complianceRes, permitsRes, geoRes] = await Promise.all([
    getBoscologLot(id),
    getBoscologLotCompliance(id),
    getBoscologLotPermits(id),
    getBoscologLotGeo(id),
  ])

  if (!lotRes.success || !lotRes.lot) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <BoscologLotSectionNav lotId={id} lotName={lotRes.lot.name} active="compliance" />
      <p className="text-slate-500">
        Valutazione rischio, checklist EUDR, geodati e autorizzazioni.
      </p>

      {complianceRes.success && complianceRes.data ? (
        <BoscologLotRiskPanel
          lotId={id}
          originEu={lotRes.lot.origin_eu}
          initial={complianceRes.data}
          canEdit={Boolean(ctx.canEdit)}
        />
      ) : (
        <p className="text-sm text-red-600">
          {complianceRes.error ?? 'Impossibile caricare rischio / EUDR.'}
        </p>
      )}

      {geoRes.success && geoRes.data ? (
        <BoscologLotGeoPanel
          lotId={id}
          initial={geoRes.data}
          canEdit={Boolean(ctx.canEdit)}
        />
      ) : (
        <p className="text-sm text-red-600">
          {geoRes.error ?? 'Impossibile caricare i geodati.'}
        </p>
      )}

      {permitsRes.success ? (
        <BoscologLotPermitsPanel
          lotId={id}
          initial={permitsRes.permits ?? []}
          canEdit={Boolean(ctx.canEdit)}
        />
      ) : (
        <p className="text-sm text-red-600">
          {permitsRes.error ?? 'Impossibile caricare le autorizzazioni.'}
        </p>
      )}
    </div>
  )
}
