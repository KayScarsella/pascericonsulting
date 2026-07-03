'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  abortFscLogoFileUpload,
  clearFscLogoFile,
  finalizeFscLogoFileUpload,
  getFscLogoFileDownloadUrl,
  prepareFscLogoFileUpload,
} from '@/actions/fsc/logos'
import { Button } from '@/components/ui/button'
import { uploadFscDocumentWithProgress } from '@/lib/fsc/documents-upload-client'
import {
  getFscLogoFileAccept,
  getFscLogoFileKindLabel,
  getFscLogoFileNameFromPath,
  type FscLogoFileKind,
} from '@/lib/fsc/logos'

type FscLogoFileSlotProps = {
  logoId: string
  fileKind: FscLogoFileKind
  storagePath: string | null
  canEdit: boolean
  onUpdated?: () => void
}

export function FscLogoFileSlot({
  logoId,
  fileKind,
  storagePath,
  canEdit,
  onUpdated,
}: FscLogoFileSlotProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const fileName = getFscLogoFileNameFromPath(storagePath)
  const label = getFscLogoFileKindLabel(fileKind)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    const toastId = toast.loading(`Caricamento ${file.name}…`)

    try {
      const prepared = await prepareFscLogoFileUpload({
        logoId,
        fileKind,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      })

      if (!prepared.success || !prepared.storagePath) {
        toast.error(prepared.error ?? 'Preparazione upload fallita', { id: toastId })
        return
      }

      const upload = await uploadFscDocumentWithProgress(prepared.storagePath, file, (pct) => {
        toast.loading(`Caricamento ${file.name}… ${pct}%`, { id: toastId })
      })

      if (upload.error) {
        toast.error(upload.error, { id: toastId })
        if (prepared.storageObjectId) {
          await abortFscLogoFileUpload(logoId, fileKind, prepared.storageObjectId)
        }
        return
      }

      const finalized = await finalizeFscLogoFileUpload(
        logoId,
        fileKind,
        prepared.storageObjectId!,
        {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }
      )
      if (!finalized.success) {
        toast.error(finalized.error ?? 'Finalizzazione fallita', { id: toastId })
        return
      }

      toast.success(`${label} caricato`, { id: toastId })
      onUpdated?.()
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    const result = await getFscLogoFileDownloadUrl(logoId, fileKind)
    if (!result.success || !result.url) {
      toast.error(result.error ?? 'Download non disponibile')
      return
    }
    const link = document.createElement('a')
    link.href = result.url
    link.download = fileName ?? label
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }

  const handleDelete = async () => {
    if (!confirm(`Rimuovere ${label.toLowerCase()}?`)) return
    const result = await clearFscLogoFile(logoId, fileKind)
    if (!result.success) {
      toast.error(result.error ?? 'Rimozione fallita')
      return
    }
    toast.success('File rimosso')
    onUpdated?.()
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={getFscLogoFileAccept(fileKind)}
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium text-slate-800">{label}</h4>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={handleUploadClick}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {storagePath ? 'Sostituisci' : 'Carica'}
          </Button>
        )}
      </div>

      {!storagePath ? (
        <p className="mt-2 text-sm text-slate-500">Nessun file caricato.</p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <span className="truncate text-slate-700">{fileName ?? 'File'}</span>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void handleDownload()}
            >
              <Download className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
