'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { isBoscologMode } from '@/lib/boscolog/catalog'
import { getToolAccess } from '@/lib/tool-auth'
import type {
  BoscologLot,
  BoscologLotInput,
  BoscologQuickLotInput,
} from '@/types/boscolog'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { copyBoscologLotChildren } from '@/actions/boscolog/lot-operations'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyToNull(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

async function assertSupplierInCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  supplierId: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supplierId) return { ok: true }
  const { data, error } = await supabase
    .from('boscolog_parties')
    .select('id')
    .eq('id', supplierId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Fornitore non valido per questa impresa' }
  return { ok: true }
}

function mapLotRow(
  row: Record<string, unknown>,
  supplierName?: string | null
): BoscologLot {
  return {
    ...(row as unknown as BoscologLot),
    supplier_name: supplierName ?? null,
  }
}

function normalizeLotPayload(input: BoscologLotInput, companyId: string) {
  const mode = input.mode && isBoscologMode(String(input.mode)) ? input.mode : 'diretta'
  return {
    company_id: companyId,
    name: input.name.trim(),
    lot_date: emptyToNull(input.lot_date) ?? todayISO(),
    mode,
    product_type: emptyToNull(input.product_type),
    product_other: emptyToNull(input.product_other),
    origin_eu: emptyToNull(input.origin_eu) ?? 'UE',
    state: emptyToNull(input.state) ?? 'Italia',
    region: emptyToNull(input.region) ?? 'Piemonte',
    province: emptyToNull(input.province),
    comune: emptyToNull(input.comune),
    localita: emptyToNull(input.localita),
    notes: emptyToNull(input.notes),
    cutting_date: emptyToNull(input.cutting_date),
    supplier_id: emptyToNull(input.supplier_id),
    dds_ref: emptyToNull(input.dds_ref),
    deforestation_free: emptyToNull(input.deforestation_free),
    custody_model: emptyToNull(input.custody_model),
    quick_species: emptyToNull(input.quick_species),
    quick_qty: emptyToNull(input.quick_qty),
    quick_unit: emptyToNull(input.quick_unit),
  }
}

function revalidateLots(lotId?: string) {
  revalidatePath('/boscolog')
  revalidatePath('/boscolog/lotti')
  if (lotId) {
    revalidatePath(`/boscolog/lotti/${lotId}`)
    revalidatePath(`/boscolog/lotti/${lotId}/materiale`)
    revalidatePath(`/boscolog/lotti/${lotId}/compliance`)
  }
}

