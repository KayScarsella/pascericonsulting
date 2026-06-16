import { Suspense } from 'react'
import { listFscCompanyProductGroups } from '@/actions/fsc/product-groups'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscProductGroupCreateButton } from '@/components/cloud-fsc/product-groups/FscProductGroupCreateButton'
import { FscProductGroupsFilterBar } from '@/components/cloud-fsc/product-groups/FscProductGroupsFilterBar'
import { FscProductGroupsTable } from '@/components/cloud-fsc/product-groups/FscProductGroupsTable'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import type { FscProductGroupStatusFilter } from '@/lib/fsc/product-groups'
import { getToolAccess } from '@/lib/tool-auth'

type FscProductGroupsListViewProps = {
  searchParams?: { q?: string; status?: string }
}

export async function FscProductGroupsListView({ searchParams }: FscProductGroupsListViewProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.success || !companyCtx.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {companyCtx.error ?? "Impossibile caricare i dati dell'impresa FSC."}
      </div>
    )
  }

  const statusParam = searchParams?.status
  const statusFilter: FscProductGroupStatusFilter =
    statusParam && ['active', 'inactive', 'all'].includes(statusParam)
      ? (statusParam as FscProductGroupStatusFilter)
      : 'active'

  const groups = await listFscCompanyProductGroups({
    search: searchParams?.q,
    status: statusFilter,
  })

  const canEdit = companyCtx.data.membership.can_edit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gruppi di prodotto</h1>
          <p className="text-slate-500">
            Gruppi FSC attivi, claim e addendum per{' '}
            <span className="font-medium text-slate-700">
              {companyCtx.data.company.ragione_sociale}
            </span>
            .
          </p>
        </div>
        <FscProductGroupCreateButton canEdit={canEdit} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Come funziona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Attiva gruppi dal catalogo FSC ufficiale (ricerca o menu a tendina).</li>
          <li>Associa claim (100%, Mix, Recycled), specie opzionale e input necessari.</li>
          <li>All&apos;attivazione si apre la tabella addendum da compilare.</li>
          <li>Disattiva un gruppo senza eliminarlo dallo storico.</li>
        </ul>
      </div>

      <Suspense fallback={<div className="h-10 animate-pulse rounded bg-slate-100" />}>
        <FscProductGroupsFilterBar />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Gruppi ({groups.length})
        </h2>
        <FscProductGroupsTable groups={groups} canEdit={canEdit} />
      </section>
    </div>
  )
}
