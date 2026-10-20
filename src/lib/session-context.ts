import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import type { User } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

export type SessionProfile = {
  full_name: string | null
  onboarding_completed: boolean | null
  must_reset_password: boolean | null
}

export type SessionContext = {
  user: User
  profile: SessionProfile | null
  supabase: ReturnType<typeof createServerClient<Database>>
}

/**
 * Per-request session: one getUser + one profiles select, shared by tool-auth / onboarding.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // no-op in RSC contexts where cookies are read-only
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarding_completed, must_reset_password")
    .eq("id", user.id)
    .maybeSingle()

  return {
    user,
    profile: (profile as SessionProfile | null) ?? null,
    supabase,
  }
})
