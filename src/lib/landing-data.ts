import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import type { Database } from "@/types/supabase"

export type LandingToolRow = Pick<
  Database["public"]["Tables"]["tools"]["Row"],
  "name" | "description" | "is_active" | "base_path"
>

export type LandingToolAccess = {
  role: Database["public"]["Enums"]["app_role"] | string
  tool_id: string
  tools: LandingToolRow | null
}

type ProfileToolsRow = {
  onboarding_completed: boolean | null
  must_reset_password: boolean | null
  tool_access: LandingToolAccess[] | null
}

export const getLandingAuth = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/login")
  }
  return { supabase, user }
})

/** Single DB round-trip: profile + nested tool_access + tools. */
export async function fetchLandingToolAccesses(): Promise<LandingToolAccess[]> {
  const { supabase, user } = await getLandingAuth()

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      onboarding_completed,
      must_reset_password,
      tool_access (
        role,
        tool_id,
        tools:tool_id (
          name,
          description,
          is_active,
          base_path
        )
      )
    `
    )
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("Errore caricamento landing tools:", error)
    throw new Error("tools_fetch_failed")
  }

  const row = data as ProfileToolsRow | null
  if (row?.must_reset_password) {
    redirect("/auth/reset-password")
  }

  if (!row?.onboarding_completed) {
    redirect("/onboarding")
  }

  const accesses = row.tool_access ?? []
  return accesses.sort((a, b) => {
    const activeA = a.tools?.is_active ?? false
    const activeB = b.tools?.is_active ?? false
    if (activeA && !activeB) return -1
    if (!activeA && activeB) return 1
    return 0
  })
}
