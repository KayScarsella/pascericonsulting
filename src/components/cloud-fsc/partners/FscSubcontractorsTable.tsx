'use client'

import type { FscSubcontractorWithDetails } from '@/types/fsc'
import { Badge } from '@/components/ui/badge'
import { FscExpiryBadge } from '@/components/cloud-fsc/documents/FscExpiryBadge'
import { FscControlDueBadge } from '@/components/cloud-fsc/partners/FscControlDueBadge'
import { FscPartnerStatusBadge } from '@/components/cloud-fsc/partners/FscPartnerStatusBadge'
import { FscSubcontractorRowActions } from '@/components/cloud-fsc/partners/FscSubcontractorRowActions'

type FscSubcontractorsTableProps = {
  subcontractors: FscSubcontractorWithDetails[]
  canEdit: boolean
}

export function FscSubcontractorsTable({
  subcontractors,
  canEdit,
}: FscSubcontractorsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Ragione sociale</th>
            <th className="px-4 py-3 font-medium">Certificato</th>
            <th className="px-4 py-3 font-medium">Lavorazione</th>
            <th className="px-4 py-3 font-medium">Rischio CoC</th>
            <th className="px-4 py-3 font-medium">Validità</th>
            <th className="px-4 py-3 font-medium">Controllo</th>
            <th className="px-4 py-3 font-medium">Stato</th>
            <th className="px-4 py-3 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {subcontractors.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                Nessun terzista trovato. Aggiungine uno per iniziare.
              </td>
            </tr>
          )}
          {subcontractors.map((t) => (
            <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{t.ragione_sociale}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">{t.is_certified ? 'Sì' : 'No'}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-600">{t.work_type ?? '—'}</td>
              <td className="px-4 py-3">
                {t.coc_risk ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    Sì
                  </Badge>
                ) : (
                  <span className="text-slate-500">No</span>
                )}
              </td>
              <td className="px-4 py-3">
                {t.is_certified ? (
                  <FscExpiryBadge expiresAt={t.certificate_valid_until} showDate={false} />
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-3">
                <FscControlDueBadge
                  lastControlDate={t.last_control_date}
                  frequency={t.control_frequency}
                  showDate={false}
                />
              </td>
              <td className="px-4 py-3">
                <FscPartnerStatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3">
                <FscSubcontractorRowActions subcontractor={t} canEdit={canEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
