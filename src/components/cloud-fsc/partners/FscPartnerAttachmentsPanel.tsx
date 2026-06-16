'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteFscPartnerAttachment,
  finalizeFscPartnerAttachmentUpload,
  getFscPartnerAttachmentDownloadUrl,
  prepareFscPartnerAttachmentUpload,
} from '@/actions/fsc/partner-attachments'
import { Button } from '@/components/ui/button'
import { uploadFscDocumentWithProgress } from '@/lib/fsc/documents-upload-client'
import type { FscPartnerEntity } from '@/lib/fsc/partners'

type AttachmentRow = {
  id: string
  attachment_type: string
  file_name: string | null
  created_at: string
}

type AttachmentTypeOption = {
  value: string
  label: string
}

type FscPartnerAttachmentsPanelProps = {
  entity: FscPartnerEntity
  entityId: string
  attachments: AttachmentRow[]
  attachmentTypes: readonly AttachmentTypeOption[]
  canEdit: boolean
}

export function FscPartnerAttachmentsPanel({
  entity,
  entityId,
  attachments,
  attachmentTypes,
  canEdit,
}: FscPartnerAttachmentsPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [pendingType, setPendingType] = useState<string | null>(null)

  const handleUploadClick = (type: string) => {
    setPendingType(type)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const type = pendingType
    e.target.value = ''
    setPendingType(null)
    if (!file || !type) return

    setUploadingType(type)
    const toastId = toast.loading(`Caricamento ${file.name}…`)

    try {
      const prepared = await prepareFscPartnerAttachmentUpload({
        entity,
        entityId,
        attachmentType: type,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      })

      if (!prepared.success || !prepared.storagePath || !prepared.attachmentId) {
        toast.error(prepared.error ?? 'Preparazione upload fallita', { id: toastId })
        return
      }

      const upload = await uploadFscDocumentWithProgress(prepared.storagePath, file, (pct) => {
        toast.loading(`Caricamento ${file.name}… ${pct}%`, { id: toastId })
      })

      if (upload.error) {
        toast.error(upload.error, { id: toastId })
        return
      }

      const finalized = await finalizeFscPartnerAttachmentUpload(entity, prepared.attachmentId)
      if (!finalized.success) {
        toast.error(finalized.error ?? 'Finalizzazione fallita', { id: toastId })
        return
      }

      toast.success('Allegato caricato', { id: toastId })
      router.refresh()
    } finally {
      setUploadingType(null)
    }
  }

  const handleDownload = async (attachmentId: string, fileName: string | null) => {
    const result = await getFscPartnerAttachmentDownloadUrl(entity, attachmentId)
    if (!result.success || !result.url) {
      toast.error(result.error ?? 'Download non disponibile')
      return
    }
    const link = document.createElement('a')
    link.href = result.url
    link.download = fileName ?? 'allegato'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Eliminare questo allegato?')) return
    const result = await deleteFscPartnerAttachment(entity, attachmentId)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success('Allegato eliminato')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
      />

      {attachmentTypes.map((typeDef) => {
        const typeAttachments = attachments.filter((a) => a.attachment_type === typeDef.value)
        return (
          <div
            key={typeDef.value}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-slate-800">{typeDef.label}</h4>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingType !== null}
                  onClick={() => handleUploadClick(typeDef.value)}
                >
                  {uploadingType === typeDef.value ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Carica
                </Button>
              )}
            </div>

            {typeAttachments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nessun file caricato.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {typeAttachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="truncate text-slate-700">
                      {att.file_name ?? 'File'}
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(att.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownload(att.id, att.file_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(att.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
