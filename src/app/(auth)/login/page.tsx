// page.tsx
'use client'

import { useState } from 'react'
// Rimuovi useRouter, non serve per il successo se gestito dal server
// import { useRouter } from 'next/navigation' 
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { loginAction } from '@/actions/auth'

export default function LoginPage() {
  // const router = useRouter() // Non serve più
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await loginAction(formData)
    setLoading(false)

    if (result?.error) {
      toast.error("Errore Login", {
        description: result.error
      })
    } 
    // NESSUN ELSE: Se è andato tutto bene, il server sta già facendo il redirect.
    // Non fare router.push o router.refresh qui, causano l'errore del token!
  }

  return (
    // ... il resto del tuo JSX rimane identico ...
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Accedi</CardTitle>
          <CardDescription>Inserisci le tue credenziali per entrare.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="m@example.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-center text-gray-500 w-full">
                Accesso su invito — contatta un amministratore se ti serve un account.
            </p>
        </CardFooter>
      </Card>
    </div>
  )
}