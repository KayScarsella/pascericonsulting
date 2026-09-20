'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import {
  BOSCOLOG_MOVEMENT_TYPES,
  BOSCOLOG_PERMIT_TYPES,
} from '@/lib/boscolog/catalog'
import { calcMassBalance, calcTotals, calcTotalsBySpecies, type LotTotals, type MassBalanceResult, type SpeciesTotals } from '@/lib/boscolog/totals'
import { getToolAccess } from '@/lib/tool-auth'
import type {
  BoscologLotExit,
  BoscologLotExitInput,
  BoscologLotMovement,
  BoscologLotMovementInput,
  BoscologLotPermit,
  BoscologLotPermitInput,
  BoscologLotSpecies,
  BoscologLotSpeciesInput,
} from '@/types/boscolog'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'

type Supabase = Awaited<ReturnType<typeof createClient>>

function emptyToNull(value: string | null | undefined): string | null {
  const t = value?.trim()
  return t ? t : null
}

function revalidateLot(lotId: string) {
  revalidatePath('/boscolog')
  revalidatePath('/boscolog/lotti')
  revalidatePath(`/boscolog/lotti/${lotId}`)
  revalidatePath(`/boscolog/lotti/${lotId}/materiale`)
  revalidatePath(`/boscolog/lotti/${lotId}/compliance`)
}

