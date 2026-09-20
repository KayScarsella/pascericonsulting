import Link from 'next/link'
import { getBoscologCompanyContext } from '@/actions/boscolog/company'
import { BoscologCompanyForm } from '@/components/boscolog/company/BoscologCompanyForm'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default async function BoscoLogAziendaPage() {
  const ctx = await getBoscologCompanyContext()

  if (!ctx.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Azienda</h1>
        <p className="text-red-600">{ctx.error ?? 'Errore caricamento'}</p>
      </div>
    )
  }

  if (ctx.needsSetup || !ctx.company) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Azienda</h1>
          <p className="text-slate-500">
            Configura i dati della tua impresa. Verranno usati come mittente nei DDT, etichette,
            report e documenti generati.
          </p>
        </div>
        <BoscologCompanyForm mode="create" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Azienda</h1>
        <p className="text-slate-500">
          I dati inseriti qui vengono usati come mittente nei DDT, etichette, report e documenti
          generati.
        </p>
      </div>
      {!ctx.canEdit ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Solo lettura</AlertTitle>
          <AlertDescription>
            Non hai permessi di modifica. Contatta un titolare dell&apos;impresa.
          </AlertDescription>
        </Alert>
      ) : null}
      <BoscologCompanyForm
        mode="edit"
        company={ctx.company}
        canEdit={ctx.canEdit}
        logoUrl={ctx.logoUrl}
      />
      <p className="text-sm text-slate-500">
        Gestisci le anagrafiche fornitori/acquirenti in{' '}
        <Link href="/boscolog/anagrafiche" className="font-medium text-slate-800 underline">
          Anagrafiche
        </Link>
        .
      </p>
    </div>
  )
}
