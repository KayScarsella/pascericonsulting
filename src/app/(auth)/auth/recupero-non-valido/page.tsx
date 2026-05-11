import Link from 'next/link'
import { KeyRound, MailWarning } from 'lucide-react'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function RecuperoNonValidoPage() {
  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900">
              <MailWarning className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-xl text-slate-900">Recupero password non disponibile</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Il link nell&apos;email non è stato accettato (scaduto, già usato o sessione non valida).
              </CardDescription>
            </div>
          </div>
          <Alert className="border-slate-200 bg-slate-50">
            <KeyRound className="h-4 w-4 text-slate-600" />
            <AlertTitle className="text-slate-900">Cosa fare</AlertTitle>
            <AlertDescription className="text-slate-700">
              Richiedi un nuovo link dalla pagina dedicata. Se avevi già aperto un link valido in questo
              browser, prova &quot;Continua reset password&quot;. Il recupero è solo per account già
              registrati sul portale.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2 pt-0">
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">Richiedi nuovo link</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/auth/reset-password">Continua reset password</Link>
          </Button>
          <Button asChild variant="outline" className="w-full border-slate-300 bg-white/80">
            <Link href="/login">Vai al login</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full text-slate-600">
            <Link href="/">Torna alla home</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
