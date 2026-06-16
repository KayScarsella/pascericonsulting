import { listFscIloAssessments } from '@/actions/fsc/ilo'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscIloAssessmentsTable } from '@/components/cloud-fsc/ilo/FscIloAssessmentsTable'
import { FscIloCreateDialog } from '@/components/cloud-fsc/ilo/FscIloCreateDialog'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'

export async function FscIloListView() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.success || !companyCtx.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {companyCtx.error ?? 'Impossibile caricare i dati dell\'impresa FSC.'}
      </div>
    )
  }

  const assessments = await listFscIloAssessments()
  const canEdit = companyCtx.data.membership.can_edit

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Autovalutazione lavoratori (ILO)
          </h1>
          <p className="text-slate-500">
            Gestisci le autovalutazioni annuali sui Diritti Fondamentali del Lavoro FSC per{' '}
            <span className="font-medium text-slate-700">
              {companyCtx.data.company.ragione_sociale}
            </span>
            . Aggiornamento richiesto ogni anno; promemoria dopo 10 mesi dall&apos;ultima
            compilazione.
          </p>
        </div>
        <FscIloCreateDialog assessments={assessments} canEdit={canEdit} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Come funziona</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Un&apos;autovalutazione per ogni anno di riferimento.</li>
          <li>
            Usa <strong>Modifica</strong> per compilare il questionario; documenti e archivio
            dalle azioni sulla riga.
          </li>
          <li>Esporta o carica Word e PDF, quindi segna l&apos;anno come completato.</li>
          <li>
            Per un nuovo anno puoi duplicare le risposte da un anno precedente durante la
            creazione o dalla pagina di compilazione.
          </li>
        </ul>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Autovalutazioni per anno</h2>
        <FscIloAssessmentsTable assessments={assessments} canEdit={canEdit} />
      </section>
    </div>
  )
}
