'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  abortPendingUserRecoverySessionAction,
  completePasswordResetAction,
  getPasswordResetSessionContext,
} from '@/actions/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { AuthBrandedShell } from '@/components/auth/AuthBrandedShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { KeyRound, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function verifySession() {
      const { status } = await getPasswordResetSessionContext()
      if (cancelled) return

      if (status === 'not_eligible_pending') {
        await abortPendingUserRecoverySessionAction()
        router.replace('/auth/invito-non-valido')
        return
      }

      if (status === 'no_session' || status === 'not_reset_flow') {
        router.replace('/auth/recupero-non-valido')
        return
      }

      setSessionReady(true)
    }
    void verifySession()
    return () => {
      cancelled = true
    }
  }, [router])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await completePasswordResetAction(formData)
    setLoading(false)

    if (result?.error) {
      toast.error('Reset password', { description: result.error })
    }
  }

  if (!sessionReady) {
    return (
      <AuthBrandedShell>
        <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
            Verifica sessione di recupero…
          </CardContent>
        </Card>
      </AuthBrandedShell>
    )
  }

  return (
    <AuthBrandedShell>
      <Card className="w-full max-w-md border-slate-200/80 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-slate-900">Nuova password</CardTitle>
              <CardDescription className="text-slate-600">
                Stai completando il recupero password per un account già registrato sul portale.
              </CardDescription>
            </div>
          </div>
          <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
            <AlertTitle className="text-amber-950">Sicurezza</AlertTitle>
            <AlertDescription className="text-amber-900/90">
              Al termine verrai disconnesso: accedi di nuovo con la nuova password. Il link ricevuto via
              email ha validità limitata.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Nuova password</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma nuova password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Salvataggio...' : 'Conferma password'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-slate-500">
          Se il link è scaduto, richiedine uno nuovo dalla pagina &quot;Password dimenticata&quot; dal login.
        </CardFooter>
      </Card>
    </AuthBrandedShell>
  )
}
