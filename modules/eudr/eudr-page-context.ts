import { redirect } from "next/navigation"
import { getToolAccess } from "@/lib/tool-auth"
import { getSessionContext } from "@/lib/session-context"
import { EUDR_TOOL_ID } from "@/lib/constants"

/** One session client per request: getToolAccess already loaded it via getSessionContext. */
export async function getEudrPageContext() {
  const { role, userId } = await getToolAccess(EUDR_TOOL_ID)
  const session = await getSessionContext()
  if (!session) redirect("/login")
  return { role, userId, supabase: session.supabase }
}
