// src/lib/tool-auth.ts
import { redirect } from "next/navigation"
import { cache } from "react"
import { isOnboardingComplete } from "@/lib/onboarding"
import { getSessionContext } from "@/lib/session-context"

// Definiamo i ruoli possibili in ordine di "potere"
export type ToolRole = "admin" | "premium" | "tool" | "standard"

// Questa funzione è "cachata": deduplica le richieste nello stesso rendering
export const getToolAccess = cache(async (toolId: string) => {
  const session = await getSessionContext()
  if (!session) {
    redirect("/login")
  }

  // Enforced here so proxy can skip the profiles round-trip on tool routes.
  if (session.profile?.must_reset_password) {
    redirect("/auth/reset-password")
  }

  const onboardingComplete = await isOnboardingComplete()
  if (!onboardingComplete) {
    redirect("/onboarding")
  }

  const { user, supabase } = session

  // 2. Verifica ruolo e stato tool (inactive = anteprima; accesso per chi ha tool_access)
  const { data: access, error } = await supabase
    .from("tool_access")
    .select(
      `
      role,
      tools!inner (
        is_active
      )
    `
    )
    .eq("user_id", user.id)
    .eq("tool_id", toolId)
    .single()

  if (error || !access) {
    redirect("/landingPage")
  }

  const tool = access.tools as { is_active: boolean | null } | null
  const isToolActive = tool?.is_active === true
  const role = access.role as ToolRole

  return {
    role,
    userId: user.id,
    isToolActive,
  }
})

/** Throws if user is not admin for the tool (for server actions that return { error } instead of redirect). */
export async function requireToolAdmin(toolId: string): Promise<void> {
  const { role } = await getToolAccess(toolId)
  if (role !== "admin") {
    throw new Error("Non autorizzato: servono permessi admin")
  }
}
