import { getToolAccess } from "@/lib/tool-auth"
import { CLOUD_FSC_TOOL_ID } from "@/lib/constants"
import { ToolNotificationsFeed } from "@/components/notifications/ToolNotificationsFeed"

export default async function CloudFscHomePage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">CLOUD FSC</h1>
        <p className="text-slate-500">Modulo in sviluppo. Avvisi e notifiche.</p>
      </div>

      <ToolNotificationsFeed toolId={CLOUD_FSC_TOOL_ID} />
    </div>
  )
}
