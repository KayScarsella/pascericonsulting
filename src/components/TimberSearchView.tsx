'use client'

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DataManagementTable,
  type DataManagementColumn,
} from "@/components/admin/DataManagementTable"
import { deleteRecords } from "@/actions/actions"
import { Edit } from "lucide-react"
import { cn } from "@/lib/utils"
import { TimberAnalisiTable, type AssessmentSessionRow } from "@/components/TimberAnalisiTable"
import { normalizeTimberSearchTab, resolveTimberVerificheActionUrl } from "@/lib/timber-search-routing"

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
  owner_name?: string | null
  resume_url?: string | null
}

function getVerificheStatusLabel(row: VerificationRow): { text: string; variant: "amber" | "green"; key: string } {
  if (row.status === 'completed') {
    if (row.isBlocked) {
      const exemptPhase = row.riskCompleted ? "Valutazione" : "Verifica preliminare"
      return {
        text: `${row.final_outcome || "Esente / Non Soggetto"} - ${exemptPhase}`,
        variant: "green",
        key: "esente",
      }
    }
    return { text: "Conclusa", variant: "green", key: "conclusa" }
  }
  if (!row.riskCompleted) {
    return { text: "In corso - Verifica preliminare", variant: "amber", key: "in_corso" }
  }
  if (!row.evaluationCompleted) {
    return { text: "In corso - Valutazione", variant: "amber", key: "in_corso" }
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
  const searchParams = useSearchParams()
  const normalizedTab = normalizeTimberSearchTab(tab)
  const isAnalisi = normalizedTab !== 'verifiche'

  // Verifiche tab: local state for filter + sort
  const filterStato = searchParams.get('stato') ?? 'all'
  const vq = searchParams.get('vq') ?? ''
  const vsort = searchParams.get('vsort') ?? 'created_at'
  const vdir = (searchParams.get('vdir') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const pushParams = (next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`/timberRegulation/search?${sp.toString()}`)
  }

  const handleVerificheSort = (field: string) => {
    const nextDir = vsort === field ? (vdir === 'asc' ? 'desc' : 'asc') : 'asc'
    pushParams({ vsort: field, vdir: nextDir, vpage: '1' })
  }

  const handleVerificheContinue = (row: VerificationRow) => {
    router.push(
      resolveTimberVerificheActionUrl({
        sessionId: row.id,
        riskCompleted: row.riskCompleted,
        isBlocked: row.isBlocked,
        resumeUrl: row.resume_url,
      })
    )
  }

  const handleVerifichePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPagesV) return
    pushParams({ tab: 'verifiche', vpage: String(newPage) })
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
    ...(isAdmin
      ? ([
          {
            id: 'owner',
            header: 'Proprietario',
            render: (row: VerificationRow) => (
              <span className="text-slate-700">
                {row.owner_name ?? (
                  <span className="text-slate-400 text-xs italic">—</span>
                )}
              </span>
            ),
          },
        ] as DataManagementColumn<VerificationRow>[])
      : []),
    {
      id: 'stato',
      header: 'Stato',
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
          onClick={() => pushParams({ tab: 'analisi', page: '1' })}
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
          onClick={() => pushParams({ tab: 'verifiche', vpage: '1' })}
        >
          Verifiche
        </Button>
      </div>

      {isAnalisi ? (
        <TimberAnalisiTable data={analyses} page={page} totalPages={totalPages} isAdmin={isAdmin} />
      ) : (
        <DataManagementTable<VerificationRow>
          title="Verifiche preliminari"
          data={verifications}
          columns={verificheColumns}
          getRowId={(row) => row.id}
          searchPlaceholder="Cerca per nome prodotto o codice..."
          searchMode="server"
          search={{
            value: vq,
            onChange: (next) => pushParams({ vq: next, vpage: '1' }),
          }}
          sortConfig={{
            field: vsort,
            dir: vdir,
            onSort: handleVerificheSort,
          }}
          toolbarExtra={
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={filterStato}
              onChange={(e) => pushParams({ stato: e.target.value, vpage: '1' })}
            >
              <option value="all">Tutti gli stati</option>
              <option value="in_corso">In corso</option>
              <option value="conclusa">Conclusa / Esente</option>
            </select>
          }
          resultCountLabel={`${verifications.length} risultati`}
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
