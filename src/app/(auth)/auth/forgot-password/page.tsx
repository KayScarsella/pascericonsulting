'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { MailCheck, KeyRound } from 'lucide-react'
import { requestPasswordResetAction } from '@/actions/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await requestPasswordResetAction(formData)
    setLoading(false)

    if (result?.error) {
      toast.error('Recupero password', { description: result.error })
      return
    }

    toast.success('Richiesta registrata', {
      description:
        result?.message ??
        "Se l'operazione e' consentita per questo account, riceverai un'email con il link.",
    })
  }

  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-slate-900">Password dimenticata</CardTitle>
              <CardDescription className="text-slate-600">
                Solo per account che hanno già completato la registrazione sul portale Pasceri Consulting.
              </CardDescription>
            </div>
          </div>
          <Alert className="border-sky-200 bg-sky-50/90 text-sky-950">
            <MailCheck className="h-4 w-4 text-sky-700" />
            <AlertTitle className="text-sky-950">Invito scaduto o mai completato?</AlertTitle>
            <AlertDescription className="text-sky-900/90">
              Non usare questa pagina: chiedi un{' '}
              <strong>nuovo invito</strong> all&apos;amministratore. Qui trovi indicazioni utili:{' '}
              <Link href="/auth/invito-non-valido" className="font-medium underline underline-offset-2">
                link di invito non valido
              </Link>
              .
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email dell&apos;account</Label>
              <Input id="email" name="email" type="email" placeholder="nome@azienda.it" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Invio in corso...' : 'Invia link di recupero'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          <p className="text-center text-xs text-slate-500">
            <Link href="/login" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
              Torna al login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
