'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [message, setMessage] = useState('Completamento accesso in corso...')

  useEffect(() => {
    async function completeAuth() {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const code = url.searchParams.get('code')
      const recoveryType = url.searchParams.get('type') ?? hash.get('type')
      const tokenHash = url.searchParams.get('token_hash')
      const nextPath = recoveryType === 'recovery' ? '/auth/reset-password' : '/onboarding'

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
          setMessage('Link non valido o scaduto. Richiedi una nuova email.')
          router.replace('/auth/auth-code-error')
          return
        }
        router.replace(nextPath)
        return
      }

      // Handle implicit invite links carrying tokens in URL hash.
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')

      if (!accessToken || !refreshToken) {
        setMessage('Link non valido o scaduto. Richiedi un nuovo invito.')
        router.replace('/auth/auth-code-error')
        return
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (error) {
        setMessage('Sessione non valida. Richiedi un nuovo invito.')
        router.replace('/auth/auth-code-error')
        return
      }

      router.replace(nextPath)
    }

    void completeAuth()
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-md border bg-white px-6 py-4 text-sm text-slate-700 shadow-sm">
        {message}
      </div>
    </div>
  )
}
