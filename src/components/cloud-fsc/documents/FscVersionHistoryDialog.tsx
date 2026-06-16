'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { FscDocumentModuleSlug } from '@/lib/fsc/constants'
import type { FscDocument } from '@/types/fsc'
import { getFscDocumentActions } from './fsc-document-actions'

type FscVersionHistoryDialogProps = {
  documentId: string | null
  documentName: string
  module: FscDocumentModuleSlug
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FscVersionHistoryDialog({
  documentId,
  documentName,
  module,
  open,
  onOpenChange,
}: FscVersionHistoryDialogProps) {
  const [versions, setVersions] = useState<FscDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const actions = useMemo(() => getFscDocumentActions(module), [module])

  useEffect(() => {
    if (!open || !documentId) return

    setLoading(true)
    actions
      .listVersions(documentId)
      .then(setVersions)
      .catch(() => toast.error('Errore caricamento storico versioni'))
      .finally(() => setLoading(false))
  }, [open, documentId, actions])

  const handleDownload = async (id: string) => {
    setDownloadingId(id)
    try {
      const result = await actions.getDownloadUrl(id)
      if (!result.success || !result.url) {
        toast.error(result.error ?? 'Download non disponibile')
        return
      }
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Storico versioni</DialogTitle>
          <DialogDescription>{documentName}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Caricamento…
          </div>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nessuna versione trovata.</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">v{v.version}</span>
                    {v.reference_year != null && (
                      <span className="text-xs text-slate-500">Anno {v.reference_year}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        v.status === 'active'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-500'
                      }
                    >
                      {v.status === 'active' ? 'Corrente' : 'Archiviata'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(v.created_at).toLocaleDateString('it-IT')}
                  </p>
                  <div className="mt-2">
                    <FscExpiryBadge expiresAt={v.expires_at} showDate={!!v.expires_at} />
                  </div>
                </div>
                {v.storage_path && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === v.id}
                    onClick={() => handleDownload(v.id)}
                  >
                    {downloadingId === v.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
