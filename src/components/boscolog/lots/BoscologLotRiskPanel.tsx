'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Lock, Unlock } from 'lucide-react'
import {
  lockBoscologLotRisk,
  unlockBoscologLotRisk,
  updateBoscologLotRisk,
  type BoscologLotCompliance,
} from '@/actions/boscolog/risk'
import type { BoscologRisk, BoscologRiskAnswers, RiskTriState } from '@/lib/boscolog/risk'
import { riskCompute, riskLevelBadgeClass } from '@/lib/boscolog/risk'
import {
  eudrCheckBadgeClass,
  eudrStatusLabel,
} from '@/lib/boscolog/eudr-checklist'
import {
  BOSCOLOG_DD_OUTCOMES,
  BOSCOLOG_RISK_QUESTIONS,
  BOSCOLOG_TRI_OPTIONS,
} from '@/lib/boscolog/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function BoscologLotRiskPanel({
  lotId,
  originEu,
  initial,
  canEdit,
}: {
  lotId: string
  originEu: string | null
  initial: BoscologLotCompliance
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [risk, setRisk] = useState<BoscologRisk>(initial.risk)
  const [eudr, setEudr] = useState(initial.eudr)
  const hasGeo = initial.hasGeo

  useEffect(() => {
    setRisk(initial.risk)
    setEudr(initial.eudr)
  }, [initial])

  const live = riskCompute({ origin_eu: originEu, risk, hasGeo })
  const locked = risk.locked
  const disabled = !canEdit || pending || locked

  const setAnswer = (key: keyof BoscologRiskAnswers, value: string) => {
    setRisk((prev) => ({
      ...prev,
      answers: { ...prev.answers, [key]: value as RiskTriState },
    }))
  }

  const handleSave = () => {
    if (!canEdit || locked) return
    startTransition(async () => {
      const res = await updateBoscologLotRisk(lotId, {
        assessedAt: risk.assessedAt,
        assessor: risk.assessor,
        outcome: risk.outcome,
        notes: risk.notes,
        mitigation: risk.mitigation,
        answers: risk.answers,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito')
        return
      }
      toast.success('Valutazione rischio salvata.')
      router.refresh()
    })
  }

  const handleLock = () => {
    if (!canEdit) return
    startTransition(async () => {
      const save = await updateBoscologLotRisk(lotId, {
        assessedAt: risk.assessedAt,
        assessor: risk.assessor,
        outcome: risk.outcome,
        notes: risk.notes,
        mitigation: risk.mitigation,
        answers: risk.answers,
      })
      if (!save.success) {
        toast.error(save.error ?? 'Salvataggio fallito')
        return
      }
      const res = await lockBoscologLotRisk(lotId)
      if (!res.success) {
        toast.error(res.error ?? 'Blocco fallito')
        return
      }
      toast.success('Valutazione bloccata.')
      router.refresh()
    })
  }

  const handleUnlock = () => {
    if (!canEdit) return
    startTransition(async () => {
      const res = await unlockBoscologLotRisk(lotId)
      if (!res.success) {
        toast.error(res.error ?? 'Sblocco fallito')
        return
      }
      toast.success('Valutazione sbloccata.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Valutazione rischio</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={riskLevelBadgeClass(live.level)}>
                {live.level} ({live.score}/100)
              </Badge>
              {live.missing > 0 ? (
                <span className="text-xs text-slate-500">{live.missing} risposte mancanti</span>
              ) : null}
              {locked ? (
                <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-200">
                  Bloccata
                  {risk.lockedBy ? ` · ${risk.lockedBy}` : ''}
                </Badge>
              ) : null}
            </div>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {!locked ? (
                <>
                  <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salva
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleLock}
                    disabled={pending}
                  >
                    <Lock className="mr-1 h-4 w-4" />
                    Blocca
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleUnlock}
                  disabled={pending}
                >
                  <Unlock className="mr-1 h-4 w-4" />
                  Sblocca
                </Button>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {BOSCOLOG_RISK_QUESTIONS.map((q) => (
            <div key={q.id} className="space-y-1">
              <Label>{q.label}</Label>
              {q.hint ? <p className="text-xs text-slate-500">{q.hint}</p> : null}
              <select
                className={selectCls}
                disabled={disabled}
                value={risk.answers[q.id]}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              >
                {BOSCOLOG_TRI_OPTIONS.map((o) => (
                  <option key={o.id || 'empty'} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
          <div className="space-y-1">
            <Label>Valutatore</Label>
            <Input
              disabled={disabled}
              value={risk.assessor}
              onChange={(e) => setRisk({ ...risk, assessor: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Data valutazione</Label>
            <Input
              type="date"
              disabled={disabled}
              value={risk.assessedAt}
              onChange={(e) => setRisk({ ...risk, assessedAt: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Esito due diligence</Label>
            <select
              className={selectCls}
              disabled={disabled}
              value={risk.outcome}
              onChange={(e) => setRisk({ ...risk, outcome: e.target.value })}
            >
              <option value="">—</option>
              {BOSCOLOG_DD_OUTCOMES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Note</Label>
            <Input
              disabled={disabled}
              value={risk.notes}
              onChange={(e) => setRisk({ ...risk, notes: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Misure di mitigazione</Label>
            <Input
              disabled={disabled}
              value={risk.mitigation}
              onChange={(e) => setRisk({ ...risk, mitigation: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Checklist EUDR</h2>
          <div className="flex items-center gap-2">
            <Badge className={eudrCheckBadgeClass(eudr.overallStatus)}>
              {eudrStatusLabel(eudr.overallStatus)}
            </Badge>
            <span className="text-sm font-medium text-slate-700">{eudr.pct}%</span>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${
              eudr.pct >= 90 ? 'bg-emerald-500' : eudr.pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${eudr.pct}%` }}
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {eudr.checks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{c.label}</p>
                <p className="text-slate-500">{c.detail}</p>
              </div>
              <Badge className={eudrCheckBadgeClass(c.status)}>{eudrStatusLabel(c.status)}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
