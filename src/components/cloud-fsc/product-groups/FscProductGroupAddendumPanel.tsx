'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteFscProductGroupAddendumFile,
  finalizeFscProductGroupAddendumUpload,
  getFscProductGroupAddendumDownloadUrl,
  prepareFscProductGroupAddendumUpload,
  updateFscProductGroupAddendumMetadata,
} from '@/actions/fsc/product-groups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadFscDocumentWithProgress } from '@/lib/fsc/documents-upload-client'
import type {
  FscProductGroupAddendum,
  FscProductGroupAddendumMetadata,
  FscProductGroupAddendumRow,
} from '@/types/fsc'

type FscProductGroupAddendumPanelProps = {
  companyProductGroupId: string
  addendum: FscProductGroupAddendum
  canEdit: boolean
}

export function FscProductGroupAddendumPanel({
  companyProductGroupId,
  addendum,
  canEdit,
}: FscProductGroupAddendumPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<FscProductGroupAddendumRow[]>(
    addendum.metadata?.rows ?? []
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setRows(addendum.metadata?.rows ?? [])
  }, [addendum.id, addendum.metadata])

  const handleSaveRows = async () => {
    setSaving(true)
    try {
      const metadata: FscProductGroupAddendumMetadata = { rows }
      const result = await updateFscProductGroupAddendumMetadata(addendum.id, metadata)
      if (!result.success) {
        toast.error(result.error ?? 'Salvataggio fallito')
        return
      }
      toast.success('Tabella addendum salvata')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: `Input ${prev.length + 1}`, value: '' },
    ])
  }

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRow = (id: string, field: 'label' | 'value', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    const toastId = toast.loading(`Caricamento ${file.name}…`)

    try {
      const prepared = await prepareFscProductGroupAddendumUpload({
        companyProductGroupId,
        addendumId: addendum.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/pdf',
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
        return
      }

      const finalized = await finalizeFscProductGroupAddendumUpload(addendum.id)
      if (!finalized.success) {
        toast.error(finalized.error ?? 'Finalizzazione fallita', { id: toastId })
        return
      }

      toast.success('PDF addendum caricato', { id: toastId })
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    const result = await getFscProductGroupAddendumDownloadUrl(addendum.id)
    if (!result.success || !result.url) {
      toast.error(result.error ?? 'Download non disponibile')
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  const handleDeleteFile = async () => {
    if (!confirm('Eliminare il PDF addendum?')) return
    const result = await deleteFscProductGroupAddendumFile(addendum.id)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success('PDF eliminato')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 font-medium text-slate-800">Tabella addendum</h4>
        <p className="mb-3 text-sm text-slate-500">
          Compila gli input richiesti per l&apos;addendum di questo gruppo.
        </p>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-slate-500">Nessuna riga. Aggiungine una per iniziare.</p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="flex gap-2">
              <Input
                value={row.label}
                onChange={(e) => updateRow(row.id, 'label', e.target.value)}
                placeholder="Etichetta"
                disabled={!canEdit}
                className="flex-1"
              />
              <Input
                value={row.value}
                onChange={(e) => updateRow(row.id, 'value', e.target.value)}
                placeholder="Valore"
                disabled={!canEdit}
                className="flex-1"
              />
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  className="shrink-0 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />
              Aggiungi riga
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              className="bg-[#967635] hover:bg-[#7d6230]"
              onClick={() => void handleSaveRows()}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salva tabella
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-medium text-slate-800">PDF addendum firmato</h4>
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
              Carica PDF
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf"
          onChange={handleFileChange}
        />

        {addendum.storage_path ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="truncate text-slate-700">Addendum PDF</span>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  onClick={() => void handleDeleteFile()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Nessun PDF caricato.</p>
        )}
      </div>
    </div>
  )
}
