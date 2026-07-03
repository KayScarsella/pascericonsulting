import { Suspense } from 'react'
import { listFscLogos } from '@/actions/fsc/logos'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscLogoCreateButton } from '@/components/cloud-fsc/loghi/FscLogoCreateButton'
import { FscLogosFilterBar } from '@/components/cloud-fsc/loghi/FscLogosFilterBar'
import { FscLogosTable } from '@/components/cloud-fsc/loghi/FscLogosTable'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getFscLogoTypeLabel } from '@/lib/fsc/logos'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscLogoType } from '@/types/fsc'

type FscLogosListViewProps = {
  searchParams?: { q?: string; type?: string }
}

export async function FscLogosListView({ searchParams }: FscLogosListViewProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.success || !companyCtx.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {companyCtx.error ?? "Impossibile caricare i dati dell'impresa FSC."}
      </div>
    )
  }

  const typeParam = searchParams?.type
  const typeFilter: FscLogoType =
    typeParam === 'promotional' ? 'promotional' : 'product'

  const logos = await listFscLogos({
    type: typeFilter,
    search: searchParams?.q,
  })

  const canEdit = companyCtx.data.membership.can_edit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loghi</h1>
          <p className="text-slate-500">
            Archivio loghi prodotto e promozionali per{' '}
            <span className="font-medium text-slate-700">
              {companyCtx.data.company.ragione_sociale}
            </span>
            .
          </p>
        </div>
        <FscLogoCreateButton canEdit={canEdit} defaultType={typeFilter} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Come funziona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Registra loghi di prodotto o promozionali con codice progressivo automatico.</li>
          <li>Carica l&apos;email di approvazione (PDF) e la grafica approvata.</li>
          <li>Aggiungi note descrittive per identificare ogni approvazione.</li>
          <li>L&apos;archivio è ordinato cronologicamente per tipo di logo.</li>
        </ul>
      </div>

      <Suspense fallback={<div className="h-10 animate-pulse rounded bg-slate-100" />}>
        <FscLogosFilterBar />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {getFscLogoTypeLabel(typeFilter)} ({logos.length})
        </h2>
        <FscLogosTable logos={logos} canEdit={canEdit} />
      </section>
    </div>
  )
}
