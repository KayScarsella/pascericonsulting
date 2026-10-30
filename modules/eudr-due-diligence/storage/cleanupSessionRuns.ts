/**
 * Removes all due-diligence AOI artifacts for a session under user-uploads
 * (flat files + legacy UUID subfolders). Called before each new analysis.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'user-uploads'

/** Cartelle run legacy = UUID */
function looksLikeRunFolder(name: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    name
  )
}

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
    const runPrefix = `${base}/${entry.name}`
    const { data: files } = await supabase.storage.from(BUCKET).list(runPrefix, { limit: 200 })
    if (files?.length) {
      for (const f of files) {
        pathsToRemove.push(`${runPrefix}/${f.name}`)
      }
    } else if (!looksLikeRunFolder(entry.name)) {
      pathsToRemove.push(runPrefix)
    }
  }

  if (pathsToRemove.length > 0) {
    const chunk = 50
    for (let i = 0; i < pathsToRemove.length; i += chunk) {
      const slice = pathsToRemove.slice(i, i + chunk)
      await supabase.storage.from(BUCKET).remove(slice)
    }
  }
}
