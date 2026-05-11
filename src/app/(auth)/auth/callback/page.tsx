'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { Card, CardContent } from '@/components/ui/card'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState('Completamento accesso in corso...')

  useEffect(() => {
    async function completeAuth() {
      async function failAndResetSession(fallbackMessage: string, errReason: 'invite' | 'recovery' = 'invite') {
        setMessage(fallbackMessage)
        await supabase.auth.signOut()
        const target =
          errReason === 'recovery' ? '/auth/recupero-non-valido' : '/auth/invito-non-valido'
        router.replace(target)
      }

      const url = new URL(window.location.href)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = url.searchParams.get('code')
      const recoveryType = url.searchParams.get('type') ?? hash.get('type')
      const tokenHash = url.searchParams.get('token_hash')
      const authError = url.searchParams.get('error') ?? hash.get('error')
      const authErrorDescription =
        url.searchParams.get('error_description') ?? hash.get('error_description')
      const nextPath = recoveryType === 'recovery' ? '/auth/reset-password' : '/onboarding'

      if (authError) {
        const text = authErrorDescription
          ? decodeURIComponent(authErrorDescription.replace(/\+/g, ' '))
          : 'Link non valido o scaduto. Richiedi una nuova email.'
        await failAndResetSession(text, recoveryType === 'recovery' ? 'recovery' : 'invite')
        return
      }

      // Handle PKCE links by delegating to the server route that exchanges the code.
      if (code) {
        const nextParam = encodeURIComponent(nextPath)
        const separator = url.search ? '&' : '?'
        router.replace(`/callback${url.search}${separator}next=${nextParam}`)
        return
      }

      // Handle email links that carry token_hash + type in query params.
      if (tokenHash && recoveryType === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (error) {
          await failAndResetSession('Link non valido o scaduto. Richiedi una nuova email.', 'recovery')
          return
        }
        router.replace(nextPath)
        return
      }

      // Handle implicit invite links carrying tokens in URL hash.
      // Some providers/templates can return tokens in query params instead.
      const accessToken = hash.get('access_token') ?? url.searchParams.get('access_token')
      const refreshToken = hash.get('refresh_token') ?? url.searchParams.get('refresh_token')

      if (!accessToken || !refreshToken) {
        await failAndResetSession('Link non valido o scaduto. Richiedi un nuovo invito.')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        await failAndResetSession('Sessione non valida. Richiedi un nuovo invito.')
        return
      }

      router.replace(nextPath)
    }

    void completeAuth()
  }, [router, supabase])

  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
          {message}
        </CardContent>
      </Card>
    </AuthBrandedShell>
  )
}
