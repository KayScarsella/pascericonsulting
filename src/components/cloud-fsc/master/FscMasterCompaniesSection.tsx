'use client'

import Link from 'next/link'
import type { FscCompanyAdminRow } from '@/actions/fsc/company'
import { fscMemberTypeLabel } from '@/lib/fsc/constants'
import type { FscMemberType } from '@/types/fsc'
import {
  DataManagementTable,
  type DataManagementColumn,
} from '@/components/admin/DataManagementTable'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'

export type FscCompanyMemberSummary = {
  user_id: string
  full_name: string | null
  email: string | null
  member_type: FscMemberType
  can_edit: boolean
}

type FscMasterCompaniesSectionProps = {
  companies: FscCompanyAdminRow[]
  membersByCompany: Record<string, FscCompanyMemberSummary[]>
  basePath: string
}

export function FscMasterCompaniesSection({
  companies,
  membersByCompany,
  basePath,
}: FscMasterCompaniesSectionProps) {
  const columns: DataManagementColumn<FscCompanyAdminRow>[] = [
    {
      id: 'ragione_sociale',
      header: 'Ragione sociale',
      render: (row) => <span className="font-medium text-slate-900">{row.ragione_sociale}</span>,
    },
    {
      id: 'cf',
      header: 'CF / P.IVA',
      render: (row) => <span className="text-slate-600">{row.cf_partita_iva ?? '—'}</span>,
    },
    {
      id: 'email',
      header: 'Email',
      render: (row) => <span className="text-slate-600">{row.email ?? '—'}</span>,
    },
    {
      id: 'members',
      header: 'Membri',
      render: (row) => <span className="text-slate-600">{row.member_count}</span>,
    },
    {
      id: 'created',
      header: 'Creata il',
      render: (row) => (
        <span className="text-slate-600 text-sm">
          {new Date(row.created_at).toLocaleDateString('it-IT')}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <DataManagementTable
        title="Imprese FSC"
        data={companies}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Cerca impresa..."
        searchMode="client"
        emptyMessage="Nessuna impresa registrata."
        resultCountLabel={`${companies.length} imprese`}
      />

      {companies.map((company) => {
        const members = membersByCompany[company.id] ?? []
        if (members.length === 0) return null
        return (
          <div key={company.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{company.ragione_sociale}</h3>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${basePath.replace(/\/companies$/, '/users')}?q=${encodeURIComponent(company.ragione_sociale)}`}>
                  <Users className="mr-2 h-4 w-4" />
                  Utenti tool
                </Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">Nome</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Ruolo impresa</th>
                    <th className="pb-2 font-medium">Modifica</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{m.full_name ?? '—'}</td>
                      <td className="py-2 pr-4">{m.email ?? '—'}</td>
                      <td className="py-2 pr-4">{fscMemberTypeLabel(m.member_type)}</td>
                      <td className="py-2">{m.can_edit ? 'Sì' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
