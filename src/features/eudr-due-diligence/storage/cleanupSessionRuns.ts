/**
 * Removes all due-diligence run artifacts for a session under user-uploads
 * so only one run exists per session (new run replaces previous storage).
 *
 * Path layout: .../aoi.geojson | dd_report.json | aoi_map_snapshot.png
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'user-uploads'

export async function removePreviousDueDiligenceRuns(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<void> {
  const base = `${userId}/eudr-due-diligence/${sessionId}`
  const { data: entries, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(base, { limit: 500 })

  if (listError || !entries?.length) return

  const pathsToRemove: string[] = []
  for (const entry of entries) {
    // Subfolder per runId — list files inside
    const runPrefix = `${base}/${entry.name}`
    const { data: files } = await supabase.storage.from(BUCKET).list(runPrefix, { limit: 100 })
    if (files?.length) {
      for (const f of files) {
        pathsToRemove.push(`${runPrefix}/${f.name}`)
      }
    }
  }

  if (pathsToRemove.length > 0) {
    // remove in chunks to avoid oversized requests
    const chunk = 50
    for (let i = 0; i < pathsToRemove.length; i += chunk) {
      const slice = pathsToRemove.slice(i, i + chunk)
      await supabase.storage.from(BUCKET).remove(slice)
    }
  }
}
