/**
 * Recover AOI screening snapshot from dd_report.json when metadata.dd_last_run is missing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/supabase'
import {
  hasLossAfterCalendarYear,
  hasLossFromCalendarYearInclusive,
  type DdLastRunSnapshot,
} from '../aoiRiskGate'
import type { LossYearHistogram } from '../types/due-diligence-run'
import { ddReportJsonSessionPath, ddRunBasePath } from './paths'

const EUDR_CUTOFF_DATE = '2020-12-31'

/** Fields persisted in dd_report.json (replicate + gate + optional embedded snapshot). */
type StoredDdReport = {
  run_id?: string
  session_id?: string
  user_id?: string
  cutting_date_iso?: string
  loss_pixel_count?: number
  lossyear_histogram?: LossYearHistogram
  dataset_id?: string
  gate_triggers_non_accettabile?: boolean
  gate_reasons?: string[]
  advisory_notes?: string[]
  dd_last_run?: DdLastRunSnapshot
  completed_at?: string
}

function inferLogicMode(reasons: string[]): 'raffinata' | 'base' {
  const joined = reasons.join(' ').toLowerCase()
  if (joined.includes('jrc') || joined.includes('raffinata') || joined.includes('foresta al 2020')) {
    return 'raffinata'
  }
  return 'base'
}

function snapshotFromStoredReport(report: StoredDdReport, artifactSessionId: string): DdLastRunSnapshot | null {
  if (report.dd_last_run?.run_id) {
    return {
      ...report.dd_last_run,
      dd_artifact_session_id: report.dd_last_run.dd_artifact_session_id ?? artifactSessionId,
    }
  }

  const runId = report.run_id?.trim()
  const cuttingDateIso = report.cutting_date_iso?.trim()
  if (!runId || !cuttingDateIso || !/^\d{4}-\d{2}-\d{2}$/.test(cuttingDateIso)) return null
  if (typeof report.gate_triggers_non_accettabile !== 'boolean') return null

  const histogram = report.lossyear_histogram
  const cuttingYear = parseInt(cuttingDateIso.slice(0, 4), 10)
  const minGateYear = Number.isFinite(cuttingYear)
    ? Math.max(2021, cuttingYear)
    : null

  const has_loss_after_eudr_cutoff = hasLossAfterCalendarYear(histogram, 2020)
  const has_loss_after_cutting_date =
    minGateYear != null
      ? hasLossFromCalendarYearInclusive(histogram, minGateYear)
      : has_loss_after_eudr_cutoff

  const reasons = report.gate_reasons ?? []
  const gateUsesJrc = inferLogicMode(reasons) === 'raffinata' && report.gate_triggers_non_accettabile

  return {
    run_id: runId,
    dd_artifact_session_id: report.session_id?.trim() || artifactSessionId,
    completed_at: report.completed_at || new Date().toISOString(),
    dataset_id: report.dataset_id || 'UMD/hansen/global_forest_change_2024_v1_12',
    eudr_cutoff_date: EUDR_CUTOFF_DATE,
    cutting_date_iso: cuttingDateIso,
    loss_pixel_count: report.loss_pixel_count,
    has_loss_after_eudr_cutoff,
    has_loss_after_cutting_date,
    triggers_non_accettabile: report.gate_triggers_non_accettabile,
    reasons,
    ...(gateUsesJrc ? { gate_uses_jrc_gfc2020: true } : {}),
    logic_mode: inferLogicMode(reasons),
    ...(report.advisory_notes?.length ? { advisory_notes: report.advisory_notes } : {}),
  }
}

async function downloadDdReport(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  runId?: string
): Promise<StoredDdReport | null> {
  const candidates = [ddReportJsonSessionPath(userId, sessionId)]
  if (runId) {
    candidates.push(`${ddRunBasePath(userId, sessionId, runId)}/dd_report.json`)
  }

  for (const path of candidates) {
    const { data, error } = await supabase.storage.from('user-uploads').download(path)
    if (error || !data) continue
    try {
      return JSON.parse(await data.text()) as StoredDdReport
    } catch {
      continue
    }
  }
  return null
}

/** Load dd_last_run from storage dd_report.json when session metadata has no snapshot. */
export async function loadDdLastRunFromStorage(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  runId?: string
): Promise<DdLastRunSnapshot | null> {
  const report = await downloadDdReport(supabase, userId, sessionId, runId)
  if (!report) return null
  return snapshotFromStoredReport(report, sessionId)
}

/** Prefer metadata; fall back to storage artifact. */
export async function resolveDdLastRun(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  metadataDdLastRun?: DdLastRunSnapshot | null
): Promise<DdLastRunSnapshot | undefined> {
  if (metadataDdLastRun?.run_id) return metadataDdLastRun
  const fromStorage = await loadDdLastRunFromStorage(supabase, userId, sessionId)
  return fromStorage ?? undefined
}

/** Backfill metadata.dd_last_run after recovery from storage (idempotent). */
export async function persistDdLastRunBackfill(
  supabase: SupabaseClient,
  sessionId: string,
  ddLastRun: DdLastRunSnapshot,
  existingMetadata: Record<string, unknown> | null
): Promise<{ ok: boolean; error?: string }> {
  const nextMeta: Record<string, unknown> = {
    ...(existingMetadata || {}),
    dd_last_run: ddLastRun,
    ...(ddLastRun.triggers_non_accettabile
      ? { aoi_gate_triggered: true, aoi_gate_reasons: ddLastRun.reasons }
      : { aoi_gate_triggered: false, aoi_gate_reasons: [] }),
  }

  const { error } = await supabase
    .from('assessment_sessions')
    .update({ metadata: nextMeta as Json })
    .eq('id', sessionId)

  if (error) {
    console.error('[DD_LAST_RUN_BACKFILL_FAILED]', { sessionId, message: error.message })
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
