'use client'

import type { FscLogo } from '@/types/fsc'
import { FscLogoRowActions } from '@/components/cloud-fsc/loghi/FscLogoRowActions'
import { getFscLogoTypeLabel } from '@/lib/fsc/logos'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'

type FscLogosTableProps = {
  logos: FscLogo[]
  canEdit: boolean
}

function FileBadge({ present, label }: { present: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        present
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }
    >
      {present ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  )
}

export function FscLogosTable({ logos, canEdit }: FscLogosTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Codice</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Note</th>
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium text-right">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {logos.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                Nessun logo trovato. Aggiungine uno per iniziare.
              </td>
            </tr>
          )}
          {logos.map((logo) => (
            <tr key={logo.id} className="border-t border-slate-100 hover:bg-slate-50/80">
              <td className="px-4 py-3 font-mono font-medium text-slate-900">
                {logo.progressive_code}
              </td>
              <td className="px-4 py-3 text-slate-600">{getFscLogoTypeLabel(logo.logo_type)}</td>
              <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                {logo.notes?.trim() || '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <FileBadge present={!!logo.approval_file_path} label="Email" />
                  <FileBadge present={!!logo.graphic_file_path} label="Grafica" />
                </div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(logo.created_at).toLocaleDateString('it-IT')}
              </td>
              <td className="px-4 py-3">
                <FscLogoRowActions logo={logo} canEdit={canEdit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
