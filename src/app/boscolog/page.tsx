import Link from 'next/link'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { getBoscologDashboard } from '@/actions/boscolog/dashboard'
import { BoscologDashboardPanels } from '@/components/boscolog/BoscologDashboardPanels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default async function BoscoLogHomePage() {
  const ctx = await getBoscologCompanyContext()
  const dash =
    ctx.success && ctx.company && !ctx.needsSetup ? await getBoscologDashboard() : null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">BoscoLog</h1>
        <p className="text-slate-500">
          Tracciabilità lotti forestali, anagrafiche e compliance EUDR.
        </p>
      </div>

      {ctx.success && (ctx.needsSetup || !ctx.company) ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Configura l&apos;azienda per iniziare</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Inserisci i dati della tua impresa (mittente DDT e documenti) prima di usare le
              anagrafiche e i lotti.
            </span>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/boscolog/azienda">Vai ad Azienda</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {ctx.success && ctx.company ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Impresa: {ctx.company.name}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/boscolog/lotti">Vai ai lotti</Link>
            </Button>
          </div>

          {dash?.success && dash.data ? (
            <BoscologDashboardPanels data={dash.data} />
          ) : (
            <p className="text-sm text-red-600">
              {dash?.error ?? 'Impossibile caricare la dashboard.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
