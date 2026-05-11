'use client'

import { useState } from 'react'
import { completeOnboardingAction } from '@/actions/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { ChevronDown, UserPlus } from 'lucide-react'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await completeOnboardingAction(formData)
    setLoading(false)

    if (result?.error) {
      toast.error('Completa registrazione', { description: result.error })
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <UserPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-slate-900">Completa la registrazione</CardTitle>
              <CardDescription className="text-slate-600">
                Imposta una password personale e il tuo nome. I campi sotto &quot;Dettagli
                aggiuntivi&quot; sono facoltativi: puoi compilarli ora o lasciarli vuoti.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome</Label>
              <Input id="fullName" name="fullName" placeholder="Il tuo nome" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nuova password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
            </div>

            <details className="group rounded-lg border border-slate-200 bg-slate-50/60 open:bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg p-3 text-sm font-medium text-slate-800 outline-none ring-offset-2 marker:content-none focus-visible:ring-2 focus-visible:ring-slate-400 [&::-webkit-details-marker]:hidden">
                <span>Dettagli aggiuntivi (opzionali)</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t border-slate-100 p-3 pt-3">
                <p className="mb-3 text-xs text-slate-500">
                  Ragione sociale, contatti e altro: utili per l&apos;amministrazione ma non obbligatori per
                  iniziare.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" name="username" placeholder="username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ragioneSociale">Ragione sociale</Label>
                    <Input id="ragioneSociale" name="ragioneSociale" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfPartitaIva">CF / Partita IVA</Label>
                    <Input id="cfPartitaIva" name="cfPartitaIva" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="indirizzo">Indirizzo</Label>
                    <Input id="indirizzo" name="indirizzo" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="cap">CAP</Label>
                      <Input id="cap" name="cap" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="citta">Citta&apos;</Label>
                      <Input id="citta" name="citta" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provincia">Provincia</Label>
                      <Input id="provincia" name="provincia" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recapitoTelefonico">Recapito telefonico</Label>
                    <Input id="recapitoTelefonico" name="recapitoTelefonico" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sitoInternet">Sito internet</Label>
                    <Input id="sitoInternet" name="sitoInternet" placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settoreMerceologico">Settore merceologico</Label>
                    <Input id="settoreMerceologico" name="settoreMerceologico" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="attivita">Attivita&apos;</Label>
                    <Input id="attivita" name="attivita" />
                  </div>
                </div>
              </div>
            </details>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Conferma e continua'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center sm:max-w-[70%] sm:text-left">
            Dopo questo passaggio potrai accedere con email e password dalla pagina di login.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 self-center sm:self-auto"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Uscita...' : 'Esci e cambia account'}
          </Button>
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
