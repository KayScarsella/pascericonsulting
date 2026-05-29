import Link from 'next/link'
import { Mail, ShieldAlert, UserRound } from 'lucide-react'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { AuthCallbackDebugHint } from '@/components/auth/AuthCallbackDebugHint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AUTH_EMAIL_OTP_EXPIRATION_HINT } from '@/lib/constants'

export default function InvitoNonValidoPage() {
  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-800">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-xl text-slate-900">Link di invito non più valido</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Il link è scaduto, è già stato usato oppure non è più accettato dal sistema.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p className="font-medium text-slate-800">Passi consigliati</p>
          <ul className="list-inside list-disc space-y-2 leading-relaxed">
            <li>
              Usa <strong>solo l&apos;ultima email</strong> ricevuta (reinvio con link aggiornato); i link
              precedenti non funzionano più.
            </li>
            <li>
              Con Gmail o posta aziendale, alcuni sistemi aprono il link in automatico e lo rendono
              monouso: prova a <strong>copiare il link</strong> dalla mail e incollarlo nel browser, oppure
              clicca entro pochi minuti dalla ricezione.
            </li>
            <li>Controlla spam e posta indesiderata per un invito recente.</li>
            <li>
              Scrivi all&apos;<strong>amministratore del tool</strong> e chiedi un <strong>nuovo invito</strong>{' '}
              sullo stesso indirizzo email.
            </li>
          </ul>
          <p className="text-xs text-slate-500">{AUTH_EMAIL_OTP_EXPIRATION_HINT}</p>
          <AuthCallbackDebugHint />
          <div className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-600">
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden />
              Sei un amministratore?
            </span>
            <span className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Da Master → Supervisione email inviti (colonna «Stato invito») o Gestione utenti: reinvio
              quando il link porta è scaduto o l&apos;email non è stata consegnata.
            </span>
          </div>
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
