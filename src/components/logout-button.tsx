"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient as createBrowserClient } from "@/utils/supabase/client"

export default function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      await fetch("/api/auth/signout", { method: "POST" })
      router.push("/")
    } catch (err) {
      console.error("Errore logout:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleSignOut} disabled={loading} variant="outline">
      Esci
    </Button>
  )
}
