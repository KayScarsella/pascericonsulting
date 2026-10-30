import { cache } from "react"
import { getSessionContext } from "@/lib/session-context"

export const isOnboardingComplete = cache(async (): Promise<boolean> => {
  const session = await getSessionContext()
  if (!session) return false
  return Boolean(session.profile?.onboarding_completed)
})
