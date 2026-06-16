'use client'

import type { FscCompanyProductGroupWithDetails } from '@/types/fsc'
import { FscProductGroupRowActions } from '@/components/cloud-fsc/product-groups/FscProductGroupRowActions'
import { FscProductGroupStatusBadge } from '@/components/cloud-fsc/product-groups/FscProductGroupStatusBadge'
import {
  formatFscSpeciesLabel,
  getFscProductGroupCode,
  getFscProductGroupDisplayName,
} from '@/lib/fsc/product-groups'
import { getFscProductClaimLabel } from '@/lib/fsc/partners'

type FscProductGroupsTableProps = {
  groups: FscCompanyProductGroupWithDetails[]
  canEdit: boolean
}

export function FscProductGroupsTable({ groups, canEdit }: FscProductGroupsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Gruppo</th>
            <th className="px-4 py-3 font-medium">Codice FSC</th>
            <th className="px-4 py-3 font-medium">Claim</th>
            <th className="px-4 py-3 font-medium">Specie</th>
            <th className="px-4 py-3 font-medium">Stato</th>
            <th className="px-4 py-3 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                Nessun gruppo di prodotto trovato. Aggiungine uno per iniziare.
              </td>
            </tr>
          )}
          {groups.map((group) => (
            <tr key={group.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{getFscProductGroupDisplayName(group)}</td>
              <td className="px-4 py-3 text-slate-600">{getFscProductGroupCode(group) ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">
                {group.claims.length > 0
                  ? group.claims.map(getFscProductClaimLabel).join(', ')
                  : '—'}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {group.species ? formatFscSpeciesLabel(group.species) : '—'}
              </td>
              <td className="px-4 py-3">
                <FscProductGroupStatusBadge isActive={group.is_active} />
              </td>
              <td className="px-4 py-3">
                <FscProductGroupRowActions group={group} canEdit={canEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
