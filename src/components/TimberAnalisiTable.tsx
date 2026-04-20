'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DataManagementTable,
  type DataManagementColumn,
} from '@/components/admin/DataManagementTable'
import { deleteRecords } from '@/actions/actions'
import {
  Edit,
  FileArchive,
  Clock,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { finalOutcomeIsNegative } from '@/lib/final-outcome'

export type SessionMetadata = {
  nome_operazione?: string
  operation_name?: string
  risk_score?: number
  expiry_date?: string
  [key: string]: unknown
}

export interface AssessmentSessionRow {
  id: string
  created_at: string
  status: string
  parent_session_id: string | null
  final_outcome: string | null
  metadata: SessionMetadata | null
  evaluation_code: number
  base_session_id: string
  base_evaluation_code: number
  owner_name?: string | null
}

export interface TimberAnalisiTableProps {
  data: AssessmentSessionRow[]
  page: number
  totalPages: number
  isAdmin: boolean
}

export function TimberAnalisiTable({ data, page, totalPages, isAdmin }: TimberAnalisiTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentTime] = useState(() => Date.now())
  const filterEsito = searchParams.get('esito') ?? 'all'
  const q = searchParams.get('q') ?? ''
  const sortField = searchParams.get('sort') ?? 'created_at'
  const sortDir = (searchParams.get('dir') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const pushParams = (next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`/timberRegulation/search?${sp.toString()}`)
  }

  const handleSort = (field: string) => {
    const nextDir = sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    pushParams({ sort: field, dir: nextDir, page: '1' })
  }

  const columns: DataManagementColumn<AssessmentSessionRow>[] = [
    {
      id: 'codice',
      header: 'Codice',
      sortKey: 'evaluation_code',
      render: (row) => (
        <span className="w-fit bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono border border-slate-200">
          {String(row.base_evaluation_code ?? row.evaluation_code ?? 0)}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Data',
      sortKey: 'created_at',
      render: (row) => {
        const expiryDateStr = row.metadata?.expiry_date as string | undefined
        const isExpired = expiryDateStr
          ? new Date(expiryDateStr).getTime() < currentTime
          : false
        return expiryDateStr ? (
          <div className="flex flex-col">
            <span
              className={cn(
                'text-sm font-semibold',
                isExpired ? 'text-red-600' : 'text-slate-700'
              )}
            >
              {new Date(expiryDateStr).toLocaleDateString('it-IT')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Scadenza
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-400">—</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              Non approvata
            </span>
          </div>
        )
      },
    },
    {
      id: 'nome_operazione',
      header: 'Nome Operazione',
      render: (row) => {
        const meta = row.metadata || {}
        return (
          <span className="font-medium text-slate-900">
            {meta.nome_operazione || meta.operation_name || 'Operazione senza nome'}
          </span>
        )
      },
    },
    {
      id: 'final_outcome',
      header: 'Esito / Stato',
      sortKey: 'final_outcome',
      headerClassName: 'text-center',
      className: 'text-center',
      render: (row) => {
        const riskScore = row.metadata?.risk_score as number | undefined
        const expiryDateStr = row.metadata?.expiry_date as string | undefined
        const isExpired = expiryDateStr
          ? new Date(expiryDateStr).getTime() < currentTime
          : false
        const isNonAccettabile = finalOutcomeIsNegative(row.final_outcome)
        if (row.status !== 'completed') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
              <Clock className="h-3.5 w-3.5" /> In compilazione
            </span>
          )
        }
        if (isNonAccettabile) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-semibold border border-orange-200">
              <AlertTriangle className="h-3.5 w-3.5" /> Da Mitigare
              {riskScore !== undefined && ` (Rischio ${riskScore.toFixed(2)})`}
            </span>
          )
        }
        if (isExpired) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-semibold border border-red-200">
              <ShieldAlert className="h-3.5 w-3.5" /> Scaduta
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Valida
            {riskScore !== undefined && ` (${riskScore.toFixed(2)})`}
          </span>
        )
      },
    },
    ...(isAdmin
      ? ([
          {
            id: 'owner',
            header: 'Proprietario',
            render: (row: AssessmentSessionRow) => (
              <span className="text-slate-700">
                {row.owner_name ?? (
                  <span className="text-slate-400 text-xs italic">—</span>
                )}
              </span>
            ),
          },
        ] as DataManagementColumn<AssessmentSessionRow>[])
      : []),
  ]

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    pushParams({ tab: 'analisi', page: String(newPage) })
  }

  return (
    <DataManagementTable<AssessmentSessionRow>
      title="Archivio Analisi"
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      searchPlaceholder="Cerca per nome operazione o codice..."
      searchMode="server"
      search={{
        value: q,
        onChange: (next) => pushParams({ q: next, page: '1' }),
      }}
      sortConfig={{
        field: sortField,
        dir: sortDir,
        onSort: handleSort,
      }}
      toolbarExtra={
        <select
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={filterEsito}
          onChange={(e) => pushParams({ esito: e.target.value, page: '1' })}
        >
          <option value="all">Tutti gli stati</option>
          <option value="in_corso">In compilazione</option>
          <option value="accettabile">Rischio trascurabile (Valide)</option>
          <option value="non_accettabile">Rischio non trascurabile (Da mitigare)</option>
        </select>
      }
      resultCountLabel={
        <>
          {data.length} risultati
          {isAdmin && (
            <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-200">
              Vista Admin
            </span>
          )}
        </>
      }
      selectable
      onBulkDelete={async (ids) => {
        const res = await deleteRecords(ids)
        if (res.success) router.refresh()
        return res
      }}
      bulkDeleteLabel="Elimina"
      emptyMessage="Nessuna analisi trovata."
      pagination={{
        page,
        totalPages,
        onPageChange: handlePageChange,
      }}
      renderRowActions={(row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'completed' ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-emerald-600 hover:bg-emerald-50"
              onClick={() =>
                router.push(`/timberRegulation/risultato?session_id=${row.id}`)
              }
              title="Vedi Risultato Analisi"
            >
              <FileArchive className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="text-amber-600 hover:bg-amber-50"
              onClick={() =>
                router.push(
                  `/timberRegulation/valutazione-finale?session_id=${row.id}`
                )
              }
              title="Continua Analisi"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    />
  )
}
