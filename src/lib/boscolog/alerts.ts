import { permitLabel } from '@/lib/boscolog/catalog'
import type { EudrChecklistResult } from '@/lib/boscolog/eudr-checklist'
import type { LotTotals, SpeciesTotals } from '@/lib/boscolog/totals'
import type { RiskComputeResult } from '@/lib/boscolog/risk'

export type BoscologAlertType = 'bad' | 'warn'

export type BoscologAlert = {
  type: BoscologAlertType
  text: string
  lotId?: string
  partyId?: string
}

export type AlertLotInput = {
  id: string
  name: string
  hasGeo?: boolean
  permits: { type: string; expire_date?: string | null }[]
  risk: RiskComputeResult
  totals: LotTotals
  speciesTotals?: SpeciesTotals[]
  eudr: EudrChecklistResult
}

export type AlertPartyInput = {
  id: string
  name: string
  bp_expire?: string | null
}

export function buildBoscologAlerts(
  lots: AlertLotInput[],
  parties: AlertPartyInput[]
): BoscologAlert[] {
  const alerts: BoscologAlert[] = []
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  for (const l of lots) {
    for (const p of l.permits) {
      if (!p.expire_date) continue
      const exp = new Date(`${p.expire_date}T00:00:00`)
      if (Number.isNaN(exp.getTime())) continue
      if (exp < now) {
        alerts.push({
          type: 'bad',
          lotId: l.id,
          text: `Autorizzazione scaduta: ${permitLabel(p.type)} del lotto "${l.name}" (scaduta il ${p.expire_date})`,
        })
      } else if (exp <= in30) {
        alerts.push({
          type: 'warn',
          lotId: l.id,
          text: `Autorizzazione in scadenza: ${permitLabel(p.type)} del lotto "${l.name}" (scade il ${p.expire_date})`,
        })
      }
    }

    if (!l.hasGeo) {
      alerts.push({
        type: 'warn',
        lotId: l.id,
        text: `Lotto "${l.name}" senza geodati (geolocalizzazione richiesta EUDR)`,
      })
    }

    if (l.risk.level === 'Alto') {
      alerts.push({
        type: 'bad',
        lotId: l.id,
        text: `Lotto "${l.name}" con rischio ALTO (score ${l.risk.score}/100)`,
      })
    }

    const speciesNeg = (l.speciesTotals ?? []).filter((s) => s.residueNegative)
    if (speciesNeg.length) {
      for (const s of speciesNeg) {
        alerts.push({
          type: 'bad',
          lotId: l.id,
          text: `Lotto "${l.name}" residuo negativo su "${s.label}" (${s.residue}${s.unit ? ` ${s.unit}` : ''})`,
        })
      }
    } else if (l.totals.residueNegative) {
      alerts.push({
        type: 'bad',
        lotId: l.id,
        text: `Lotto "${l.name}" con residuo negativo (venduto più del disponibile)`,
      })
    }

    if (l.eudr.pct < 50) {
      alerts.push({
        type: 'warn',
        lotId: l.id,
        text: `Lotto "${l.name}" EUDR incompleto (${l.eudr.pct}% – ${l.eudr.failed} requisiti mancanti)`,
      })
    }
  }

  for (const p of parties) {
    if (!p.bp_expire) continue
    const exp = new Date(`${p.bp_expire}T00:00:00`)
    if (Number.isNaN(exp.getTime())) continue
    if (exp < now) {
      alerts.push({
        type: 'bad',
        partyId: p.id,
        text: `Certificato BiomassPlus scaduto: "${p.name}" (scaduto il ${p.bp_expire})`,
      })
    } else if (exp <= in30) {
      alerts.push({
        type: 'warn',
        partyId: p.id,
        text: `Certificato BiomassPlus in scadenza: "${p.name}" (scade il ${p.bp_expire})`,
      })
    }
  }

  alerts.sort((a, b) => (a.type === 'bad' ? 0 : 1) - (b.type === 'bad' ? 0 : 1))
  return alerts
}