export async function listBoscologLots(filters?: {
  q?: string
  mode?: string
  productType?: string
  supplierId?: string
  riskLevel?: string
}): Promise<{
  success: boolean
  lots?: BoscologLot[]
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
  let query = supabase
    .from('boscolog_lots')
    .select('*')
    .eq('company_id', ctx.company.id)
    .order('lot_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.mode) query = query.eq('mode', filters.mode)
  if (filters?.productType) query = query.eq('product_type', filters.productType)
  if (filters?.supplierId) query = query.eq('supplier_id', filters.supplierId)
  if (filters?.riskLevel) query = query.eq('risk_level', filters.riskLevel)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  const supplierIds = [
    ...new Set((data ?? []).map((r) => r.supplier_id).filter((id): id is string => Boolean(id))),
  ]
  const nameById = new Map<string, string>()
  if (supplierIds.length) {
    const { data: parties } = await supabase
      .from('boscolog_parties')
      .select('id, name')
      .in('id', supplierIds)
    for (const p of parties ?? []) nameById.set(p.id, p.name)
  }

  let lots = (data ?? []).map((row) =>
    mapLotRow(row as Record<string, unknown>, row.supplier_id ? nameById.get(row.supplier_id) : null)
  )

  const q = filters?.q?.trim().toLowerCase()
  if (q) {
    lots = lots.filter((l) => {
      const hay = `${l.name} ${l.comune ?? ''} ${l.province ?? ''} ${l.notes ?? ''} ${l.dds_ref ?? ''} ${l.localita ?? ''} ${l.supplier_name ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  return { success: true, lots }
}

export async function getBoscologLot(
  lotId: string
): Promise<{
  success: boolean
  lot?: BoscologLot
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
  const { data, error } = await supabase
    .from('boscolog_lots')
    .select('*')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Lotto non trovato' }

  let supplierName: string | null = null
  if (data.supplier_id) {
    const { data: party } = await supabase
      .from('boscolog_parties')
      .select('name')
      .eq('id', data.supplier_id)
      .maybeSingle()
    supplierName = party?.name ?? null
  }

  return { success: true, lot: mapLotRow(data as Record<string, unknown>, supplierName) }
}

export async function createBoscologLot(
  input: BoscologLotInput
): Promise<{ success: boolean; id?: string; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }
  if (!input.name?.trim()) return { success: false, error: 'Inserisci il nome del lotto.' }

  const supabase = await createClient()
  const payload = normalizeLotPayload(input, ctx.company.id)
  const supplierCheck = await assertSupplierInCompany(supabase, ctx.company.id, payload.supplier_id)
  if (!supplierCheck.ok) return { success: false, error: supplierCheck.error }

  const { data, error } = await supabase
    .from('boscolog_lots')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Creazione fallita' }

  const quickSpecies = payload.quick_species
  const quickQty = payload.quick_qty
  if (quickSpecies || quickQty) {
    const { error: seedErr } = await supabase.from('boscolog_lot_species').insert({
      lot_id: data.id,
      common: quickSpecies,
      qty: quickQty,
      unit: payload.quick_unit ?? 'm³',
      sort_order: 0,
    })
    if (seedErr) return { success: false, error: seedErr.message }
  }

  revalidateLots(data.id)
  return { success: true, id: data.id }
}

export async function createBoscologLotQuick(
  input: BoscologQuickLotInput
): Promise<{ success: boolean; id?: string; error?: string; needsSetup?: boolean }> {
  const species = input.quick_species?.trim()
  const comune = input.comune?.trim()
  const name =
    input.name?.trim() ||
    [species, comune].filter(Boolean).join(' — ') ||
    `Lotto ${todayISO()}`

  return createBoscologLot({
    name,
    mode: input.mode || 'diretta',
    product_type: input.product_type,
    product_other: input.product_other,
    comune: input.comune,
    cutting_date: input.cutting_date || todayISO(),
    lot_date: todayISO(),
    supplier_id: input.supplier_id,
    dds_ref: input.dds_ref,
    notes: input.notes,
    quick_species: input.quick_species,
    quick_qty: input.quick_qty,
    quick_unit: input.quick_unit || 'm³',
  })
}

export async function updateBoscologLot(
  lotId: string,
  input: BoscologLotInput
): Promise<{ success: boolean; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }
  if (!input.name?.trim()) return { success: false, error: 'Inserisci il nome del lotto.' }

  const supabase = await createClient()
  const payload = normalizeLotPayload(input, ctx.company.id)
  const { company_id: _c, ...updatePayload } = payload

  const supplierCheck = await assertSupplierInCompany(
    supabase,
    ctx.company.id,
    updatePayload.supplier_id
  )
  if (!supplierCheck.ok) return { success: false, error: supplierCheck.error }

  const { error } = await supabase
    .from('boscolog_lots')
    .update(updatePayload)
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }

  revalidateLots(lotId)
  return { success: true }
}

export async function duplicateBoscologLot(
  lotId: string
): Promise<{ success: boolean; id?: string; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const existing = await getBoscologLot(lotId)
  if (!existing.success || !existing.lot) {
    return {
      success: false,
      error: existing.error,
      needsSetup: existing.needsSetup,
    }
  }

  const lot = existing.lot
  const supabase = await createClient()
  const payload = normalizeLotPayload(
    {
      name: `${lot.name} (copia)`,
      lot_date: todayISO(),
      mode: lot.mode,
      product_type: lot.product_type,
      product_other: lot.product_other,
      origin_eu: lot.origin_eu,
      state: lot.state,
      region: lot.region,
      province: lot.province,
      comune: lot.comune,
      localita: lot.localita,
      notes: lot.notes,
      cutting_date: lot.cutting_date,
      supplier_id: lot.supplier_id,
      dds_ref: lot.dds_ref,
      deforestation_free: lot.deforestation_free,
      custody_model: lot.custody_model,
      quick_species: lot.quick_species,
      quick_qty: lot.quick_qty,
      quick_unit: lot.quick_unit,
    },
    ctx.company.id
  )

  const { data, error } = await supabase
    .from('boscolog_lots')
    .insert({
      ...payload,
      risk: (lot.risk as unknown as Record<string, unknown>) ?? {},
      risk_score: lot.risk_score ?? null,
      risk_level: lot.risk_level ?? null,
      geojson: (lot.geojson as unknown as Record<string, unknown>) ?? null,
      geo_feature_count: lot.geo_feature_count ?? null,
      geo_area_ha: lot.geo_area_ha ?? null,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Duplicazione fallita' }

  // Unlock copy so editors can revise the duplicated assessment
  if (lot.risk && typeof lot.risk === 'object') {
    const unlocked = {
      ...(lot.risk as Record<string, unknown>),
      locked: false,
      lockedAt: '',
      lockedBy: '',
    }
    await supabase
      .from('boscolog_lots')
      .update({ risk: unlocked })
      .eq('id', data.id)
  }

  const copy = await copyBoscologLotChildren(lotId, data.id, ctx.company.id)
  if (!copy.success) return { success: false, error: copy.error }

  revalidateLots(data.id)
  return { success: true, id: data.id }
}

export async function deleteBoscologLot(
  lotId: string
): Promise<{ success: boolean; error?: string; needsSetup?: boolean }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: false, needsSetup: true, error: 'needs_setup' }
  }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_lots')
    .delete()
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }

  revalidateLots()
  return { success: true }
}

export async function countBoscologLots(): Promise<{
  success: boolean
  count?: number
  error?: string
  needsSetup?: boolean
}> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) {
    return { success: true, needsSetup: true, count: 0 }
  }

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('boscolog_lots')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }
  return { success: true, count: count ?? 0 }
}