async function assertLotAccess(
  supabase: Supabase,
  companyId: string,
  lotId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('boscolog_lots')
    .select('id')
    .eq('id', lotId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Lotto non trovato' }
  return { ok: true }
}

async function assertPartyInCompany(
  supabase: Supabase,
  companyId: string,
  partyId: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!partyId) return { ok: true }
  const { data, error } = await supabase
    .from('boscolog_parties')
    .select('id')
    .eq('id', partyId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Anagrafica non valida per questa impresa' }
  return { ok: true }
}

function isPermitType(value: string): boolean {
  return BOSCOLOG_PERMIT_TYPES.some((t) => t.id === value)
}

function isMovementType(value: string): boolean {
  return BOSCOLOG_MOVEMENT_TYPES.some((t) => t.id === value)
}

async function assertSpeciesInLot(
  supabase: Supabase,
  lotId: string,
  speciesId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!speciesId) return { ok: true }
  const { data, error } = await supabase
    .from('boscolog_lot_species')
    .select('id')
    .eq('id', speciesId)
    .eq('lot_id', lotId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Specie non valida per questo lotto' }
  return { ok: true }
}

async function resolveExitSpeciesId(
  supabase: Supabase,
  lotId: string,
  speciesId: string | null | undefined
): Promise<{ ok: true; speciesId: string | null } | { ok: false; error: string }> {
  const sid = emptyToNull(speciesId)
  const { count, error } = await supabase
    .from('boscolog_lot_species')
    .select('id', { count: 'exact', head: true })
    .eq('lot_id', lotId)
  if (error) return { ok: false, error: error.message }
  const hasSpecies = (count ?? 0) > 0
  if (hasSpecies && !sid) {
    return { ok: false, error: 'Seleziona la specie di questa uscita.' }
  }
  const check = await assertSpeciesInLot(supabase, lotId, sid)
  if (!check.ok) return check
  return { ok: true, speciesId: sid }
}

export type BoscologLotMaterial = {
  species: BoscologLotSpecies[]
  exits: BoscologLotExit[]
  movements: BoscologLotMovement[]
  parentIds: string[]
  parentOptions: { id: string; name: string }[]
  totals: LotTotals
  speciesTotals: SpeciesTotals[]
  massBalance: MassBalanceResult
}

/** @deprecated use getBoscologLotMaterial + getBoscologLotPermits */
export type BoscologLotOperations = BoscologLotMaterial & {
  permits: BoscologLotPermit[]
}

export async function getBoscologLotMaterial(
  lotId: string
): Promise<{
  success: boolean
  data?: BoscologLotMaterial
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
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const [speciesRes, exitsRes, movementsRes, parentsRes, lotsRes] = await Promise.all([
    supabase
      .from('boscolog_lot_species')
      .select('*')
      .eq('lot_id', lotId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('boscolog_lot_exits')
      .select('*')
      .eq('lot_id', lotId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('boscolog_lot_movements')
      .select('*')
      .eq('lot_id', lotId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('boscolog_lot_parents').select('parent_lot_id').eq('lot_id', lotId),
    supabase
      .from('boscolog_lots')
      .select('id, name')
      .eq('company_id', ctx.company.id)
      .neq('id', lotId)
      .order('name', { ascending: true }),
  ])

  const firstErr =
    speciesRes.error || exitsRes.error || movementsRes.error || parentsRes.error || lotsRes.error
  if (firstErr) return { success: false, error: firstErr.message }

  const species = (speciesRes.data ?? []) as BoscologLotSpecies[]
  const exits = (exitsRes.data ?? []) as BoscologLotExit[]
  const movements = (movementsRes.data ?? []) as BoscologLotMovement[]
  const parentIds = (parentsRes.data ?? []).map((r) => r.parent_lot_id)

  const totals = calcTotals({ species, exits, movements })
  const speciesTotals = calcTotalsBySpecies({ species, exits })

  const parentLotIds = [...new Set(parentIds)]
  const parentGraph = new Map<
    string,
    {
      id: string
      species: BoscologLotSpecies[]
      exits: BoscologLotExit[]
      movements: BoscologLotMovement[]
      parentLots: string[]
    }
  >()

  if (parentLotIds.length) {
    const [pSpecies, pExits, pMoves] = await Promise.all([
      supabase.from('boscolog_lot_species').select('*').in('lot_id', parentLotIds),
      supabase.from('boscolog_lot_exits').select('*').in('lot_id', parentLotIds),
      supabase.from('boscolog_lot_movements').select('*').in('lot_id', parentLotIds),
    ])
    for (const pid of parentLotIds) {
      parentGraph.set(pid, {
        id: pid,
        species: ((pSpecies.data ?? []) as BoscologLotSpecies[]).filter((s) => s.lot_id === pid),
        exits: ((pExits.data ?? []) as BoscologLotExit[]).filter((e) => e.lot_id === pid),
        movements: ((pMoves.data ?? []) as BoscologLotMovement[]).filter((m) => m.lot_id === pid),
        parentLots: [],
      })
    }
  }

  const massBalance = calcMassBalance(
    { id: lotId, species, exits, movements, parentLots: parentIds },
    (id) => parentGraph.get(id) ?? null
  )

  return {
    success: true,
    data: {
      species,
      exits,
      movements,
      parentIds,
      parentOptions: (lotsRes.data ?? []).map((l) => ({ id: l.id, name: l.name })),
      totals,
      speciesTotals,
      massBalance,
    },
  }
}

export async function getBoscologLotPermits(
  lotId: string
): Promise<{
  success: boolean
  permits?: BoscologLotPermit[]
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
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { data, error } = await supabase
    .from('boscolog_lot_permits')
    .select('*')
    .eq('lot_id', lotId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, permits: (data ?? []) as BoscologLotPermit[] }
}

export async function getBoscologLotOperations(
  lotId: string
): Promise<{
  success: boolean
  data?: BoscologLotOperations
  error?: string
  needsSetup?: boolean
}> {
  const [mat, permits] = await Promise.all([
    getBoscologLotMaterial(lotId),
    getBoscologLotPermits(lotId),
  ])
  if (!mat.success || !mat.data) {
    return { success: false, error: mat.error, needsSetup: mat.needsSetup }
  }
  if (!permits.success) {
    return { success: false, error: permits.error, needsSetup: permits.needsSetup }
  }
  return {
    success: true,
    data: { ...mat.data, permits: permits.permits ?? [] },
  }
}

async function nextSortOrder(
  supabase: Supabase,
  table:
    | 'boscolog_lot_species'
    | 'boscolog_lot_exits'
    | 'boscolog_lot_movements'
    | 'boscolog_lot_permits',
  lotId: string
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('sort_order')
    .eq('lot_id', lotId)
    .order('sort_order', { ascending: false })
    .limit(1)
  return (data?.[0]?.sort_order ?? -1) + 1
}

// --- Species ---

export async function createBoscologLotSpecies(
  lotId: string,
  input: BoscologLotSpeciesInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const sort_order = await nextSortOrder(supabase, 'boscolog_lot_species', lotId)
  const { data, error } = await supabase
    .from('boscolog_lot_species')
    .insert({
      lot_id: lotId,
      common: emptyToNull(input.common),
      scientific: emptyToNull(input.scientific),
      assortment: emptyToNull(input.assortment),
      qty: emptyToNull(input.qty),
      unit: emptyToNull(input.unit) ?? 'm³',
      notes: emptyToNull(input.notes),
      quality_class: emptyToNull(input.quality_class),
      moisture_pct: emptyToNull(input.moisture_pct),
      log_length: emptyToNull(input.log_length),
      sort_order,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Creazione fallita' }
  revalidateLot(lotId)
  return { success: true, id: data.id }
}

export async function updateBoscologLotSpecies(
  lotId: string,
  rowId: string,
  input: BoscologLotSpeciesInput
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_species')
    .update({
      common: emptyToNull(input.common),
      scientific: emptyToNull(input.scientific),
      assortment: emptyToNull(input.assortment),
      qty: emptyToNull(input.qty),
      unit: emptyToNull(input.unit) ?? 'm³',
      notes: emptyToNull(input.notes),
      quality_class: emptyToNull(input.quality_class),
      moisture_pct: emptyToNull(input.moisture_pct),
      log_length: emptyToNull(input.log_length),
    })
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

export async function deleteBoscologLotSpecies(
  lotId: string,
  rowId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_species')
    .delete()
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

// --- Exits ---

export async function createBoscologLotExit(
  lotId: string,
  input: BoscologLotExitInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const buyerId = emptyToNull(input.buyer_id)
  const partyCheck = await assertPartyInCompany(supabase, ctx.company.id, buyerId)
  if (!partyCheck.ok) return { success: false, error: partyCheck.error }

  const speciesRes = await resolveExitSpeciesId(supabase, lotId, input.species_id)
  if (!speciesRes.ok) return { success: false, error: speciesRes.error }

  const sort_order = await nextSortOrder(supabase, 'boscolog_lot_exits', lotId)
  const { data, error } = await supabase
    .from('boscolog_lot_exits')
    .insert({
      lot_id: lotId,
      species_id: speciesRes.speciesId,
      buyer_id: buyerId,
      buyer_name: emptyToNull(input.buyer_name),
      exit_date: emptyToNull(input.exit_date),
      product: emptyToNull(input.product),
      qty: emptyToNull(input.qty),
      unit: emptyToNull(input.unit),
      doc_ref: emptyToNull(input.doc_ref),
      notes: emptyToNull(input.notes),
      sort_order,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Creazione fallita' }
  revalidateLot(lotId)
  return { success: true, id: data.id }
}

export async function updateBoscologLotExit(
  lotId: string,
  rowId: string,
  input: BoscologLotExitInput
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const buyerId = emptyToNull(input.buyer_id)
  const partyCheck = await assertPartyInCompany(supabase, ctx.company.id, buyerId)
  if (!partyCheck.ok) return { success: false, error: partyCheck.error }

  const speciesRes = await resolveExitSpeciesId(supabase, lotId, input.species_id)
  if (!speciesRes.ok) return { success: false, error: speciesRes.error }

  const { error } = await supabase
    .from('boscolog_lot_exits')
    .update({
      species_id: speciesRes.speciesId,
      buyer_id: buyerId,
      buyer_name: emptyToNull(input.buyer_name),
      exit_date: emptyToNull(input.exit_date),
      product: emptyToNull(input.product),
      qty: emptyToNull(input.qty),
      unit: emptyToNull(input.unit),
      doc_ref: emptyToNull(input.doc_ref),
      notes: emptyToNull(input.notes),
    })
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

export async function deleteBoscologLotExit(
  lotId: string,
  rowId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_exits')
    .delete()
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

// --- Movements ---

export async function createBoscologLotMovement(
  lotId: string,
  input: BoscologLotMovementInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const type = input.type ?? 'ingresso'
  if (!isMovementType(type)) return { success: false, error: 'Tipo movimento non valido' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const partyId = emptyToNull(input.party_id)
  const partyCheck = await assertPartyInCompany(supabase, ctx.company.id, partyId)
  if (!partyCheck.ok) return { success: false, error: partyCheck.error }

  const sort_order = await nextSortOrder(supabase, 'boscolog_lot_movements', lotId)
  const { data, error } = await supabase
    .from('boscolog_lot_movements')
    .insert({
      lot_id: lotId,
      type,
      movement_date: emptyToNull(input.movement_date),
      qty_in: emptyToNull(input.qty_in),
      qty_out: emptyToNull(input.qty_out),
      unit: emptyToNull(input.unit),
      yield_pct: emptyToNull(input.yield_pct),
      loss_pct: emptyToNull(input.loss_pct),
      product: emptyToNull(input.product),
      party_id: partyId,
      party_name: emptyToNull(input.party_name),
      doc_ref: emptyToNull(input.doc_ref),
      location: emptyToNull(input.location),
      notes: emptyToNull(input.notes),
      sort_order,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Creazione fallita' }
  revalidateLot(lotId)
  return { success: true, id: data.id }
}

export async function updateBoscologLotMovement(
  lotId: string,
  rowId: string,
  input: BoscologLotMovementInput
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const type = input.type ?? 'ingresso'
  if (!isMovementType(type)) return { success: false, error: 'Tipo movimento non valido' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const partyId = emptyToNull(input.party_id)
  const partyCheck = await assertPartyInCompany(supabase, ctx.company.id, partyId)
  if (!partyCheck.ok) return { success: false, error: partyCheck.error }

  const { error } = await supabase
    .from('boscolog_lot_movements')
    .update({
      type,
      movement_date: emptyToNull(input.movement_date),
      qty_in: emptyToNull(input.qty_in),
      qty_out: emptyToNull(input.qty_out),
      unit: emptyToNull(input.unit),
      yield_pct: emptyToNull(input.yield_pct),
      loss_pct: emptyToNull(input.loss_pct),
      product: emptyToNull(input.product),
      party_id: partyId,
      party_name: emptyToNull(input.party_name),
      doc_ref: emptyToNull(input.doc_ref),
      location: emptyToNull(input.location),
      notes: emptyToNull(input.notes),
    })
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

export async function deleteBoscologLotMovement(
  lotId: string,
  rowId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_movements')
    .delete()
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

// --- Permits ---

export async function createBoscologLotPermit(
  lotId: string,
  input: BoscologLotPermitInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const type = input.type ?? 'forestale'
  if (!isPermitType(type)) return { success: false, error: 'Tipo autorizzazione non valido' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const sort_order = await nextSortOrder(supabase, 'boscolog_lot_permits', lotId)
  const { data, error } = await supabase
    .from('boscolog_lot_permits')
    .insert({
      lot_id: lotId,
      type,
      other: emptyToNull(input.other),
      protocol: emptyToNull(input.protocol),
      authority: emptyToNull(input.authority),
      issue_date: emptyToNull(input.issue_date),
      expire_date: emptyToNull(input.expire_date),
      notes: emptyToNull(input.notes),
      sort_order,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Creazione fallita' }
  revalidateLot(lotId)
  return { success: true, id: data.id }
}

export async function updateBoscologLotPermit(
  lotId: string,
  rowId: string,
  input: BoscologLotPermitInput
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const type = input.type ?? 'forestale'
  if (!isPermitType(type)) return { success: false, error: 'Tipo autorizzazione non valido' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_permits')
    .update({
      type,
      other: emptyToNull(input.other),
      protocol: emptyToNull(input.protocol),
      authority: emptyToNull(input.authority),
      issue_date: emptyToNull(input.issue_date),
      expire_date: emptyToNull(input.expire_date),
      notes: emptyToNull(input.notes),
    })
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

export async function deleteBoscologLotPermit(
  lotId: string,
  rowId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const { error } = await supabase
    .from('boscolog_lot_permits')
    .delete()
    .eq('id', rowId)
    .eq('lot_id', lotId)

  if (error) return { success: false, error: error.message }
  revalidateLot(lotId)
  return { success: true }
}

// --- Parents ---

async function wouldCreateCycle(
  supabase: Supabase,
  lotId: string,
  parentIds: string[]
): Promise<boolean> {
  // Soft cycle check: if lotId appears in ancestors of any selected parent.
  const queue = [...parentIds]
  const visited = new Set<string>()
  while (queue.length) {
    const current = queue.shift()!
    if (current === lotId) return true
    if (visited.has(current)) continue
    visited.add(current)
    const { data } = await supabase
      .from('boscolog_lot_parents')
      .select('parent_lot_id')
      .eq('lot_id', current)
    for (const row of data ?? []) queue.push(row.parent_lot_id)
  }
  return false
}

export async function setBoscologLotParents(
  lotId: string,
  parentIds: string[]
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const access = await assertLotAccess(supabase, ctx.company.id, lotId)
  if (!access.ok) return { success: false, error: access.error }

  const unique = [...new Set(parentIds.filter(Boolean))]
  if (unique.includes(lotId)) {
    return { success: false, error: 'Un lotto non può essere padre di se stesso' }
  }

  if (unique.length) {
    const { data: parents, error } = await supabase
      .from('boscolog_lots')
      .select('id')
      .eq('company_id', ctx.company.id)
      .in('id', unique)
    if (error) return { success: false, error: error.message }
    if ((parents ?? []).length !== unique.length) {
      return { success: false, error: 'Uno o più lotti padre non appartengono a questa impresa' }
    }
  }

  if (await wouldCreateCycle(supabase, lotId, unique)) {
    return { success: false, error: 'Selezione non valida: creerebbe un ciclo tra lotti' }
  }

  const { error: delErr } = await supabase.from('boscolog_lot_parents').delete().eq('lot_id', lotId)
  if (delErr) return { success: false, error: delErr.message }

  if (unique.length) {
    const { error: insErr } = await supabase.from('boscolog_lot_parents').insert(
      unique.map((parent_lot_id) => ({ lot_id: lotId, parent_lot_id }))
    )
    if (insErr) return { success: false, error: insErr.message }
  }

  revalidateLot(lotId)
  return { success: true }
}

/** Used by lots.ts duplicate — copies child rows onto a new lot. */
export async function copyBoscologLotChildren(
  sourceLotId: string,
  targetLotId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const [species, exits, movements, permits, parents] = await Promise.all([
    supabase.from('boscolog_lot_species').select('*').eq('lot_id', sourceLotId),
    supabase.from('boscolog_lot_exits').select('*').eq('lot_id', sourceLotId),
    supabase.from('boscolog_lot_movements').select('*').eq('lot_id', sourceLotId),
    supabase.from('boscolog_lot_permits').select('*').eq('lot_id', sourceLotId),
    supabase.from('boscolog_lot_parents').select('parent_lot_id').eq('lot_id', sourceLotId),
  ])

  const err =
    species.error || exits.error || movements.error || permits.error || parents.error
  if (err) return { success: false, error: err.message }

  const speciesIdMap = new Map<string, string>()

  if (species.data?.length) {
    const oldIds = species.data.map((s) => s.id)
    const payloads = species.data.map(
      ({ id: _id, created_at: _c, updated_at: _u, lot_id: _l, ...rest }) => ({
        ...rest,
        lot_id: targetLotId,
      })
    )
    const { data: inserted, error } = await supabase
      .from('boscolog_lot_species')
      .insert(payloads)
      .select('id')
    if (error) return { success: false, error: error.message }
    const newIds = (inserted ?? []).map((r) => r.id)
    for (let i = 0; i < oldIds.length && i < newIds.length; i++) {
      speciesIdMap.set(oldIds[i], newIds[i])
    }
  }

  if (exits.data?.length) {
    const { error } = await supabase.from('boscolog_lot_exits').insert(
      exits.data.map(
        ({ id: _id, created_at: _c, updated_at: _u, lot_id: _l, species_id, ...rest }) => ({
          ...rest,
          lot_id: targetLotId,
          species_id: species_id ? speciesIdMap.get(species_id) ?? null : null,
        })
      )
    )
    if (error) return { success: false, error: error.message }
  }

  if (movements.data?.length) {
    const { error } = await supabase.from('boscolog_lot_movements').insert(
      movements.data.map(({ id: _id, created_at: _c, updated_at: _u, lot_id: _l, ...rest }) => ({
        ...rest,
        lot_id: targetLotId,
      }))
    )
    if (error) return { success: false, error: error.message }
  }

  if (permits.data?.length) {
    const { error } = await supabase.from('boscolog_lot_permits').insert(
      permits.data.map(({ id: _id, created_at: _c, updated_at: _u, lot_id: _l, ...rest }) => ({
        ...rest,
        lot_id: targetLotId,
      }))
    )
    if (error) return { success: false, error: error.message }
  }

  const parentIds = (parents.data ?? [])
    .map((p) => p.parent_lot_id)
    .filter((id) => id !== targetLotId)
  if (parentIds.length) {
    const { data: valid } = await supabase
      .from('boscolog_lots')
      .select('id')
      .eq('company_id', companyId)
      .in('id', parentIds)
    const validIds = (valid ?? []).map((v) => v.id)
    if (validIds.length) {
      const { error } = await supabase.from('boscolog_lot_parents').insert(
        validIds.map((parent_lot_id) => ({ lot_id: targetLotId, parent_lot_id }))
      )
      if (error) return { success: false, error: error.message }
    }
  }

  return { success: true }
}
