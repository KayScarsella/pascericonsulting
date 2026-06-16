'use client'

import type { FscSupplierWithDetails } from '@/types/fsc'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { FscControlDueBadge } from '@/components/cloud-fsc/partners/FscControlDueBadge'
import { FscPartnerStatusBadge } from '@/components/cloud-fsc/partners/FscPartnerStatusBadge'
import { FscSupplierRowActions } from '@/components/cloud-fsc/partners/FscSupplierRowActions'
import { getFscProductClaimLabel } from '@/lib/fsc/partners'

type FscSuppliersTableProps = {
  suppliers: FscSupplierWithDetails[]
  canEdit: boolean
}

export function FscSuppliersTable({ suppliers, canEdit }: FscSuppliersTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Ragione sociale</th>
            <th className="px-4 py-3 font-medium">Certificato</th>
            <th className="px-4 py-3 font-medium">Validità</th>
            <th className="px-4 py-3 font-medium">Claim</th>
            <th className="px-4 py-3 font-medium">Controllo</th>
            <th className="px-4 py-3 font-medium">Stato</th>
            <th className="px-4 py-3 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                Nessun fornitore trovato. Aggiungine uno per iniziare.
              </td>
            </tr>
          )}
          {suppliers.map((s) => (
            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{s.ragione_sociale}</td>
              <td className="px-4 py-3 text-slate-600">{s.certificate_number ?? '—'}</td>
              <td className="px-4 py-3">
                <FscExpiryBadge expiresAt={s.certificate_valid_until} showDate={false} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {s.claims.length > 0
                  ? s.claims.map(getFscProductClaimLabel).join(', ')
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <FscControlDueBadge
                  lastControlDate={s.last_control_date}
                  frequency={s.control_frequency}
                  showDate={false}
                />
              </td>
              <td className="px-4 py-3">
                <FscPartnerStatusBadge status={s.status} />
              </td>
              <td className="px-4 py-3">
                <FscSupplierRowActions supplier={s} canEdit={canEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
