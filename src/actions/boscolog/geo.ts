'use server'

import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import {
  buildFeatureCollectionExport,
  lotHasGeo,
  parseAndNormalizeLotGeojson,
  type BoscologGeoFeatureCollection,
} from '@/lib/boscolog/geojson'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'

function revalidateGeo(lotId: string) {
  revalidatePath('/boscolog')
  revalidatePath('/boscolog/lotti')
  revalidatePath(`/boscolog/lotti/${lotId}`)
  revalidatePath(`/boscolog/lotti/${lotId}/compliance`)
}

export type BoscologLotGeo = {
  geojson: BoscologGeoFeatureCollection | null
  featureCount: number | null
  areaHa: number | null
  hasGeo: boolean
}

export async function getBoscologLotGeo(
  lotId: string
): Promise<{
  success: boolean
  data?: BoscologLotGeo
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
  const { data: lot, error } = await supabase
    .from('boscolog_lots')
    .select('geojson, geo_feature_count, geo_area_ha')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!lot) return { success: false, error: 'Lotto non trovato' }

  const geojson = (lot.geojson as BoscologGeoFeatureCollection | null) ?? null
  return {
    success: true,
    data: {
      geojson,
      featureCount: lot.geo_feature_count,
      areaHa: lot.geo_area_ha != null ? Number(lot.geo_area_ha) : null,
      hasGeo: lotHasGeo(lot),
    },
  }
}

export async function setBoscologLotGeojson(
  lotId: string,
  rawJson: string
): Promise<{
  success: boolean
  error?: string
  warning?: string
  data?: BoscologLotGeo
}> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const parsed = parseAndNormalizeLotGeojson(rawJson)
  if (!parsed.ok) return { success: false, error: parsed.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('boscolog_lots')
    .update({
      geojson: parsed.featureCollection as unknown as Record<string, unknown>,
      geo_feature_count: parsed.featureCount,
      geo_area_ha: parsed.areaHa,
    })
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .select('geojson, geo_feature_count, geo_area_ha')
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Lotto non trovato' }

  revalidateGeo(lotId)
  return {
    success: true,
    warning: parsed.warning,
    data: {
      geojson: data.geojson as BoscologGeoFeatureCollection,
      featureCount: data.geo_feature_count,
      areaHa: data.geo_area_ha != null ? Number(data.geo_area_ha) : null,
      hasGeo: true,
    },
  }
}

export async function clearBoscologLotGeojson(
  lotId: string
): Promise<{ success: boolean; error?: string }> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }
  if (!ctx.canEdit) return { success: false, error: 'Non autorizzato' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('boscolog_lots')
    .update({
      geojson: null,
      geo_feature_count: null,
      geo_area_ha: null,
    })
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)

  if (error) return { success: false, error: error.message }

  revalidateGeo(lotId)
  return { success: true }
}

export async function exportBoscologLotGeojson(
  lotId: string
): Promise<{
  success: boolean
  filename?: string
  geojson?: string
  error?: string
}> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }

  const supabase = await createClient()
  const { data: lot, error } = await supabase
    .from('boscolog_lots')
    .select('id, name, geojson')
    .eq('id', lotId)
    .eq('company_id', ctx.company.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!lot) return { success: false, error: 'Lotto non trovato' }
  if (!lotHasGeo(lot) || !lot.geojson) {
    return { success: false, error: 'Nessun geodato sul lotto' }
  }

  const safeName = (lot.name || 'lotto').replace(/[^\w\-]+/g, '_').slice(0, 60)
  return {
    success: true,
    filename: `${safeName}.geojson`,
    geojson: JSON.stringify(lot.geojson, null, 2),
  }
}

export async function exportBoscologCompanyGeojson(opts?: {
  year?: number
}): Promise<{
  success: boolean
  filename?: string
  geojson?: string
  featureCount?: number
  error?: string
}> {
  await getToolAccess(BOSCOLOG_TOOL_ID)
  const ctx = await getBoscologCompanyContext()
  if (!ctx.success) return { success: false, error: ctx.error }
  if (ctx.needsSetup || !ctx.company) return { success: false, error: 'needs_setup' }

  const supabase = await createClient()
  let query = supabase
    .from('boscolog_lots')
    .select('id, name, geojson, lot_date')
    .eq('company_id', ctx.company.id)
    .not('geojson', 'is', null)

  if (opts?.year != null && Number.isFinite(opts.year)) {
    const y = Math.trunc(opts.year)
    query = query
      .gte('lot_date', `${y}-01-01`)
      .lte('lot_date', `${y}-12-31`)
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  const lots = (data ?? []).filter((l) => lotHasGeo(l))
  const fc = buildFeatureCollectionExport(lots)
  const yearSuffix = opts?.year != null ? `_${Math.trunc(opts.year)}` : ''
  return {
    success: true,
    filename: `boscolog_lotti${yearSuffix}.geojson`,
    geojson: JSON.stringify(fc, null, 2),
    featureCount: fc.features.length,
  }
}
