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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completa il tuo account</CardTitle>
          <CardDescription>
            Per motivi di sicurezza devi impostare una password personale e indicare il tuo nome.
          </CardDescription>
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
            <div className="rounded-md border p-3">
              <p className="mb-3 text-sm font-medium text-slate-700">Informazioni aggiuntive (opzionali)</p>
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
                    <Label htmlFor="citta">Citta'</Label>
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
                  <Label htmlFor="attivita">Attivita'</Label>
                  <Input id="attivita" name="attivita" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Conferma e continua'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-slate-500">
          <div className="flex w-full items-center justify-between gap-2">
            <span>Dopo questo passaggio potrai accedere normalmente con email e password.</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Uscita...' : 'Esci e cambia account'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
