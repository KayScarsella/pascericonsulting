import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import type { JwtPayload, User } from "@supabase/supabase-js"
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
 * Access-token claims are not a GoTrue `User`. `getToolAccess` reads `id`;
 * email, role, and metadata are copied so the `User` object stays usable.
 * Account timestamps are not in the JWT; `created_at` stays empty unless a
 * custom claim provides it.
 */
function userFromClaims(claims: JwtPayload): User | null {
  if (!claims.sub) return null

  const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud
  if (!aud) return null

  const createdAt = claims.created_at

  return {
    id: claims.sub,
    aud,
    role: claims.role,
    email: claims.email,
    phone: claims.phone,
    app_metadata: claims.app_metadata ?? {},
    user_metadata: claims.user_metadata ?? {},
    is_anonymous: claims.is_anonymous,
    created_at: typeof createdAt === "string" ? createdAt : "",
  }
}

/**
 * Per-request session shared by tool-auth / onboarding.
 * The proxy already calls getUser() on non-prefetch navigations, so this
 * reads verified JWT claims instead of a second Auth round trip.
 * Profile fields stay a Postgres select.
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

  const { data, error: claimsError } = await supabase.auth.getClaims()

  let user: User | null = null
  if (!claimsError && data?.claims) {
    user = userFromClaims(data.claims)
    if (!user) return null
  } else {
    // No verified claims to map. Keep the network getUser only here.
    const {
      data: { user: networkUser },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !networkUser) return null
    user = networkUser
  }

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
