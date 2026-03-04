// src/lib/tool-auth.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { Database } from "@/types/supabase"

// Definiamo i ruoli possibili in ordine di "potere"
export type ToolRole = 'admin' | 'premium' | 'standard'

// Questa funzione è "cachata": deduplica le richieste nello stesso rendering
export const getToolAccess = cache(async (toolId: string) => {
  const cookieStore = await cookies()
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  )

  // 1. Verifica Utente
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/login")
  }

  // 2. Verifica Ruolo nel DB
  const { data: access, error } = await supabase
    .from("tool_access")
    .select("role")
    .eq("user_id", user.id)
    .eq("tool_id", toolId)
    .single()

  if (error || !access) {
    // Nessun accesso trovato -> Via alla dashboard
    redirect("/landingPage")
  }

  return {
    role: access.role as ToolRole, // 'admin' | 'premium' | 'standard'
    userId: user.id
  }
})