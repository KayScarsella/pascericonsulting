import { Suspense } from 'react'
import { listFscSuppliers } from '@/actions/fsc/suppliers'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscPartnersFilterBar } from '@/components/cloud-fsc/partners/FscPartnersFilterBar'
import { FscSupplierCreateButton } from '@/components/cloud-fsc/partners/FscSupplierCreateButton'
import { FscSuppliersTable } from '@/components/cloud-fsc/partners/FscSuppliersTable'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscSupplierStatus } from '@/types/fsc'

type FscSuppliersListViewProps = {
  searchParams?: { q?: string; status?: string }
}

export async function FscSuppliersListView({ searchParams }: FscSuppliersListViewProps) {
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
  const statusFilter =
    statusParam && ['active', 'inactive', 'reactivated'].includes(statusParam)
      ? (statusParam as FscSupplierStatus)
      : 'all'

  const suppliers = await listFscSuppliers({
    search: searchParams?.q,
    status: statusFilter,
  })

  const canEdit = companyCtx.data.membership.can_edit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fornitori</h1>
          <p className="text-slate-500">
            Elenco fornitori, certificati, claim prodotto e controlli periodici per{' '}
            <span className="font-medium text-slate-700">
              {companyCtx.data.company.ragione_sociale}
            </span>
            .
          </p>
        </div>
        <FscSupplierCreateButton canEdit={canEdit} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Come funziona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Registra fornitori con certificato, validità e claim (max 2 su 3).</li>
          <li>Carica visura, due diligence e dichiarazioni dal dettaglio.</li>
          <li>Disattiva un fornitore senza eliminarlo dallo storico.</li>
          <li>Ricevi alert su scadenza certificato e controllo periodico.</li>
        </ul>
      </div>

      <Suspense fallback={<div className="h-10 animate-pulse rounded bg-slate-100" />}>
        <FscPartnersFilterBar />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Fornitori ({suppliers.length})
        </h2>
        <FscSuppliersTable suppliers={suppliers} canEdit={canEdit} />
      </section>
    </div>
  )
}
