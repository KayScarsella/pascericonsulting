'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { FscControlDueBadge } from '@/components/cloud-fsc/partners/FscControlDueBadge'
import { FscPartnerAttachmentsPanel } from '@/components/cloud-fsc/partners/FscPartnerAttachmentsPanel'
import { FscPartnerStatusBadge } from '@/components/cloud-fsc/partners/FscPartnerStatusBadge'
import {
  FSC_SUPPLIER_ATTACHMENT_TYPES,
  getFscProductClaimLabel,
  getFscControlFrequencyLabel,
} from '@/lib/fsc/partners'
import type { FscSupplierWithDetails } from '@/types/fsc'

type FscSupplierDetailSheetProps = {
  supplier: FscSupplierWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
}

export function FscSupplierDetailSheet({
  supplier,
  open,
  onOpenChange,
  canEdit,
}: FscSupplierDetailSheetProps) {
  if (!supplier) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier.ragione_sociale}</DialogTitle>
          <DialogDescription>Dettaglio fornitore e documentazione allegata.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <FscPartnerStatusBadge status={supplier.status} />
            <FscExpiryBadge expiresAt={supplier.certificate_valid_until} />
            <FscControlDueBadge
              lastControlDate={supplier.last_control_date}
              frequency={supplier.control_frequency}
            />
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">N. certificato</dt>
              <dd className="font-medium">{supplier.certificate_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Frequenza controllo</dt>
              <dd className="font-medium">
                {getFscControlFrequencyLabel(supplier.control_frequency)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Claim prodotto</dt>
              <dd className="font-medium">
                {supplier.claims.length > 0
                  ? supplier.claims.map(getFscProductClaimLabel).join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-3 font-semibold text-slate-900">Allegati</h3>
            <FscPartnerAttachmentsPanel
              entity="supplier"
              entityId={supplier.id}
              attachments={supplier.attachments}
              attachmentTypes={FSC_SUPPLIER_ATTACHMENT_TYPES}
              canEdit={canEdit}
            />
          </div>

          {supplier.status_history && supplier.status_history.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Storico stato</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                {supplier.status_history.map((h) => (
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
