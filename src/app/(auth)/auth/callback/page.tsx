'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { Card, CardContent } from '@/components/ui/card'
import {
  isInviteCallbackOtpType,
  persistAuthCallbackDebug,
  type InviteCallbackOtpType,
} from '@/lib/auth-callback-debug'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState('Completamento accesso in corso...')

  useEffect(() => {
    async function completeAuth() {
      async function failAndResetSession(
        fallbackMessage: string,
        errReason: 'invite' | 'recovery' = 'invite'
      ) {
        setMessage(fallbackMessage)
        await supabase.auth.signOut()
        const target =
          errReason === 'recovery' ? '/auth/recupero-non-valido' : '/auth/invito-non-valido'
        router.replace(target)
      }

      const url = new URL(window.location.href)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = url.searchParams.get('code')
      const linkType = url.searchParams.get('type') ?? hash.get('type')
      const tokenHash = url.searchParams.get('token_hash')
      const authError = url.searchParams.get('error') ?? hash.get('error')
      const authErrorDescription =
        url.searchParams.get('error_description') ?? hash.get('error_description')
      const accessToken = hash.get('access_token') ?? url.searchParams.get('access_token')
      const refreshToken = hash.get('refresh_token') ?? url.searchParams.get('refresh_token')
      const nextPath = linkType === 'recovery' ? '/auth/reset-password' : '/onboarding'

      const recordDebug = (extra?: { authError?: string | null; authErrorDescription?: string | null }) => {
        persistAuthCallbackDebug({
          at: new Date().toISOString(),
          hasCode: Boolean(code),
          hasTokenHash: Boolean(tokenHash),
          linkType,
          hasAccessToken: Boolean(accessToken && refreshToken),
          authError: extra?.authError ?? authError,
          authErrorDescription: extra?.authErrorDescription ?? authErrorDescription,
        })
      }

      if (authError) {
        const text = authErrorDescription
          ? decodeURIComponent(authErrorDescription.replace(/\+/g, ' '))
          : 'Link non valido o scaduto. Richiedi una nuova email.'
        recordDebug()
        await failAndResetSession(text, linkType === 'recovery' ? 'recovery' : 'invite')
        return
      }

      // Handle PKCE links by delegating to the server route that exchanges the code.
      if (code) {
        const nextParam = encodeURIComponent(nextPath)
        const separator = url.search ? '&' : '?'
        router.replace(`/callback${url.search}${separator}next=${nextParam}`)
        return
      }

      // Invite / magiclink / signup: token_hash in query (some Supabase redirects skip implicit hash).
      if (tokenHash && isInviteCallbackOtpType(linkType)) {
        const { error } = await supabase.auth.verifyOtp({
          type: linkType as InviteCallbackOtpType,
          token_hash: tokenHash,
        })
        if (error) {
          recordDebug({
            authError: error.name,
            authErrorDescription: error.message,
          })
          await failAndResetSession('Link non valido o scaduto. Richiedi un nuovo invito.')
          return
        }
        router.replace(nextPath)
        return
      }

      // Password recovery on this page (legacy links); prefer /auth/recovery-callback for new flows.
      if (tokenHash && linkType === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: tokenHash,
        })
        if (error) {
          recordDebug({
            authError: error.name,
            authErrorDescription: error.message,
          })
          await failAndResetSession('Link non valido o scaduto. Richiedi una nuova email.', 'recovery')
          return
        }
        router.replace(nextPath)
        return
      }

      // Implicit flow: tokens in URL hash (or query).
      if (!accessToken || !refreshToken) {
        recordDebug()
        await failAndResetSession('Link non valido o scaduto. Richiedi un nuovo invito.')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        recordDebug({
          authError: error.name,
          authErrorDescription: error.message,
        })
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
