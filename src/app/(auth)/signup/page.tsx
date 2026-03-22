import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Accesso su invito</CardTitle>
          <CardDescription>
            Non è possibile creare un account autonomamente. Un amministratore del tool deve invitarti
            per email: riceverai un link per impostare la password e accedere.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            In alternativa, un admin può invitarti dal pannello gestione utenti del tool (richiede la
            chiave di servizio configurata sul server).
          </p>
          <p className="text-xs text-slate-500">
            In Supabase: Authentication → disattiva &quot;Allow new users to sign up&quot; e mantieni
            attiva la conferma email.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/login">Vai al login</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Torna alla home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
