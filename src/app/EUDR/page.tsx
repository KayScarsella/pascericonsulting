import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { ToolNotificationsFeed } from "@/components/notifications/ToolNotificationsFeed"

export default async function EUDRHomePage() {
  await getToolAccess(EUDR_TOOL_ID)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Home</h1>
        <p className="text-slate-500">Avvisi e notifiche per EUDR.</p>
      </div>

      <ToolNotificationsFeed toolId={EUDR_TOOL_ID} />
    </div>
  )
}
