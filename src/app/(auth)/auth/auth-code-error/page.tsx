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
            Non e' stato possibile completare l'accesso dal link ricevuto via email.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Richiedi un nuovo invito oppure usa la procedura di recupero password se l'account esiste gia'.
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
