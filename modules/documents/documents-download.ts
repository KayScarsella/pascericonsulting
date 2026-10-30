import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

/** TTL signed URL: prefetch cartella + download singolo (evita re-fetch ogni 60s). */
export const DOCUMENT_SIGNED_URL_TTL_SEC = 300

export function assertStoragePathForTool(storagePath: string, toolId: string): void {
  const prefix = `${toolId}/`
  if (!storagePath.startsWith(prefix)) {
    throw new Error("Percorso storage non valido per questo tool")
  }
}

type SignedUrlRow = { path?: string; signedUrl?: string; error?: string | null }

/**
 * Firma più path in una sola chiamata Storage (fallback: parallel createSignedUrl).
 * I path devono essere sotto `{toolId}/`.
 */
export async function createDocumentSignedUrls(
  supabase: SupabaseClient<Database>,
  toolId: string,
  storagePaths: string[]
): Promise<Record<string, string>> {
  const validPaths = storagePaths.filter((p) => {
    try {
      assertStoragePathForTool(p, toolId)
      return true
    } catch {
      return false
    }
  })
  if (validPaths.length === 0) return {}

  const bucket = supabase.storage.from("documents")

  const batch = await bucket.createSignedUrls(validPaths, DOCUMENT_SIGNED_URL_TTL_SEC, {
    download: true,
  })

  if (!batch.error && batch.data?.length) {
    const map: Record<string, string> = {}
    for (const row of batch.data as SignedUrlRow[]) {
      if (row.path && row.signedUrl && !row.error) {
        map[row.path] = row.signedUrl
      }
    }
    if (Object.keys(map).length === validPaths.length) return map
  }

  const entries = await Promise.all(
    validPaths.map(async (path) => {
      const { data, error } = await bucket.createSignedUrl(path, DOCUMENT_SIGNED_URL_TTL_SEC, {
        download: true,
      })
      return { path, signedUrl: error ? null : data?.signedUrl ?? null }
    })
  )

  const map: Record<string, string> = {}
  for (const { path, signedUrl } of entries) {
    if (signedUrl) map[path] = signedUrl
  }
  return map
}
