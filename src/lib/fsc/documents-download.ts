import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const FSC_DOCUMENT_SIGNED_URL_TTL_SEC = 3600

const FSC_DOCUMENTS_BUCKET = 'fsc-documents'

type SignedUrlRow = { path?: string; signedUrl?: string; error?: string }

/**
 * Firma più path nel bucket fsc-documents (fallback: parallel createSignedUrl).
 */
export async function createFscDocumentSignedUrls(
  supabase: SupabaseClient<Database>,
  storagePaths: string[]
): Promise<Record<string, string>> {
  const validPaths = storagePaths.filter(Boolean)
  if (validPaths.length === 0) return {}

  const bucket = supabase.storage.from(FSC_DOCUMENTS_BUCKET)

  const batch = await bucket.createSignedUrls(validPaths, FSC_DOCUMENT_SIGNED_URL_TTL_SEC, {
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
      const { data, error } = await bucket.createSignedUrl(path, FSC_DOCUMENT_SIGNED_URL_TTL_SEC, {
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
