'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { buildBoscologAlerts, type BoscologAlert } from '@/lib/boscolog/alerts'
import { eudrChecklist } from '@/lib/boscolog/eudr-checklist'
import { lotHasGeo } from '@/lib/boscolog/geojson'
import { permitLabel } from '@/lib/boscolog/catalog'
import { toIcsDateStr, type IcsEvent } from '@/lib/boscolog/ics'
import { normalizeRisk, riskCompute } from '@/lib/boscolog/risk'
import { calcTotals, calcTotalsBySpecies } from '@/lib/boscolog/totals'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'

export type BoscologDashboardData = {
  lotCount: number
  risk: { basso: number; medio: number; alto: number; unset: number }
  eudr: { pass: number; partial: number; fail: number }
  alerts: BoscologAlert[]
  icsEvents: IcsEvent[]
}

export async function getBoscologDashboard(): Promise<{
  success: boolean
  data?: BoscologDashboardData
  error?: string
  needsSetup?: boolean
}> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }

  const supabase = await createClient()
  const companyId = ctx.company.id

  const [lotsRes, partiesRes] = await Promise.all([
    supabase.from('boscolog_lots').select('*').eq('company_id', companyId),
    supabase
      .from('boscolog_parties')
      .select('id, name, bp_expire')
      .eq('company_id', companyId),
  ])

  if (lotsRes.error) return { success: false, error: lotsRes.error.message }
  if (partiesRes.error) return { success: false, error: partiesRes.error.message }

  const lots = lotsRes.data ?? []
  const lotIdList = lots.map((l) => l.id)
  const parties = partiesRes.data ?? []
  const partyName = new Map(parties.map((p) => [p.id, p.name]))

  let speciesRows: {
    id: string
    lot_id: string
    common: string | null
    scientific: string | null
    qty: string | null
    unit: string | null
  }[] = []
  let exitRows: {
    lot_id: string
    species_id: string | null
    qty: string | null
    unit: string | null
    doc_ref: string | null
  }[] = []
  let permitRows: {
    lot_id: string
    type: string
    expire_date: string | null
    protocol: string | null
    authority: string | null
  }[] = []

  if (lotIdList.length) {
    const [speciesRes, exitsRes, permitsRes] = await Promise.all([
      supabase
        .from('boscolog_lot_species')
        .select('id, lot_id, common, scientific, qty, unit')
        .in('lot_id', lotIdList),
      supabase
        .from('boscolog_lot_exits')
        .select('lot_id, species_id, qty, unit, doc_ref')
        .in('lot_id', lotIdList),
      supabase
        .from('boscolog_lot_permits')
        .select('lot_id, type, expire_date, protocol, authority')
        .in('lot_id', lotIdList),
    ])
    if (speciesRes.error) return { success: false, error: speciesRes.error.message }
    if (exitsRes.error) return { success: false, error: exitsRes.error.message }
    if (permitsRes.error) return { success: false, error: permitsRes.error.message }
    speciesRows = speciesRes.data ?? []
    exitRows = exitsRes.data ?? []
    permitRows = permitsRes.data ?? []
  }

  const speciesByLot = new Map<string, typeof speciesRows>()
  for (const s of speciesRows) {
    const arr = speciesByLot.get(s.lot_id) ?? []
    arr.push(s)
    speciesByLot.set(s.lot_id, arr)
  }
  const exitsByLot = new Map<string, typeof exitRows>()
  for (const e of exitRows) {
    const arr = exitsByLot.get(e.lot_id) ?? []
    arr.push(e)
    exitsByLot.set(e.lot_id, arr)
  }
  const permitsByLot = new Map<string, typeof permitRows>()
  for (const p of permitRows) {
    const arr = permitsByLot.get(p.lot_id) ?? []
    arr.push(p)
    permitsByLot.set(p.lot_id, arr)
  }

  const riskCounts = { basso: 0, medio: 0, alto: 0, unset: 0 }
  const eudrCounts = { pass: 0, partial: 0, fail: 0 }

  const alertLots = lots.map((lot) => {
    const species = speciesByLot.get(lot.id) ?? []
    const exits = exitsByLot.get(lot.id) ?? []
    const permits = permitsByLot.get(lot.id) ?? []
    const hasGeo = lotHasGeo(lot)
    const risk = normalizeRisk(lot.risk, hasGeo)
    const computed = riskCompute({
      origin_eu: lot.origin_eu,
      risk,
      hasGeo,
    })
    const eudr = eudrChecklist({
      species,
      exits,
      permits: permits.map((p) => ({ id: `${p.lot_id}-${p.type}`, hasDocs: false })),
      cutting_date: lot.cutting_date,
      supplier_id: lot.supplier_id,
      supplier_name: lot.supplier_id ? partyName.get(lot.supplier_id) ?? null : null,
      dds_ref: lot.dds_ref,
      deforestation_free: lot.deforestation_free,
      risk_outcome: risk.outcome,
      hasGeo,
      lotDocCount: 0,
    })
    const totals = calcTotals({ species, exits })
    const speciesTotals = calcTotalsBySpecies({ species, exits })

    if (computed.level === 'Basso') riskCounts.basso += 1
    else if (computed.level === 'Medio') riskCounts.medio += 1
    else if (computed.level === 'Alto') riskCounts.alto += 1

    if (eudr.overallStatus === 'pass') eudrCounts.pass += 1
    else if (eudr.overallStatus === 'partial') eudrCounts.partial += 1
    else eudrCounts.fail += 1

    return {
      id: lot.id,
      name: lot.name,
      hasGeo,
      permits: permits.map((p) => ({ type: p.type, expire_date: p.expire_date })),
      risk: computed,
      totals,
      speciesTotals,
      eudr,
    }
  })

  const alerts = buildBoscologAlerts(
    alertLots,
    parties.map((p) => ({ id: p.id, name: p.name, bp_expire: p.bp_expire }))
  ).slice(0, 15)

  const icsEvents: IcsEvent[] = []
  for (const lot of lots) {
    for (const p of permitsByLot.get(lot.id) ?? []) {
      if (!p.expire_date) continue
      const dateStr = toIcsDateStr(p.expire_date)
      if (!dateStr) continue
      icsEvents.push({
        dateStr,
        summary: `Scadenza: ${permitLabel(p.type)} - ${lot.name}`,
        description: `Autorizzazione ${permitLabel(p.type)}\nProtocollo: ${p.protocol || 'n.d.'}\nEnte: ${p.authority || 'n.d.'}\nLotto: ${lot.name}`,
        uid: `boscolog-permit-${lot.id}-${p.type}-${p.expire_date}@pascericonsulting`,
      })
    }
  }
  for (const p of parties) {
    if (!p.bp_expire) continue
    const dateStr = toIcsDateStr(p.bp_expire)
    if (!dateStr) continue
    icsEvents.push({
      dateStr,
      summary: `Scadenza BiomassPlus: ${p.name}`,
      description: `Certificato BiomassPlus\nAzienda: ${p.name}`,
      uid: `boscolog-bp-${p.id}-${p.bp_expire}@pascericonsulting`,
    })
  }

  return {
    success: true,
    data: {
      lotCount: lots.length,
      risk: riskCounts,
      eudr: eudrCounts,
      alerts,
      icsEvents,
    },
  }
}
