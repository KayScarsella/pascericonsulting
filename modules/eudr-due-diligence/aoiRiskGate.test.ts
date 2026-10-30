import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignReportGateWithSnapshot,
  applyTendenzaRuleToSnapshot,
  buildDdLastRunSnapshot,
  snapshotNeedsTendenzaUpgrade,
  type DdLastRunSnapshot,
} from '@/features/eudr-due-diligence/aoiRiskGate'
import type { RunMetadata } from '@/features/eudr-due-diligence/types/due-diligence-run'

function oldSnapshot(overrides: Partial<DdLastRunSnapshot> = {}): DdLastRunSnapshot {
  return {
    run_id: 'run-abete',
    completed_at: '2026-10-15T07:20:11.000Z',
    dataset_id: 'UMD/hansen/global_forest_change_2024_v1_12',
    eudr_cutoff_date: '2020-12-31',
    cutting_date_iso: '2026-01-01',
    loss_pixel_count: 17.247,
    has_loss_after_eudr_cutoff: true,
    has_loss_after_cutting_date: false,
    triggers_non_accettabile: false,
    reasons: [],
    loss_on_forest_2020_post_eudr_ha: 0.38,
    logic_mode: 'base',
    ...overrides,
  }
}

function runMeta(histogram: Record<string, number>, cuttingDateIso: string): RunMetadata {
  return {
    run_id: 'run-1',
    session_id: 'session-1',
    user_id: 'user-1',
    status: 'completed',
    created_at: '2026-10-15T07:20:11.000Z',
    dataset_id: 'UMD/hansen/global_forest_change_2024_v1_12',
    eudr_cutoff_date: '2020-12-31',
    pixel_area_m2: 900,
    loss_pixel_count: 17.247,
    lossyear_histogram: histogram,
    cutting_date_iso: cuttingDateIso,
    artifact_paths: { aoi_geojson: 'aoi.geojson', metadata_json: 'meta.json' },
    eudr_refined: {
      jrc_gfc2020_dataset_id: 'JRC/GFC2020/V3',
      forest_2020_ha_in_aoi: 13.08,
      forest_2020_pct_aoi: 95.4,
      loss_on_forest_2020_post_eudr_ha: 0.38,
      loss_pixel_count_on_forest_2020_post_eudr: 4,
      jrc_assessment_ok: true,
      lossyear_histogram_on_forest_2020: histogram,
    },
  }
}

test('taglio 2026 e loss nel 2024 sotto 0,5 ha accende il gate tendenza', () => {
  const upgraded = applyTendenzaRuleToSnapshot(oldSnapshot(), { '24': 17.247 })
  assert.equal(upgraded.loss_on_forest_2020_post_eudr_ha, 0.38)
  assert.equal(upgraded.triggers_non_accettabile, true)
  assert.equal(upgraded.tendenza_deforestazione, true)
  assert.equal(upgraded.tendenza_rule_applied, true)
  assert.match(upgraded.reasons[0] ?? '', /2024/)
  assert.match(upgraded.reasons[0] ?? '', /2026/)

  const built = buildDdLastRunSnapshot(runMeta({ '24': 17.247 }, '2026-01-01'))
  assert.equal(built.triggers_non_accettabile, true)
  assert.equal(built.tendenza_deforestazione, true)
  assert.equal(built.tendenza_rule_applied, true)
  assert.equal(built.loss_on_forest_2020_post_eudr_ha, 0.38)
})

test('taglio 2026 senza loss nel 2024 lascia il gate spento e marca la regola', () => {
  const upgraded = applyTendenzaRuleToSnapshot(oldSnapshot(), { '22': 5 })
  assert.equal(upgraded.triggers_non_accettabile, false)
  assert.equal(upgraded.tendenza_deforestazione, undefined)
  assert.equal(upgraded.tendenza_rule_applied, true)

  const built = buildDdLastRunSnapshot(runMeta({ '22': 5 }, '2026-01-01'))
  assert.equal(built.triggers_non_accettabile, false)
  assert.equal(built.tendenza_deforestazione, undefined)
  assert.equal(built.tendenza_rule_applied, true)
})

test('snapshot con regola già applicata non viene ricalcolato', () => {
  const marked = oldSnapshot({ tendenza_rule_applied: true, triggers_non_accettabile: false })
  const result = applyTendenzaRuleToSnapshot(marked, { '24': 17.247 })
  assert.equal(result, marked)
  assert.equal(result.triggers_non_accettabile, false)
  assert.equal(snapshotNeedsTendenzaUpgrade(marked), false)
  assert.equal(snapshotNeedsTendenzaUpgrade(oldSnapshot()), true)
})

test('il report PDF sostituisce il messaggio di assenza deforestazione', () => {
  const snapshot = applyTendenzaRuleToSnapshot(oldSnapshot(), { '24': 4 })
  const aligned = alignReportGateWithSnapshot(
    {
      gate_triggers_non_accettabile: false,
      gate_reasons: [] as string[],
      ui_blocks: [
        {
          heading: 'Messaggio sintetico',
          body: "Le coordinate inserite non evidenziano la presenza di deforestazione per l'anno di taglio.",
        },
      ],
    },
    snapshot
  )
  assert.equal(aligned.gate_triggers_non_accettabile, true)
  assert.equal(aligned.ui_blocks?.[0]?.heading, 'Tendenza deforestazione')
  assert.match(aligned.ui_blocks?.[0]?.body ?? '', /2026/)
  assert.equal(aligned.gate_reasons?.[0], snapshot.reasons[0])
})
