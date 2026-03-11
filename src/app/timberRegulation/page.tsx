import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { ToolNotificationsFeed } from "@/components/notifications/ToolNotificationsFeed"

export default async function TimberHomePage() {
  await getToolAccess(TIMBER_TOOL_ID)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Home</h1>
        <p className="text-slate-500">Avvisi e notifiche per Timber Regulation.</p>
      </div>

      <ToolNotificationsFeed toolId={TIMBER_TOOL_ID} />
    </div>
  )
}
