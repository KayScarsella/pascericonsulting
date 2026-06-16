'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FscProductGroupAddendumPanel } from '@/components/cloud-fsc/product-groups/FscProductGroupAddendumPanel'
import { FscProductGroupStatusBadge } from '@/components/cloud-fsc/product-groups/FscProductGroupStatusBadge'
import {
  formatFscSpeciesLabel,
  getFscProductGroupCode,
  getFscProductGroupDisplayName,
} from '@/lib/fsc/product-groups'
import { getFscProductClaimLabel } from '@/lib/fsc/partners'
import type { FscCompanyProductGroupWithDetails } from '@/types/fsc'

type FscProductGroupDetailSheetProps = {
  group: FscCompanyProductGroupWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  canEdit: boolean
}

export function FscProductGroupDetailSheet({
  group,
  open,
  onOpenChange,
  canEdit,
}: FscProductGroupDetailSheetProps) {
  if (!group) return null

  const primaryAddendum = group.addenda[0] ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{getFscProductGroupDisplayName(group)}</DialogTitle>
          <DialogDescription>Dettaglio gruppo di prodotto, claim e addendum.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <FscProductGroupStatusBadge isActive={group.is_active} />
            {getFscProductGroupCode(group) && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                {getFscProductGroupCode(group)}
              </span>
            )}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Attivato il</dt>
              <dd className="font-medium">
                {new Date(group.activated_at).toLocaleDateString('it-IT')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Specie</dt>
              <dd className="font-medium">
                {group.species ? formatFscSpeciesLabel(group.species) : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Claim</dt>
              <dd className="font-medium">
                {group.claims.length > 0
                  ? group.claims.map(getFscProductClaimLabel).join(', ')
                  : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Input necessari</dt>
              <dd className="font-medium whitespace-pre-wrap">
                {group.required_inputs?.trim() || '—'}
              </dd>
            </div>
          </dl>

          {primaryAddendum ? (
            <FscProductGroupAddendumPanel
              companyProductGroupId={group.id}
              addendum={primaryAddendum}
              canEdit={canEdit}
            />
          ) : (
            <p className="text-sm text-slate-500">Nessun addendum associato.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
