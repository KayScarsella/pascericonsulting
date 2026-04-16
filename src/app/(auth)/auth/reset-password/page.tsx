'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { completePasswordResetAction } from '@/actions/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Imposta una nuova password</CardTitle>
          <CardDescription>
            Per sicurezza, dopo il reset verrai disconnesso e dovrai accedere con la nuova password.
          </CardDescription>
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
          Questo link e' monouso: se scade, richiedi una nuova email di recupero.
        </CardFooter>
      </Card>
    </div>
  )
}
