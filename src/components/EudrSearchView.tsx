'use client'

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DataManagementTable,
  type DataManagementColumn,
} from "@/components/admin/DataManagementTable"
import { deleteRecords } from "@/actions/actions"
import { cn } from "@/lib/utils"
import { EudrAnalisiTable, type EudrAssessmentSessionRow } from "@/components/EudrAnalisiTable"

export type EudrVerificationRow = {
  id: string
  created_at: string
  final_outcome: string | null
  status: string
  metadata: {
    nome_commerciale?: string
    is_blocked?: boolean
    block_reason?: string
    block_variant?: "success" | "warning" | "error"
  } | null
  owner_name?: string | null
}

type VerificheSortField = "created_at" | "nomeCommerciale" | "stato"

function getStatusLabel(row: EudrVerificationRow): {
  text: string
  variant: "amber" | "green"
  key: "in_corso" | "conclusa" | "esente"
} {
  if (row.status === "completed") {
    if (row.final_outcome === "Esente / Non Soggetto" || row.metadata?.is_blocked) {
      return {
        text: row.final_outcome || "Esente / Non Soggetto",
        variant: "green",
        key: "esente",
      }
    }
    return { text: row.final_outcome || "Verifica completata", variant: "green", key: "conclusa" }
  }
  return { text: "In corso", variant: "amber", key: "in_corso" }
}

export interface EudrSearchViewProps {
  tab: string
  analyses: EudrAssessmentSessionRow[]
  page: number
  totalPages: number
  verifications: EudrVerificationRow[]
  vpage: number
  totalPagesV: number
  isAdmin: boolean
}

export function EudrSearchView({
  tab,
  analyses,
  page,
  totalPages,
  verifications,
  vpage,
  totalPagesV,
  isAdmin,
}: EudrSearchViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAnalisi = tab !== "verifiche"

  const filterStato = searchParams.get("stato") ?? "all"
  const vq = searchParams.get("vq") ?? ""
  const vsort = searchParams.get("vsort") ?? "created_at"
  const vdir = (searchParams.get("vdir") === "asc" ? "asc" : "desc") as "asc" | "desc"

  const pushParams = (next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`/EUDR/search?${sp.toString()}`)
  }

  const handleVerificheSort = (field: string) => {
    const nextDir = vsort === field ? (vdir === "asc" ? "desc" : "asc") : "asc"
    pushParams({ vsort: field, vdir: nextDir, vpage: "1" })
  }

  const handleVerifichePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPagesV) return
    pushParams({ tab: "verifiche", vpage: String(newPage) })
  }

  const handleOpen = (row: EudrVerificationRow) => {
    router.push(`/EUDR/evaluation?session_id=${row.id}`)
  }

  const columns: DataManagementColumn<EudrVerificationRow>[] = [
    {
      id: "nomeCommerciale",
      header: "Nome Commerciale",
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.metadata?.nome_commerciale ?? (
            <span className="text-slate-400 italic text-xs">—</span>
          )}
        </span>
      ),
    },
    {
      id: "created_at",
      header: "Data Creazione",
      sortKey: "created_at",
      render: (row) => (
        <span className="text-slate-500">
          {new Date(row.created_at).toLocaleDateString("it-IT")}
        </span>
      ),
    },
    ...(isAdmin
      ? ([
          {
            id: "owner",
            header: "Proprietario",
            render: (row: EudrVerificationRow) => (
              <span className="text-slate-700">
                {row.owner_name ?? (
                  <span className="text-slate-400 text-xs italic">—</span>
                )}
              </span>
            ),
          },
        ] as DataManagementColumn<EudrVerificationRow>[])
      : []),
    {
      id: "stato",
      header: "Stato",
      render: (row) => {
        const status = getStatusLabel(row)
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
          onClick={() => pushParams({ tab: "analisi", page: "1" })}
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
          onClick={() => pushParams({ tab: "verifiche", vpage: "1" })}
        >
          Verifiche
        </Button>
      </div>

      {isAnalisi ? (
        <EudrAnalisiTable
          data={analyses}
          page={page}
          totalPages={totalPages}
          isAdmin={isAdmin}
        />
      ) : (
        <DataManagementTable<EudrVerificationRow>
          title="Verifiche preliminari EUDR"
          data={verifications}
          columns={columns}
          getRowId={(row) => row.id}
          searchPlaceholder="Cerca per nome commerciale..."
          searchMode="server"
          search={{
            value: vq,
            onChange: (next) => pushParams({ vq: next, vpage: "1" }),
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
              onChange={(e) => pushParams({ stato: e.target.value, vpage: "1" })}
            >
              <option value="all">Tutti gli stati</option>
              <option value="in_corso">In corso</option>
              <option value="conclusa">Concluse / Esenti</option>
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
                size="sm"
                className="text-[#967635] hover:bg-[#f3eee3]"
                onClick={() => handleOpen(row)}
              >
                Apri verifica
              </Button>
            </div>
          )}
        />
      )}
    </div>
  )
}


