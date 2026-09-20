'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import type { BoscologDashboardData } from '@/actions/boscolog/dashboard'
import { buildScadenzarioIcs } from '@/lib/boscolog/ics'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function downloadIcs(events: BoscologDashboardData['icsEvents']) {
  if (!events.length) {
    toast.error('Nessuna scadenza da esportare.')
    return
  }
  const ics = buildScadenzarioIcs(events)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `boscolog_scadenze_${new Date().toISOString().slice(0, 10)}.ics`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Esportate ${events.length} scadenze.`)
}

export function BoscologDashboardPanels({ data }: { data: BoscologDashboardData }) {
  const critical = data.alerts.filter((a) => a.type === 'bad').length
  const warn = data.alerts.filter((a) => a.type === 'warn').length

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Lotti" value={String(data.lotCount)} />
        <Kpi
          title="Rischio"
          value={`${data.risk.basso}B · ${data.risk.medio}M · ${data.risk.alto}A`}
          hint="Basso / Medio / Alto"
        />
        <Kpi
          title="EUDR"
          value={`${data.eudr.pass} · ${data.eudr.partial} · ${data.eudr.fail}`}
          hint="Completo / Parziale / Mancante"
        />
        <Kpi
          title="Avvisi"
          value={String(data.alerts.length)}
          hint={`${critical} critici · ${warn} attenzione`}
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Avvisi ({data.alerts.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => downloadIcs(data.icsEvents)}
            >
              <Download className="mr-1 h-4 w-4" />
              Scadenze (.ics)
            </Button>
            {data.alerts.length ? (
              <Badge
                className={
                  critical
                    ? 'bg-red-100 text-red-800 hover:bg-red-100'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                }
              >
                {critical} critici · {warn} attenzione
              </Badge>
            ) : null}
          </div>
        </div>

        {!data.alerts.length ? (
          <p className="text-sm text-emerald-700">Nessun avviso. Tutto in ordine.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.alerts.map((a, i) => (
              <li key={`${a.text}-${i}`} className="flex items-start gap-2 py-2 text-sm">
                <Badge
                  className={
                    a.type === 'bad'
                      ? 'bg-red-100 text-red-800 hover:bg-red-100'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                  }
                >
                  {a.type === 'bad' ? 'Critico' : 'Attenzione'}
                </Badge>
                <span className="text-slate-700">
                  {a.lotId ? (
                    <Link
                      href={`/boscolog/lotti/${a.lotId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {a.text}
                    </Link>
                  ) : a.partyId ? (
                    <Link
                      href="/boscolog/anagrafiche"
                      className="underline-offset-2 hover:underline"
                    >
                      {a.text}
                    </Link>
                  ) : (
                    a.text
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Kpi({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}
