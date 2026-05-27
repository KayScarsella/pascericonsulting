import { createClient } from '@/utils/supabase/client'

const USER_UPLOADS_BUCKET = 'user-uploads'
export const USER_UPLOADS_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function getStorageObjectUrl(bucket: string, storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/storage/v1/object/${bucket}/${encodedPath}`
}

export async function uploadToUserUploadsBucket(params: {
  storagePath: string
  file: File
  upsert?: boolean
  onProgress?: (percent: number) => void
}): Promise<{ error?: string }> {
  const { storagePath, file, upsert = true, onProgress } = params

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return { error: "Sessione scaduta. Effettua di nuovo l'accesso." }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    return { error: 'Configurazione Supabase mancante' }
  }

  return await new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', getStorageObjectUrl(USER_UPLOADS_BUCKET, storagePath))
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', upsert ? 'true' : 'false')

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve({})
        return
      }

      let message = 'Upload fallito'
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        message = body.message ?? body.error ?? message
      } catch {
        if (xhr.responseText) message = xhr.responseText
      }
      resolve({ error: message })
    }

    xhr.onerror = () => resolve({ error: "Errore di rete durante l'upload" })
    xhr.onabort = () => resolve({ error: 'Upload annullato' })
    xhr.send(file)
  })
}

export function buildEudrDueDiligenceAoiUploadPath(params: {
  userId: string
  sessionId: string
  fileName: string
}): string {
  const { userId, sessionId, fileName } = params
  const safeName = (fileName || 'aoi.geojson').replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${userId}/eudr-due-diligence/${sessionId}/aoi-uploaded-${Date.now()}_${safeName}`
}

