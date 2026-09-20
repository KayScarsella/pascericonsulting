'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { eudrChecklist, type EudrChecklistResult } from '@/lib/boscolog/eudr-checklist'
import { lotHasGeo } from '@/lib/boscolog/geojson'
import {
  normalizeRisk,
  riskCompute,
  type BoscologRisk,
  type RiskComputeResult,
} from '@/lib/boscolog/risk'
import { getToolAccess } from '@/lib/tool-auth'
import type { BoscologRiskPayload } from '@/types/boscolog'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'

function revalidateLot(lotId: string) {
  revalidatePath('/boscolog')
  revalidatePath('/boscolog/lotti')
  revalidatePath(`/boscolog/lotti/${lotId}`)
  revalidatePath(`/boscolog/lotti/${lotId}/compliance`)
}

async function loadLotComplianceBundle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  lotId: string
): Promise<
  | {
      ok: true
      risk: BoscologRisk
      computed: RiskComputeResult
      eudr: EudrChecklistResult
      hasGeo: boolean
    }
  | { ok: false; error: string }
> {
  const { data: lot, error } = await supabase
    .from('boscolog_lots')
    .select('*')
    .eq('id', lotId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!lot) return { ok: false, error: 'Lotto non trovato' }

  const [speciesRes, exitsRes, permitsRes, partyRes] = await Promise.all([
    supabase
      .from('boscolog_lot_species')
      .select('common, scientific, qty')
      .eq('lot_id', lotId),
    supabase.from('boscolog_lot_exits').select('doc_ref').eq('lot_id', lotId),
    supabase.from('boscolog_lot_permits').select('id').eq('lot_id', lotId),
    lot.supplier_id
      ? supabase.from('boscolog_parties').select('name').eq('id', lot.supplier_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ])

  const hasGeo = lotHasGeo(lot)
  const risk = normalizeRisk(lot.risk, hasGeo)
  const computed = riskCompute({
    origin_eu: lot.origin_eu,
    risk,
    hasGeo,
  })
  const eudr = eudrChecklist({
    species: speciesRes.data ?? [],
    exits: exitsRes.data ?? [],
    permits: (permitsRes.data ?? []).map((p) => ({ id: p.id, hasDocs: false })),
    cutting_date: lot.cutting_date,
    supplier_id: lot.supplier_id,
    supplier_name: partyRes.data?.name ?? null,
    dds_ref: lot.dds_ref,
    deforestation_free: lot.deforestation_free,
    risk_outcome: risk.outcome,
    hasGeo,
    lotDocCount: 0,
  })

  return { ok: true, risk, computed, eudr, hasGeo }
}

export type BoscologLotCompliance = {
  risk: BoscologRisk
  computed: RiskComputeResult
  eudr: EudrChecklistResult
  hasGeo: boolean
}

export async function getBoscologLotCompliance(
  lotId: string
): Promise<{
  success: boolean
  data?: BoscologLotCompliance
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
  const bundle = await loadLotComplianceBundle(supabase, ctx.company.id, lotId)
  if (!bundle.ok) return { success: false, error: bundle.error }

  return {
    success: true,
    data: {
      risk: bundle.risk,
      computed: bundle.computed,
      eudr: bundle.eudr,
      hasGeo: bundle.hasGeo,
    },
  }
}

export async function updateBoscologLotRisk(
  lotId: string,
  payload: BoscologRiskPayload
): Promise<{ success: boolean; error?: string; computed?: RiskComputeResult }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const { data: lot, error: lotErr } = await supabase
    .from('boscolog_lots')
    .select('id, origin_eu, risk, geojson, geo_feature_count')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (lotErr) return { success: false, error: lotErr.message }
  if (!lot) return { success: false, error: 'Lotto non trovato' }

  const hasGeo = lotHasGeo(lot)
  const existing = normalizeRisk(lot.risk, hasGeo)
  if (existing.locked) {
    return { success: false, error: 'Valutazione bloccata. Sblocca prima di modificare.' }
  }

  const next = normalizeRisk(
    {
      ...existing,
      assessedAt: payload.assessedAt ?? existing.assessedAt,
      assessor: payload.assessor ?? existing.assessor,
      outcome: payload.outcome ?? existing.outcome,
      notes: payload.notes ?? existing.notes,
      mitigation: payload.mitigation ?? existing.mitigation,
      locked: false,
      lockedAt: existing.lockedAt,
      lockedBy: existing.lockedBy,
      answers: {
        ...existing.answers,
        ...(payload.answers ?? {}),
      },
    },
    hasGeo
  )

  const computed = riskCompute({
    origin_eu: lot.origin_eu,
    risk: next,
    hasGeo,
  })

  const { error } = await supabase
    .from('boscolog_lots')
    .update({
      risk: next as unknown as Record<string, unknown>,
      risk_score: computed.score,
      risk_level: computed.level,
    })
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }

  revalidateLot(lotId)
  return { success: true, computed }
}

async function currentUserLabel(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.email ?? user?.id ?? 'utente'
}

export async function lockBoscologLotRisk(
  lotId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const { data: lot, error: lotErr } = await supabase
    .from('boscolog_lots')
    .select('id, origin_eu, risk, geojson, geo_feature_count')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (lotErr) return { success: false, error: lotErr.message }
  if (!lot) return { success: false, error: 'Lotto non trovato' }

  const who = await currentUserLabel(supabase)
  const now = new Date().toISOString()
  const hasGeo = lotHasGeo(lot)
  const risk = normalizeRisk(lot.risk, hasGeo)
  risk.locked = true
  risk.lockedAt = now
  risk.lockedBy = who
  if (!risk.assessedAt) risk.assessedAt = now.slice(0, 10)

  const computed = riskCompute({
    origin_eu: lot.origin_eu,
    risk,
    hasGeo,
  })

  const { error } = await supabase
    .from('boscolog_lots')
    .update({
      risk: risk as unknown as Record<string, unknown>,
      risk_score: computed.score,
      risk_level: computed.level,
    })
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

export async function unlockBoscologLotRisk(
  lotId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const { data: lot, error: lotErr } = await supabase
    .from('boscolog_lots')
    .select('id, risk')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (lotErr) return { success: false, error: lotErr.message }
  if (!lot) return { success: false, error: 'Lotto non trovato' }

  const risk = normalizeRisk(lot.risk, false)
  risk.locked = false
  risk.lockedAt = ''
  risk.lockedBy = ''

  const { error } = await supabase
    .from('boscolog_lots')
    .update({ risk: risk as unknown as Record<string, unknown> })
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}
