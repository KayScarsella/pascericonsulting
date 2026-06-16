'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getFscModuleCategoryLabel,
  type FscDocumentModuleSlug,
} from '@/lib/fsc/constants'
import { uploadFscDocumentWithProgress } from '@/lib/fsc/documents-upload-client'
import { validateFscDocumentFileMetadata } from '@/lib/fsc/documents-upload'
import type { FscDocument } from '@/types/fsc'
import { getFscDocumentActions } from './fsc-document-actions'

export type FscDocumentFormMode = 'create' | 'edit' | 'newVersion'

type FscDocumentFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: FscDocumentFormMode
  module: FscDocumentModuleSlug
  category: string
  document?: FscDocument | null
}

export function FscDocumentFormDialog({
  open,
  onOpenChange,
  mode,
  module,
  category,
  document,
}: FscDocumentFormDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [reviewedAt, setReviewedAt] = useState('')
  const [referenceYear, setReferenceYear] = useState(String(new Date().getFullYear()))
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const actions = useMemo(() => getFscDocumentActions(module), [module])
  const isEnte = module === 'ente'
  const categoryLabel = getFscModuleCategoryLabel(module, category)

  useEffect(() => {
    if (!open) return

    if ((mode === 'edit' || mode === 'newVersion') && document) {
      setName(document.name)
      setExpiresAt(document.expires_at ?? '')
      setReviewedAt(document.reviewed_at ?? '')
      setReferenceYear(
        document.reference_year != null
          ? String(document.reference_year)
          : String(new Date().getFullYear())
      )
      setFile(null)
    } else {
      setName('')
      setExpiresAt('')
      setReviewedAt('')
      setReferenceYear(String(new Date().getFullYear()))
      setFile(null)
    }
    setUploadProgress(0)
  }, [open, mode, document])

  const requiresFile = mode === 'create' || mode === 'newVersion'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (requiresFile && !file) {
      toast.error('Seleziona un file da caricare')
      return
    }

    const parsedYear = isEnte ? Number.parseInt(referenceYear, 10) : null
    if (isEnte && mode !== 'newVersion' && (parsedYear === null || Number.isNaN(parsedYear))) {
      toast.error('Inserisci un anno di riferimento valido')
      return
    }

    if (requiresFile && file) {
      const clientError = validateFscDocumentFileMetadata({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
      if (clientError) {
        toast.error(clientError)
        return
      }
    }

    setIsSubmitting(true)
    const toastId = toast.loading(
      mode === 'edit' ? 'Salvataggio metadati…' : 'Caricamento documento…'
    )

    try {
      if (mode === 'edit' && document) {
        const result = await actions.updateMetadata(document.id, {
          name,
          expires_at: expiresAt || null,
          ...(isEnte
            ? { reference_year: parsedYear }
            : { reviewed_at: reviewedAt || null }),
        })
        if (!result.success) {
          toast.error(result.error ?? 'Errore salvataggio', { id: toastId })
          return
        }
        toast.success('Documento aggiornato', { id: toastId })
        onOpenChange(false)
        router.refresh()
        return
      }

      if (!file) return

      let prepared: {
        success: boolean
        documentId?: string
        storagePath?: string
        error?: string
      }

      if (mode === 'newVersion' && document) {
        prepared = await actions.prepareNewVersion(document.id, {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })
      } else {
        prepared = await actions.prepareUpload({
          category,
          name,
          expires_at: expiresAt || null,
          ...(isEnte
            ? { reference_year: parsedYear }
            : { reviewed_at: reviewedAt || null }),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })
      }

      if (!prepared.success || !prepared.documentId || !prepared.storagePath) {
        toast.error(prepared.error ?? 'Preparazione upload fallita', { id: toastId })
        return
      }

      toast.loading(`Caricamento ${file.name}… 0%`, { id: toastId })
      const uploadResult = await uploadFscDocumentWithProgress(
        prepared.storagePath,
        file,
        (percent) => {
          setUploadProgress(percent)
          toast.loading(`Caricamento ${file.name}… ${percent}%`, { id: toastId })
        }
      )

      if (uploadResult.error) {
        await actions.abortUpload(prepared.documentId)
        toast.error(uploadResult.error, { id: toastId })
        return
      }

      toast.loading('Registrazione documento…', { id: toastId })
      const finalized = await actions.finalizeUpload(prepared.documentId, {
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      })

      if (!finalized.success) {
        toast.error(finalized.error ?? 'Errore registrazione', { id: toastId })
        return
      }

      toast.success(
        mode === 'newVersion' ? 'Nuova versione caricata' : 'Documento caricato',
        { id: toastId }
      )
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Errore imprevisto', { id: toastId })
    } finally {
      setIsSubmitting(false)
      setUploadProgress(0)
    }
  }

  const title =
    mode === 'create'
      ? 'Nuovo documento'
      : mode === 'edit'
        ? 'Modifica documento'
        : 'Nuova versione'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Categoria: <span className="font-medium text-slate-700">{categoryLabel}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fsc-doc-name">Nome documento</Label>
              <Input
                id="fsc-doc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isEnte ? 'Es. Visura 2026, Certificato CoC…' : 'Es. Uso logo, Due diligence…'
                }
                required
                disabled={mode === 'newVersion'}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {isEnte && (
                <div className="space-y-2">
                  <Label htmlFor="fsc-doc-year">Anno di riferimento</Label>
                  <Input
                    id="fsc-doc-year"
                    type="number"
                    min={2000}
                    max={new Date().getFullYear() + 1}
                    value={referenceYear}
                    onChange={(e) => setReferenceYear(e.target.value)}
                    required
                    disabled={mode === 'newVersion'}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="fsc-doc-expires">Data scadenza</Label>
                <Input
                  id="fsc-doc-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={mode === 'newVersion'}
                />
              </div>
              {!isEnte && (
                <div className="space-y-2">
                  <Label htmlFor="fsc-doc-reviewed">Ultima revisione</Label>
                  <Input
                    id="fsc-doc-reviewed"
                    type="date"
                    value={reviewedAt}
                    onChange={(e) => setReviewedAt(e.target.value)}
                    disabled={mode === 'newVersion'}
                  />
                </div>
              )}
            </div>

            {requiresFile && (
              <div className="space-y-2">
                <Label htmlFor="fsc-doc-file">File (PDF, Word, immagini)</Label>
                <Input
                  id="fsc-doc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  required
                />
                {isSubmitting && uploadProgress > 0 && (
                  <p className="text-xs text-slate-500">Upload: {uploadProgress}%</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Attendere…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {mode === 'edit' ? 'Salva' : 'Carica'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
