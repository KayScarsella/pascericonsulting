'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  abortFscIloFileUpload,
  deleteFscIloAssessment,
  exportFscIloWord,
  finalizeFscIloFileUpload,
  getFscIloCompiledDownloadUrl,
  markFscIloCompleted,
  prepareFscIloFileUpload,
  type FscIloAssessmentWithStatus,
} from '@/actions/fsc/ilo'
import {
  downloadPublicFscFile,
  FSC_ILO_VIRGIN_TEMPLATE_PATH,
  triggerBrowserDownload,
} from '@/lib/fsc/download-client'
import { uploadFscDocumentWithProgress } from '@/lib/fsc/documents-upload-client'
import { fscIloEditPath } from '@/lib/fsc/constants'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type FscIloRowActionsProps = {
  assessment: FscIloAssessmentWithStatus
  canEdit: boolean
}

export function FscIloRowActions({ assessment, canEdit }: FscIloRowActionsProps) {
  const router = useRouter()
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const wordInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const year = assessment.reference_year

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setLoading(key)
    try {
      await fn()
    } finally {
      setLoading(null)
    }
  }

  const handleExportWord = async () => {
    const result = await exportFscIloWord(year)
    if (!result.success) {
      toast.error(result.error ?? 'Errore export Word')
      return
    }
    toast.success('Word generato')
    if (result.downloadUrl) {
      triggerBrowserDownload(result.downloadUrl, `autovalutazione_ilo_${year}.docx`)
    }
    router.refresh()
    setOpen(false)
  }

  const handleDownloadCompiled = async (kind: 'word' | 'pdf') => {
    const result = await getFscIloCompiledDownloadUrl(year, kind)
    if (!result.success || !result.url) {
      toast.error(result.error ?? 'File non disponibile')
      return
    }
    const filename =
      kind === 'pdf'
        ? `autovalutazione_ilo_${year}.pdf`
        : `autovalutazione_ilo_${year}.docx`
    triggerBrowserDownload(result.url, filename)
    setOpen(false)
  }

  const handleFileUpload = async (file: File, fileKind: 'word' | 'pdf') => {
    const prepared = await prepareFscIloFileUpload({
      referenceYear: year,
      fileKind,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
    })

    if (!prepared.success || !prepared.storagePath) {
      toast.error(prepared.error ?? 'Preparazione upload fallita')
      return
    }

    const upload = await uploadFscDocumentWithProgress(
      prepared.storagePath,
      file,
      () => {}
    )

    if (upload.error) {
      toast.error(upload.error)
      if (prepared.storageObjectId) {
        await abortFscIloFileUpload(year, fileKind, prepared.storageObjectId)
      }
      return
    }

    const finalized = await finalizeFscIloFileUpload(
      year,
      fileKind,
      prepared.storagePath,
      prepared.storageObjectId!,
      {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }
    )
    if (!finalized.success) {
      toast.error(finalized.error ?? 'Finalizzazione upload fallita')
      return
    }

    toast.success(fileKind === 'pdf' ? 'PDF caricato' : 'Word caricato')
    router.refresh()
    setOpen(false)
  }

  const handleMarkCompleted = async () => {
    if (!confirm(`Segnare l'autovalutazione ${year} come completata?`)) return
    const result = await markFscIloCompleted(year)
    if (!result.success) {
      toast.error(result.error ?? 'Errore')
      return
    }
    toast.success('Autovalutazione segnata come completata')
    router.refresh()
    setOpen(false)
  }

  const handleDelete = async () => {
    if (
      !confirm(
        `Eliminare l'autovalutazione ${year}? Tutti i dati (risposte, Word, PDF) verranno rimossi definitivamente.`
      )
    ) {
      return
    }
    const result = await deleteFscIloAssessment(year)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success(`Autovalutazione ${year} eliminata`)
    router.refresh()
    setOpen(false)
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button type="button" variant="outline" size="sm" asChild>
        <Link href={fscIloEditPath(year)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Modifica
        </Link>
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={!!loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
            <span className="sr-only">Altre azioni</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start"
              disabled={!!loading}
              onClick={() =>
                downloadPublicFscFile(
                  FSC_ILO_VIRGIN_TEMPLATE_PATH,
                  'template_it_coc_v1.2.docx'
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Modello Word vergine
            </Button>

            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                disabled={!!loading}
                onClick={() => void runAction('export', handleExportWord)}
              >
                {loading === 'export' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Esporta Word
              </Button>
            )}

            {assessment.has_compiled_word && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                disabled={!!loading}
                onClick={() => void runAction('word', () => handleDownloadCompiled('word'))}
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica Word
              </Button>
            )}

            {assessment.has_compiled_pdf && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                disabled={!!loading}
                onClick={() => void runAction('pdf', () => handleDownloadCompiled('pdf'))}
              >
                <Download className="mr-2 h-4 w-4" />
                Scarica PDF
              </Button>
            )}

            {canEdit && (
              <>
                <input
                  ref={wordInputRef}
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void runAction('upload-word', () => handleFileUpload(file, 'word'))
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  disabled={!!loading}
                  onClick={() => wordInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Carica Word
                </Button>

                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void runAction('upload-pdf', () => handleFileUpload(file, 'pdf'))
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  disabled={!!loading}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Carica PDF
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  disabled={!!loading}
                  onClick={() => void runAction('complete', handleMarkCompleted)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Segna completata
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={!!loading}
                  onClick={() => void runAction('delete', handleDelete)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
