/**
 * Single JSON for storage + PDF without any GEE call later.
 * Includes histogram/colors + every text block shown on the site (EmbeddedDueDiligenceBlock).
 */

import type { RunMetadata } from '../types/due-diligence-run'
import type { DdLastRunSnapshot } from '../aoiRiskGate'
import { buildDdReplicatePayload } from './ddReplicatePayload'

export const DD_REPORT_VERSION = 2

export type DdReportPayload = Omit<ReturnType<typeof buildDdReplicatePayload>, 'v'> & {
  v: typeof DD_REPORT_VERSION
  /** Path in bucket for map PNG after client upload (same folder) */
  snapshot_storage_filename: string
  has_snapshot: boolean
  /** Ordered blocks to print in PDF — same info as website */
  ui_blocks: { heading?: string; body: string }[]
  methodology_bullets: string[]
  gate_triggers_non_accettabile: boolean
  gate_reasons: string[]
  advisory_notes: string[]
}

const METHODOLOGY_BULLETS = [
  'Hansen GFC (UMD/GLAD, Landsat ~30 m) mappa stand-replacement loss con un anno per pixel; ultimo anno disponibile nel catalogo EE attuale è il 2024 (v1.12).',
  'Il fornitore indica che il dataset non è provato per analisi areali rigorose EUDR; va usato come screening insieme ad altre evidenze.',
  'Rigorosità EUDR: nessun automatismo è al 100%; JRC GFC2020 è fonte non obbligatoria ma allineata al cut-off; logica raffinata (foresta 2020 + loss successiva + soglia ha) riduce falsi positivi.',
  'Data di taglio vs anno Hansen: se il taglio è a fine anno e la loss cade nello stesso anno, Hansen non distingue mese — usare compositi Sentinel-2 per anno o verifica manuale. Rosso = dall’anno di taglio in poi (≥); blu = solo anni precedenti.',
  'JRC GFC2020 V3 (10 m) per foresta al 31/12/2020 e gate raffinato con soglia 0,5 ha dove possibile.',
  'Per frequenza maggiore (es. Sentinel-2 ogni ~5 giorni) servono time-series dedicate oltre questo screening.',
]

