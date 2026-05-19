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

export type LandingToolItem = {
  toolId: string
  tool: LandingToolRow
  hasAccess: boolean
  role: string | null
}

type ProfileAccessRow = {
  onboarding_completed: boolean | null
  must_reset_password: boolean | null
  tool_access: { role: string; tool_id: string }[] | null
}

type ToolCatalogRow = LandingToolRow & { id: string }

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

async function assertLandingProfileReady(): Promise<Map<string, string>> {
  const { supabase, user } = await getLandingAuth()

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      onboarding_completed,
      must_reset_password,
      tool_access (
        role,
        tool_id
      )
    `
    )
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("Errore caricamento profilo landing:", error)
    throw new Error("profile_fetch_failed")
  }

  const row = data as ProfileAccessRow | null
  if (row?.must_reset_password) {
    redirect("/auth/reset-password")
  }

  if (!row?.onboarding_completed) {
    redirect("/onboarding")
  }

  return new Map((row.tool_access ?? []).map((access) => [access.tool_id, access.role]))
}

/** Catalogo completo tool — stesso payload per tutti gli utenti autenticati. */
export const fetchAllToolsCatalog = cache(async (): Promise<ToolCatalogRow[]> => {
  const { supabase } = await getLandingAuth()

  const { data, error } = await supabase
    .from("tools")
    .select("id, name, description, is_active, base_path")
    .order("name", { ascending: true })

  if (error) {
    console.error("Errore caricamento catalogo tool:", error)
    throw new Error("tools_catalog_fetch_failed")
  }

  return (data ?? []) as ToolCatalogRow[]
})

function sortLandingToolItems(items: LandingToolItem[]): LandingToolItem[] {
  const priority = (item: LandingToolItem) => {
    const active = item.tool.is_active === true
    if (item.hasAccess && active) return 0
    if (item.hasAccess && !active) return 1
    if (!item.hasAccess && active) return 2
    return 3
  }

  return items.sort((a, b) => {
    const diff = priority(a) - priority(b)
    if (diff !== 0) return diff
    return a.tool.name.localeCompare(b.tool.name, "it")
  })
}

/** Due query in parallelo: profilo/accessi + catalogo tool. */
export async function fetchLandingToolItems(): Promise<LandingToolItem[]> {
  const [accessByToolId, catalog] = await Promise.all([
    assertLandingProfileReady(),
    fetchAllToolsCatalog(),
  ])

  const items: LandingToolItem[] = catalog.map(({ id, ...tool }) => {
    const role = accessByToolId.get(id) ?? null
    return {
      toolId: id,
      tool,
      hasAccess: role !== null,
      role,
    }
  })

  return sortLandingToolItems(items)
}
