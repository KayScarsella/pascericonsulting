'use client'

/**
 * Password-reset email links must land here (see requestPasswordResetAction redirectTo).
 * Keeps PKCE `code` exchange separate from invite/onboarding so `next` is always reset-password.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const nextPath = '/auth/reset-password'

export default function RecoveryCallbackPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState('Completamento recupero password in corso...')

  useEffect(() => {
    async function completeRecovery() {
      async function failAndResetSession(fallbackMessage: string) {
        setMessage(fallbackMessage)
        await supabase.auth.signOut()
        router.replace('/auth/auth-code-error')
      }

      const url = new URL(window.location.href)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = url.searchParams.get('code')
      const recoveryType = url.searchParams.get('type') ?? hash.get('type')
      const tokenHash = url.searchParams.get('token_hash')
      const authError = url.searchParams.get('error') ?? hash.get('error')
      const authErrorDescription =
        url.searchParams.get('error_description') ?? hash.get('error_description')

      if (authError) {
        const text = authErrorDescription
          ? decodeURIComponent(authErrorDescription.replace(/\+/g, ' '))
          : 'Link non valido o scaduto. Richiedi una nuova email.'
        await failAndResetSession(text)
        return
      }

      if (code) {
        const nextParam = encodeURIComponent(nextPath)
        const separator = url.search ? '&' : '?'
        router.replace(`/callback${url.search}${separator}next=${nextParam}`)
        return
      }

      if (tokenHash && recoveryType === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (error) {
          await failAndResetSession('Link non valido o scaduto. Richiedi una nuova email.')
          return
        }
        router.replace(nextPath)
        return
      }

      const accessToken = hash.get('access_token') ?? url.searchParams.get('access_token')
      const refreshToken = hash.get('refresh_token') ?? url.searchParams.get('refresh_token')

      if (!accessToken || !refreshToken) {
        await failAndResetSession('Link non valido o scaduto. Richiedi una nuova email.')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        await failAndResetSession('Sessione non valida. Richiedi una nuova email.')
        return
      }

      router.replace(nextPath)
    }

    void completeRecovery()
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-md border bg-white px-6 py-4 text-sm text-slate-700 shadow-sm">
        {message}
      </div>
    </div>
  )
}
