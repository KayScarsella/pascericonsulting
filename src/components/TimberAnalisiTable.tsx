'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

type SortField = 'base_evaluation_code' | 'date' | 'nome_operazione' | 'final_outcome'

export function TimberAnalisiTable({ data, page, totalPages, isAdmin }: TimberAnalisiTableProps) {
  const router = useRouter()
  const [currentTime] = useState(() => Date.now())
  const [filterEsito, setFilterEsito] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const dataFilteredByEsito = useMemo(() => {
    if (filterEsito === 'all') return data
    return data.filter((row) => {
      const isAcceptable =
        row.final_outcome?.toLowerCase().includes('accettabile') &&
        !row.final_outcome?.toLowerCase().includes('non accettabile')
      if (filterEsito === 'in_corso') return row.status !== 'completed'
      if (filterEsito === 'accettabile') return row.status === 'completed' && isAcceptable
      if (filterEsito === 'non_accettabile') return row.status === 'completed' && !isAcceptable
      return true
    })
  }, [data, filterEsito])

  const handleSort = (field: string) => {
    const f = field as SortField
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(f)
      setSortDir('asc')
    }
  }

  const sortCompare: (a: AssessmentSessionRow, b: AssessmentSessionRow, field: string, dir: 'asc' | 'desc') => number = (
    a,
    b,
    field,
    dir
  ) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (field === 'base_evaluation_code') {
      va = a.base_evaluation_code
      vb = b.base_evaluation_code
    } else if (field === 'date') {
      va = a.metadata?.expiry_date || a.created_at || ''
      vb = b.metadata?.expiry_date || b.created_at || ''
    } else if (field === 'nome_operazione') {
      va = (a.metadata?.nome_operazione || a.metadata?.operation_name || '').toLowerCase()
      vb = (b.metadata?.nome_operazione || b.metadata?.operation_name || '').toLowerCase()
    } else if (field === 'final_outcome') {
      va = (a.final_outcome || '').toLowerCase()
      vb = (b.final_outcome || '').toLowerCase()
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  }

  const columns: DataManagementColumn<AssessmentSessionRow>[] = [
    {
      id: 'codice',
      header: 'Codice',
      sortKey: 'base_evaluation_code',
      render: (row) => (
        <span className="w-fit bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono border border-slate-200">
          {String(row.base_evaluation_code ?? row.evaluation_code ?? 0)}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Data',
      sortKey: 'date',
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
      sortKey: 'nome_operazione',
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
        const isNonAccettabile = row.final_outcome
          ?.toLowerCase()
          .includes('non accettabile')
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
    router.push(`/timberRegulation/search?tab=analisi&page=${newPage}`)
  }

  return (
    <DataManagementTable<AssessmentSessionRow>
      title="Archivio Analisi"
      data={dataFilteredByEsito}
      columns={columns}
      getRowId={(row) => row.id}
      searchPlaceholder="Cerca per nome operazione o codice..."
      filterPredicate={(row, q) => {
        const nome = (
          row.metadata?.nome_operazione ||
          row.metadata?.operation_name ||
          ''
        ).toLowerCase()
        return nome.includes(q) || String(row.base_evaluation_code).includes(q)
      }}
      sortConfig={{
        field: sortField,
        dir: sortDir,
        onSort: handleSort,
      }}
      sortCompare={sortCompare}
      toolbarExtra={
        <select
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={filterEsito}
          onChange={(e) => setFilterEsito(e.target.value)}
        >
          <option value="all">Tutti gli stati</option>
          <option value="in_corso">In compilazione</option>
          <option value="accettabile">Rischio accettabile (Valide)</option>
          <option value="non_accettabile">Rischio alto (Da mitigare)</option>
        </select>
      }
      resultCountLabel={
        <>
          {dataFilteredByEsito.length} risultati
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
