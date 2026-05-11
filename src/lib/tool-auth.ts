// src/lib/tool-auth.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { Database } from "@/types/supabase"
import { isOnboardingComplete } from "@/lib/onboarding"

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

  const onboardingComplete = await isOnboardingComplete()
  if (!onboardingComplete) {
    redirect("/onboarding")
  }

  // 2. Verifica ruolo e stato tool (inactive => solo admin sulle route)
  const { data: access, error } = await supabase
    .from("tool_access")
    .select(`
      role,
      tools!inner (
        is_active
      )
    `)
    .eq("user_id", user.id)
    .eq("tool_id", toolId)
    .single()

  if (error || !access) {
    redirect("/landingPage")
  }

  const tool = access.tools as { is_active: boolean | null } | null
  const isToolActive = tool?.is_active === true
  const role = access.role as ToolRole

  if (!isToolActive && role !== "admin") {
    redirect("/landingPage")
  }

  return {
    role,
    userId: user.id,
  }
})

/** Throws if user is not admin for the tool (for server actions that return { error } instead of redirect). */
export async function requireToolAdmin(toolId: string): Promise<void> {
  const { role } = await getToolAccess(toolId)
  if (role !== 'admin') {
    throw new Error('Non autorizzato: servono permessi admin')
  }
}