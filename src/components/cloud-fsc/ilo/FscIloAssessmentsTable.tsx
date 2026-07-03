'use client'

import type { FscIloAssessmentWithStatus } from '@/actions/fsc/ilo'
import { FscIloRowActions } from '@/components/cloud-fsc/ilo/FscIloRowActions'
import { FscIloStatusBadge } from '@/components/cloud-fsc/ilo/FscIloStatusBadge'

type FscIloAssessmentsTableProps = {
  assessments: FscIloAssessmentWithStatus[]
  canEdit: boolean
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('it-IT')
}

export function FscIloAssessmentsTable({
  assessments,
  canEdit,
}: FscIloAssessmentsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Anno</th>
            <th className="px-4 py-3 font-medium">Stato</th>
            <th className="px-4 py-3 font-medium">Completata il</th>
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {assessments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                Nessuna autovalutazione. Creane una per iniziare.
              </td>
            </tr>
          )}
          {assessments.map((a) => (
            <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{a.reference_year}</td>
              <td className="px-4 py-3">
                <FscIloStatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3">{formatDate(a.completed_at)}</td>
              <td className="px-4 py-3 text-slate-600">
                {[
                  a.has_compiled_word ? 'Word' : null,
                  a.has_compiled_pdf ? 'PDF' : null,
                ]
                  .filter(Boolean)
                  .join(' + ') || '—'}
              </td>
              <td className="px-4 py-3">
                <FscIloRowActions assessment={a} canEdit={canEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
