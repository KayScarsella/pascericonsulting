import { Suspense } from 'react'
import { listFscSubcontractors } from '@/actions/fsc/subcontractors'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscPartnersFilterBar } from '@/components/cloud-fsc/partners/FscPartnersFilterBar'
import { FscSubcontractorCreateButton } from '@/components/cloud-fsc/partners/FscSubcontractorCreateButton'
import { FscSubcontractorsTable } from '@/components/cloud-fsc/partners/FscSubcontractorsTable'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscSupplierStatus } from '@/types/fsc'

type FscSubcontractorsListViewProps = {
  searchParams?: { q?: string; status?: string }
}

export async function FscSubcontractorsListView({
  searchParams,
}: FscSubcontractorsListViewProps) {
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

  const subcontractors = await listFscSubcontractors({
    search: searchParams?.q,
    status: statusFilter,
  })

  const canEdit = companyCtx.data.membership.can_edit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Terzisti</h1>
          <p className="text-slate-500">
            Terzisti certificati o non certificati, lavorazioni e rischio CoC per{' '}
            <span className="font-medium text-slate-700">
              {companyCtx.data.company.ragione_sociale}
            </span>
            .
          </p>
        </div>
        <FscSubcontractorCreateButton canEdit={canEdit} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Come funziona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Indica se il terzista è certificato FSC o meno.</li>
          <li>Per i certificati: numero e validità certificato + allegato certificato.</li>
          <li>Per i non certificati: accordo di conto lavorazione.</li>
          <li>Segnala rischio CoC e frequenza controlli periodici.</li>
        </ul>
      </div>

      <Suspense fallback={<div className="h-10 animate-pulse rounded bg-slate-100" />}>
        <FscPartnersFilterBar />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Terzisti ({subcontractors.length})
        </h2>
        <FscSubcontractorsTable subcontractors={subcontractors} canEdit={canEdit} />
      </section>
    </div>
  )
}
