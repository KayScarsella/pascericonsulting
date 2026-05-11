import Link from 'next/link'
import { MailPlus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'

export default function SignupPage() {
  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <MailPlus className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-xl text-slate-900">Accesso su invito</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Non è possibile creare un account autonomamente. Un amministratore del tool deve
                invitarti per email: riceverai un link per impostare la password e accedere.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            In alternativa, un admin può invitarti dal pannello gestione utenti del tool (richiede la
            chiave di servizio configurata sul server).
          </p>
          <p className="text-xs text-slate-500">
            In Supabase: Authentication → disattiva &quot;Allow new users to sign up&quot; e mantieni
            attiva la conferma email.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="w-full sm:flex-1">
            <Link href="/login">Vai al login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full border-slate-300 bg-white/80 sm:flex-1">
            <Link href="/">Torna alla home</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
