'use client'

import { useMemo, useState } from 'react'
import {
  Trash2,
  Download,
  History,
  Loader2,
  Pencil,
  Plus,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { FscDocumentFormDialog } from '@/components/cloud-fsc/documents/FscDocumentFormDialog'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { FscVersionHistoryDialog } from '@/components/cloud-fsc/documents/FscVersionHistoryDialog'
import { Button } from '@/components/ui/button'
import {
  getFscModuleCategoryLabel,
  type FscDocumentModuleSlug,
} from '@/lib/fsc/constants'
import type { FscGestioneDocument } from '@/types/fsc'
import { getFscDocumentActions } from './fsc-document-actions'

type FscCategoryPanelProps = {
  module: FscDocumentModuleSlug
  category: string
  documents: FscGestioneDocument[]
  canEdit: boolean
}

export function FscCategoryPanel({
  module,
  category,
  documents,
  canEdit,
}: FscCategoryPanelProps) {
  const router = useRouter()
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'newVersion'>('create')
  const [selectedDoc, setSelectedDoc] = useState<FscGestioneDocument | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyDoc, setHistoryDoc] = useState<FscGestioneDocument | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const actions = useMemo(() => getFscDocumentActions(module), [module])
  const isEnte = module === 'ente'
  const categoryLabel = getFscModuleCategoryLabel(module, category)

  const openCreate = () => {
    setFormMode('create')
    setSelectedDoc(null)
    setFormOpen(true)
  }

  const openEdit = (doc: FscGestioneDocument) => {
    setFormMode('edit')
    setSelectedDoc(doc)
    setFormOpen(true)
  }

  const openNewVersion = (doc: FscGestioneDocument) => {
    setFormMode('newVersion')
    setSelectedDoc(doc)
    setFormOpen(true)
  }

  const openHistory = (doc: FscGestioneDocument) => {
    setHistoryDoc(doc)
    setHistoryOpen(true)
  }

  const handleDownload = async (doc: FscGestioneDocument) => {
    setDownloadingId(doc.id)
    try {
      const result = await actions.getDownloadUrl(doc.id)
      if (!result.success || !result.url) {
        toast.error(result.error ?? 'Download non disponibile')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (doc: FscGestioneDocument) => {
    if (!confirm(`Eliminare definitivamente "${doc.name}"? L'operazione non è reversibile.`)) return

    setDeletingId(doc.id)
    try {
      const result = await actions.deleteDocument(doc.id)
      if (!result.success) {
        toast.error(result.error ?? 'Errore eliminazione')
        return
      }
      toast.success('Documento eliminato')
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{categoryLabel}</h2>
          <p className="text-sm text-slate-500">
            {documents.length === 0
              ? 'Nessun documento in questa sezione.'
              : `${documents.length} documento/i attivo/i`}
          </p>
        </div>
        {canEdit && (
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo documento
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="flex min-h-[32vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-700">Nessun documento</p>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {isEnte
              ? 'Carica visure, M210, certificati e altri documenti di interscambio con l\u2019ente.'
              : 'Carica manuali, politiche, procedure o allegati per la tua impresa FSC.'}
          </p>
          {canEdit && (
            <Button type="button" className="mt-4" onClick={openCreate}>
              <Upload className="mr-2 h-4 w-4" />
              Carica il primo documento
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                {isEnte && <th className="px-4 py-3 font-medium">Anno</th>}
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Versione</th>
                <th className="px-4 py-3 font-medium">Scadenza</th>
                {!isEnte && (
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Revisione</th>
                )}
                <th className="px-4 py-3 font-medium text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium text-slate-900">{doc.name}</td>
                  {isEnte && (
                    <td className="px-4 py-3 text-slate-600">
                      {doc.reference_year ?? '—'}
                    </td>
                  )}
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                    v{doc.version}
                    {(doc.version_count ?? 1) > 1 && (
                      <span className="ml-1 text-xs text-slate-400">
                        ({doc.version_count} totali)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <FscExpiryBadge expiresAt={doc.expires_at} />
                  </td>
                  {!isEnte && (
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {doc.reviewed_at
                        ? new Date(doc.reviewed_at).toLocaleDateString('it-IT')
                        : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!doc.has_file || downloadingId === doc.id}
                        onClick={() => handleDownload(doc)}
                        title="Scarica"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      {(doc.version_count ?? 1) > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openHistory(doc)}
                          title="Storico versioni"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(doc)}
                            title="Modifica metadati"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openNewVersion(doc)}
                            title="Nuova versione"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deletingId === doc.id}
                            onClick={() => handleDelete(doc)}
                            title="Elimina"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FscDocumentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        module={module}
        category={category}
        document={selectedDoc}
      />

      <FscVersionHistoryDialog
        documentId={historyDoc?.id ?? null}
        documentName={historyDoc?.name ?? ''}
        module={module}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  )
}