export function buildDdReportPayload(
  meta: RunMetadata,
  ddSnapshot: DdLastRunSnapshot,
  dualClassMode: boolean,
  snapshot?: { hasSnapshot: boolean }
): DdReportPayload {
  const base = buildDdReplicatePayload({
    runId: meta.run_id,
    sessionId: meta.session_id,
    userId: meta.user_id,
    cuttingDateIso: meta.cutting_date_iso || '',
    dualClassMode,
    histogram: meta.lossyear_histogram || {},
    aoiAreaHa: meta.aoi_area_ha,
    lossPixelCount: meta.loss_pixel_count,
    datasetId: meta.dataset_id,
  })

  const ui_blocks: { heading?: string; body: string }[] = []
  const cuttingYear =
    meta.cutting_date_iso && /^\d{4}/.test(meta.cutting_date_iso)
      ? parseInt(meta.cutting_date_iso.slice(0, 4), 10)
      : null
  const hasLossFromCutYearOnward =
    cuttingYear != null &&
    Object.entries(meta.lossyear_histogram || {}).some(([key, count]) => {
      const band = Number(key)
      const calendarYear = band >= 1 && band <= 99 ? 2000 + band : band
      return calendarYear >= cuttingYear && Number(count) > 0
    })

  if (cuttingYear != null) {
    ui_blocks.push({
      heading: 'Messaggio sintetico',
      body: hasLossFromCutYearOnward
        ? "LE COORDINATE INSERITE EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO (VEDI GRAFICO IN ROSSO)."
        : "LE COORDINATE INSERITE NON EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO.",
    })
  }

  // Badge / logica
  const r = meta.eudr_refined
  if (r) {
    if (r.jrc_assessment_ok && r.loss_on_forest_2020_post_eudr_ha != null && r.loss_on_forest_2020_post_eudr_ha >= 0.5) {
      ui_blocks.push({
        heading: 'Logica screening',
        body: 'Logica raffinata (JRC foresta 2020 ∩ Hansen, ≥0,5 ha).',
      })
    } else if (r.jrc_assessment_ok) {
      ui_blocks.push({
        heading: 'Logica screening',
        body: 'Logica raffinata disponibile — sotto soglia ha → gate su base Hansen se applicabile.',
      })
    } else {
      ui_blocks.push({
        heading: 'Logica screening',
        body: 'Logica base (solo Hansen; JRC non disponibile o errore).',
      })
    }
  }

  ui_blocks.push({
    heading: 'Risultato numerico',
    body: `Pixel Hansen con loss (tutti gli anni) ≈ ${meta.loss_pixel_count ?? '—'} · AOI ≈ ${meta.aoi_area_ha?.toFixed(2) ?? '—'} ha · Dataset: ${meta.dataset_id}`,
  })

  if (r?.jrc_assessment_ok && r.forest_2020_ha_in_aoi != null) {
    const pct =
      r.forest_2020_pct_aoi != null ? `${r.forest_2020_pct_aoi.toFixed(1)}% dell'AOI` : '—'
    const lossHa = r.loss_on_forest_2020_post_eudr_ha != null ? `${r.loss_on_forest_2020_post_eudr_ha.toFixed(2)} ha` : '0 ha'
    const soglia =
      r.loss_on_forest_2020_post_eudr_ha != null && r.loss_on_forest_2020_post_eudr_ha >= 0.5
        ? 'sopra soglia 0,5 ha → evidenza EUDR-raffinata.'
        : 'sotto soglia 0,5 ha o assente → gate non attivato solo su questa evidenza.'
    ui_blocks.push({
      heading: 'JRC GFC2020 (foresta al 31/12/2020)',
      body: `Nell'AOI ≈ ${r.forest_2020_ha_in_aoi.toFixed(2)} ha (${pct}). Loss Hansen dopo il 2020 su quella foresta ≈ ${lossHa} — ${soglia}`,
    })
  }

  const ft = meta.forest_types_2020
  if (ft?.ok && ft.ha_forest_typed_total != null && ft.ha_forest_typed_total > 0) {
    ui_blocks.push({
      heading: 'Contesto degrado forestale (snapshot 31/12/2020)',
      body: `JRC forest types nell'AOI: primaria ≈ ${ft.ha_primary?.toFixed(2) ?? '—'} ha, naturalmente rigenerante ≈ ${ft.ha_naturally_regenerating?.toFixed(2) ?? '—'} ha, piantata ≈ ${ft.ha_planted?.toFixed(2) ?? '—'} ha. Solo fotografia al cut-off, non evoluzione temporale automatica.`,
    })
  } else if (ft && !ft.ok) {
    ui_blocks.push({
      body: `Tipi foresta JRC non disponibili: ${ft.error ?? '—'}`,
    })
  }

  if (r && !r.jrc_assessment_ok) {
    ui_blocks.push({
      body: `Intersect JRC GFC2020 non disponibile: ${r.jrc_assessment_error ?? 'errore EE'}. Screening fallback su Hansen-only.`,
    })
  }

  const { v: _omitV, ...baseRest } = base
  void _omitV
  return {
    ...baseRest,
    v: DD_REPORT_VERSION,
    snapshot_storage_filename: 'aoi_map_render.png',
    has_snapshot: snapshot?.hasSnapshot ?? false,
    ui_blocks,
    methodology_bullets: METHODOLOGY_BULLETS,
    gate_triggers_non_accettabile: ddSnapshot.triggers_non_accettabile,
    gate_reasons: ddSnapshot.reasons || [],
    advisory_notes: ddSnapshot.advisory_notes || [],
  }
}
