'use client'

import { useEffect, useState } from 'react'
import { readAuthCallbackDebug, type AuthCallbackDebugInfo } from '@/lib/auth-callback-debug'

/**
 * Shown to admins/support on invito-non-valido when a recent callback attempt was recorded.
 * Helps distinguish Supabase verify errors vs missing tokens in the app callback.
 */
export function AuthCallbackDebugHint() {
  const [debug, setDebug] = useState<AuthCallbackDebugInfo | null>(null)

  useEffect(() => {
    const stored = readAuthCallbackDebug()
    if (stored) {
      setDebug(stored)
      return
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') === 'pkce_exchange_failed') {
      setDebug({
        at: new Date().toISOString(),
        hasCode: true,
        hasTokenHash: false,
        linkType: null,
        hasAccessToken: false,
        authError: 'pkce_exchange_failed',
        authErrorDescription:
          'Scambio sessione PKCE fallito sul server (cookie o code già usato).',
      })
    }
  }, [])

  if (!debug) return null

  const lines = [
    debug.authError && `Errore Auth: ${debug.authError}`,
    debug.authErrorDescription && `Dettaglio: ${debug.authErrorDescription}`,
    debug.linkType && `Tipo link: ${debug.linkType}`,
    debug.hasCode && 'Ricevuto parametro code (PKCE)',
    debug.hasTokenHash && 'Ricevuto token_hash (verifyOtp)',
    debug.hasAccessToken && 'Ricevuti token in URL (setSession)',
    !debug.hasCode &&
      !debug.hasTokenHash &&
      !debug.hasAccessToken &&
      !debug.authError &&
      'Nessun token/code in URL — spesso link già consumato da antivirus o prefetch email',
  ].filter(Boolean) as string[]

  if (lines.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950">
      <p className="font-medium">Dettaglio tecnico (ultimo tentativo)</p>
      <p className="mt-1 text-amber-900/80">{new Date(debug.at).toLocaleString('it-IT')}</p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-amber-900/70">
        Se usi Gmail o posta aziendale, prova «Copia link» dalla mail più recente e incollalo nel
        browser, oppure chiedi un nuovo reinvio e clicca entro pochi minuti.
      </p>
    </div>
  )
}
