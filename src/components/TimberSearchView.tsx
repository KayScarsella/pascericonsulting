'use client'

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DataManagementTable,
  type DataManagementColumn,
} from "@/components/admin/DataManagementTable"
import { deleteRecords } from "@/actions/actions"
import { Edit } from "lucide-react"
import { cn } from "@/lib/utils"
import { TimberAnalisiTable, type AssessmentSessionRow } from "@/components/TimberAnalisiTable"

// --- Verification row type (used by search page for data shape) ---
export interface VerificationRow {
  id: string
  created_at: string
  evaluation_code: number
  riskCompleted: boolean
  evaluationCompleted: boolean
  nomeCommerciale?: string | null
  status?: string | null
  final_outcome?: string | null
  isBlocked?: boolean
}

type VerificheSortField = "evaluation_code" | "created_at" | "nomeCommerciale" | "stato"

function getVerificheStatusLabel(row: VerificationRow): { text: string; variant: "amber" | "green"; key: string } {
  if (row.status === 'completed') {
    if (row.isBlocked) {
      return { text: row.final_outcome || "Esente / Non Soggetto", variant: "green", key: "esente" }
    }
    return { text: "Conclusa", variant: "green", key: "conclusa" }
  }
  if (!row.riskCompleted) {
    return { text: "In corso (verifica preliminare)", variant: "amber", key: "in_corso" }
  }
  if (!row.evaluationCompleted) {
    return { text: "In corso (valutazione)", variant: "amber", key: "in_corso" }
  }
  return { text: "Conclusa", variant: "green", key: "conclusa" }
}

// --- Props ---
export interface TimberSearchViewProps {
  tab: string
  analyses: AssessmentSessionRow[]
  page: number
  totalPages: number
  verifications: VerificationRow[]
  vpage: number
  totalPagesV: number
  isAdmin: boolean
}

export function TimberSearchView({
  tab,
  analyses,
  page,
  totalPages,
  verifications,
  vpage,
  totalPagesV,
  isAdmin,
}: TimberSearchViewProps) {
  const router = useRouter()
  const isAnalisi = tab !== 'verifiche'

  // Verifiche tab: local state for filter + sort
  const [filterStato, setFilterStato] = useState<string>("all")
  const [sortField, setSortField] = useState<VerificheSortField | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const verificheFilteredByStato = useMemo(() => {
    if (filterStato === "all") return verifications
    return verifications.filter((row) => {
      const s = getVerificheStatusLabel(row)
      if (filterStato === "conclusa" && s.key === "esente") return true
      return s.key === filterStato
    })
  }, [verifications, filterStato])

  const handleVerificheSort = (field: string) => {
    const f = field as VerificheSortField
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(f)
      setSortDir('asc')
    }
  }

  const verificheSortCompare = (a: VerificationRow, b: VerificationRow, field: string, dir: 'asc' | 'desc') => {
    let va: string | number = ""
    let vb: string | number = ""
    if (field === "evaluation_code") {
      va = a.evaluation_code
      vb = b.evaluation_code
    } else if (field === "created_at") {
      va = a.created_at
      vb = b.created_at
    } else if (field === "nomeCommerciale") {
      va = (a.nomeCommerciale ?? "").toLowerCase()
      vb = (b.nomeCommerciale ?? "").toLowerCase()
    } else if (field === "stato") {
      va = getVerificheStatusLabel(a).key
      vb = getVerificheStatusLabel(b).key
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  }

  const handleVerificheContinue = (row: VerificationRow) => {
    if (row.isBlocked || !row.riskCompleted) {
      router.push(`/timberRegulation/risk-analysis?session_id=${row.id}`)
      return
    }
    if (!row.evaluationCompleted) {
      router.push(`/timberRegulation/evaluation?session_id=${row.id}`)
      return
    }
    router.push(`/timberRegulation/evaluation?session_id=${row.id}`)
  }

  const handleVerifichePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPagesV) return
    router.push(`/timberRegulation/search?tab=verifiche&vpage=${newPage}`)
  }

  const verificheColumns: DataManagementColumn<VerificationRow>[] = [
    {
      id: 'evaluation_code',
      header: 'Codice Verifica',
      sortKey: 'evaluation_code',
      render: (row) => (
        <span className="inline-flex px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs">
          {String(row.evaluation_code ?? 0)}
        </span>
      ),
    },
    {
      id: 'nomeCommerciale',
      header: 'Nome Commerciale',
      sortKey: 'nomeCommerciale',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.nomeCommerciale ?? <span className="text-slate-400 italic text-xs">—</span>}
        </span>
      ),
    },
    {
      id: 'created_at',
      header: 'Data Creazione',
      sortKey: 'created_at',
      render: (row) => (
        <span className="text-slate-500">{new Date(row.created_at).toLocaleDateString("it-IT")}</span>
      ),
    },
    {
      id: 'stato',
      header: 'Stato',
      sortKey: 'stato',
      render: (row) => {
        const status = getVerificheStatusLabel(row)
        return (
          <span
            className={cn(
              "inline-flex px-2 py-1 rounded text-xs font-medium border",
              status.variant === "green"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            {status.text}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
        <Button
          type="button"
          variant={isAnalisi ? "default" : "ghost"}
          size="sm"
          className={
            isAnalisi
              ? "rounded-full px-4 py-1 h-8 text-sm"
              : "rounded-full px-4 py-1 h-8 text-sm text-slate-600"
          }
          onClick={() => router.push('/timberRegulation/search?tab=analisi&page=1')}
        >
          Analisi finali
        </Button>
        <Button
          type="button"
          variant={!isAnalisi ? "default" : "ghost"}
          size="sm"
          className={
            !isAnalisi
              ? "rounded-full px-4 py-1 h-8 text-sm"
              : "rounded-full px-4 py-1 h-8 text-sm text-slate-600"
          }
          onClick={() => router.push('/timberRegulation/search?tab=verifiche&vpage=1')}
        >
          Verifiche
        </Button>
      </div>

      {isAnalisi ? (
        <TimberAnalisiTable data={analyses} page={page} totalPages={totalPages} isAdmin={isAdmin} />
      ) : (
        <DataManagementTable<VerificationRow>
          title="Verifiche preliminari"
          data={verificheFilteredByStato}
          columns={verificheColumns}
          getRowId={(row) => row.id}
          searchPlaceholder="Cerca per nome prodotto o codice..."
          filterPredicate={(row, q) =>
            (row.nomeCommerciale ?? "").toLowerCase().includes(q) ||
            String(row.evaluation_code).includes(q)
          }
          sortConfig={{
            field: sortField,
            dir: sortDir,
            onSort: handleVerificheSort,
          }}
          sortCompare={verificheSortCompare}
          toolbarExtra={
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={filterStato}
              onChange={(e) => setFilterStato(e.target.value)}
            >
              <option value="all">Tutti gli stati</option>
              <option value="in_corso">In corso</option>
              <option value="conclusa">Conclusa / Esente</option>
            </select>
          }
          resultCountLabel={`${verificheFilteredByStato.length} risultati`}
          selectable
          onBulkDelete={async (ids) => {
            const res = await deleteRecords(ids)
            if (res.success) router.refresh()
            return res
          }}
          bulkDeleteLabel="Elimina"
          emptyMessage="Nessuna verifica trovata."
          pagination={{
            page: vpage,
            totalPages: totalPagesV,
            onPageChange: handleVerifichePageChange,
          }}
          renderRowActions={(row) => (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="text-amber-600 hover:bg-amber-50"
                onClick={() => handleVerificheContinue(row)}
                title="Continua o rivedi la verifica"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      )}
    </div>
  )
}
