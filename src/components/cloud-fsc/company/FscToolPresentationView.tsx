'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  ClipboardList,
  Database,
  FileText,
  ImageIcon,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MODULES = [
  {
    icon: FileText,
    title: 'Documenti di gestione',
    description: 'Manuale FSC, politica, procedure e allegati certificazione.',
  },
  {
    icon: BookOpen,
    title: 'Documenti ente',
    description: 'Visura, M210, fatturato, certificato e documenti per l\'ente certificatore.',
  },
  {
    icon: ClipboardList,
    title: 'Autovalutazione ILO',
    description: 'Indicatori ILO e autovalutazione annuale della conformità.',
  },
  {
    icon: Users,
    title: 'Fornitori',
    description: 'Anagrafica fornitori certificati e allegati.',
  },
  {
    icon: UserCheck,
    title: 'Terzisti',
    description: 'Gestione terzisti e documentazione correlata.',
  },
  {
    icon: Database,
    title: 'Gruppi prodotto',
    description: 'Catalogo gruppi FSC attivi per la tua impresa.',
  },
  {
    icon: ImageIcon,
    title: 'Loghi',
    description: 'Registro loghi prodotto e promozionali FSC.',
  },
  {
    icon: TrendingUp,
    title: 'Movimentazioni bilancio',
    description: 'Monitoraggio movimentazioni e bilancio FSC (premium).',
  },
] as const

export function FscToolPresentationView() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <section className="space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#967635]">CLOUD FSC</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Il cruscotto digitale per la certificazione FSC
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-600">
          Centralizza documenti, fornitori, gruppi prodotto e autovalutazioni in un unico ambiente
          sicuro, pensato per imprese certificate e i loro team.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {MODULES.map((mod) => (
          <Card key={mod.title} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#967635]/10 text-[#967635]">
                  <mod.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{mod.title}</CardTitle>
                  <CardDescription className="mt-1">{mod.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Come iniziare</CardTitle>
          <CardDescription className="text-slate-600">
            Per accedere ai moduli devi essere associato a un&apos;impresa FSC su questo tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Contatta il titolare o l&apos;amministratore della tua azienda certificata.</li>
            <li>Chiedi di essere aggiunto al team CLOUD FSC dell&apos;impresa.</li>
            <li>Una volta aggiunto, ricarica questa pagina per accedere al cruscotto.</li>
          </ol>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={pending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            Verifica accesso
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
