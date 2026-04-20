'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { requestPasswordResetAction } from '@/actions/auth'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await requestPasswordResetAction(formData)
    setLoading(false)

    if (result?.error) {
      toast.error('Recupero password', { description: result.error })
      return
    }

    toast.success('Recupero password', {
      description: result?.message ?? "Se l'email e' registrata, riceverai un link.",
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Password dimenticata</CardTitle>
          <CardDescription>
            Inserisci la tua email: se l&apos;account esiste, riceverai un link per reimpostare la password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="m@example.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Invio in corso...' : 'Invia link di recupero'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-xs text-slate-500">
            <Link href="/login" className="underline underline-offset-2">
              Torna al login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
