'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { FscControlDueBadge } from '@/components/cloud-fsc/partners/FscControlDueBadge'
import { FscPartnerAttachmentsPanel } from '@/components/cloud-fsc/partners/FscPartnerAttachmentsPanel'
import { FscPartnerStatusBadge } from '@/components/cloud-fsc/partners/FscPartnerStatusBadge'
import {
  FSC_SUBCONTRACTOR_ATTACHMENT_TYPES,
  getFscControlFrequencyLabel,
} from '@/lib/fsc/partners'
import type { FscSubcontractorWithDetails } from '@/types/fsc'

type FscSubcontractorDetailSheetProps = {
  subcontractor: FscSubcontractorWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
}

function getVisibleAttachmentTypes(isCertified: boolean) {
  if (isCertified) {
    return FSC_SUBCONTRACTOR_ATTACHMENT_TYPES.filter((t) => t.value === 'certificato')
  }
  return FSC_SUBCONTRACTOR_ATTACHMENT_TYPES.filter((t) => t.value === 'accordo_conto_lavoro')
}

export function FscSubcontractorDetailSheet({
  subcontractor,
  open,
  onOpenChange,
  canEdit,
}: FscSubcontractorDetailSheetProps) {
  if (!subcontractor) return null

  const attachmentTypes = getVisibleAttachmentTypes(subcontractor.is_certified)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{subcontractor.ragione_sociale}</DialogTitle>
          <DialogDescription>Dettaglio terzista e documentazione.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <FscPartnerStatusBadge status={subcontractor.status} />
            <Badge variant="outline">
              {subcontractor.is_certified ? 'Certificato' : 'Non certificato'}
            </Badge>
            {subcontractor.coc_risk && (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Rischio CoC
              </Badge>
            )}
            {subcontractor.is_certified && (
              <FscExpiryBadge expiresAt={subcontractor.certificate_valid_until} />
            )}
            <FscControlDueBadge
              lastControlDate={subcontractor.last_control_date}
              frequency={subcontractor.control_frequency}
            />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Tipo lavorazione</dt>
              <dd className="font-medium">{subcontractor.work_type ?? '—'}</dd>
            </div>
            {subcontractor.is_certified && (
              <div>
                <dt className="text-slate-500">N. certificato</dt>
                <dd className="font-medium">{subcontractor.certificate_number ?? '—'}</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-500">Frequenza controllo</dt>
              <dd className="font-medium">
                {getFscControlFrequencyLabel(subcontractor.control_frequency)}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-3 font-semibold text-slate-900">Allegati</h3>
            <FscPartnerAttachmentsPanel
              entity="subcontractor"
              entityId={subcontractor.id}
              attachments={subcontractor.attachments}
              attachmentTypes={attachmentTypes}
              canEdit={canEdit}
            />
          </div>

          {subcontractor.status_history && subcontractor.status_history.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Storico stato</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                {subcontractor.status_history.map((h) => (
                  <li key={h.id}>
                    {new Date(h.changed_at).toLocaleString('it-IT')} —{' '}
                    {h.old_status ?? '—'} → {h.new_status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
