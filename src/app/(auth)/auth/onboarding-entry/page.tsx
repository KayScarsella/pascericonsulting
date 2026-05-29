'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  continueOnboardingFromTicketAction,
  getOnboardingEntryStateAction,
  type OnboardingEntryState,
} from '@/actions/onboarding-entry'
import { ONBOARDING_PORTAL_TICKET_TTL_DAYS } from '@/lib/constants'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function OnboardingEntryPage() {
  const searchParams = useSearchParams()
  const ticket = useMemo(() => searchParams.get('t')?.trim() ?? '', [searchParams])
  const [state, setState] = useState<OnboardingEntryState | null>(null)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ticket) {
        setState({ status: 'invalid' })
        setLoading(false)
        return
      }
      const next = await getOnboardingEntryStateAction(ticket)
      if (!cancelled) {
        setState(next)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ticket])

  const onContinue = useCallback(async () => {
    if (!ticket) return
    setContinuing(true)
    setContinueError(null)
    const result = await continueOnboardingFromTicketAction(ticket)
    if (result.success) {
      window.location.href = result.redirectUrl
      return
    }
    setContinueError(result.error)
    if (result.code === 'already_onboarded') {
      setState({ status: 'already_onboarded' })
    } else if (result.code === 'expired') {
      setState({ status: 'expired' })
    } else if (result.code === 'invalid') {
      setState({ status: 'invalid' })
    }
    setContinuing(false)
  }, [ticket])

  const toolLabel =
    state?.status === 'ready' && state.toolName ? state.toolName : 'Pasceri Consulting'

  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Completa la registrazione</CardTitle>
          <CardDescription className="text-base text-slate-600">
            {loading
              ? 'Verifica del link in corso...'
              : state?.status === 'ready'
                ? `Accesso alla piattaforma ${toolLabel}.`
                : ' '}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          {loading && (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Attendere...
            </div>
          )}

          {!loading && state?.status === 'ready' && (
            <>
              <p>
                Per proteggere il tuo account, il link nella email può essere aperto più volte, ma
                l&apos;accesso alla piattaforma si attiva solo quando premi il pulsante qui sotto
                (evita problemi con Gmail o antivirus che aprono i link in automatico).
              </p>
              <p className="text-xs text-slate-500">
                Questo link resta valido per {ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni o fino al
                completamento della registrazione.
              </p>
              {continueError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">
                  {continueError}
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={continuing}
                onClick={() => void onContinue()}
              >
                {continuing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Accesso in corso...
                  </>
                ) : (
                  'Continua e accedi'
                )}
              </Button>
            </>
          )}

          {!loading && state?.status === 'already_onboarded' && (
            <p>La registrazione risulta già completata. Puoi accedere con le tue credenziali.</p>
          )}

          {!loading && state?.status === 'expired' && (
            <p>
              Questo link di invito è scaduto. Chiedi all&apos;amministratore del tool un nuovo
              invito sulla tua email.
            </p>
          )}

          {!loading && (state?.status === 'invalid' || !state) && (
            <p>
              Link non valido o già sostituito da un invito più recente. Usa l&apos;ultima email
              ricevuta o chiedi un nuovo invito.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:flex-1">
            <Link href="/login">Vai al login</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full sm:flex-1">
            <Link href="/">Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
