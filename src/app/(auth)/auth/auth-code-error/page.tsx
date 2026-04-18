import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link non valido o scaduto</CardTitle>
          <CardDescription>
            Non e&apos; stato possibile completare l&apos;accesso dal link ricevuto via email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            Richiedi un nuovo invito oppure usa la procedura di recupero password se l&apos;account
            esiste gia&apos;.
          </p>
          <p className="text-slate-500">
            Se avevi gia&apos; aperto un link di recupero password valido in questo browser, la
            sessione puo&apos; essere ancora attiva: in quel caso &quot;Torna alla home&quot; ti
            reindirizza alla pagina per impostare la nuova password (comportamento di sicurezza).
            Usa il pulsante sotto se vuoi continuare il reset senza riaprire l&apos;email.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href="/auth/reset-password">Continua recupero password</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/auth/forgot-password">Richiedi un nuovo link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
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
