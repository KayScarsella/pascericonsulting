import { Bell } from "lucide-react"
import { listNotificationsForTool } from "@/actions/notifications"
import { ToolNotificationsFeedClient } from "@/components/notifications/ToolNotificationsFeedClient"
import type { NotificationDisplayItem } from "@/components/notifications/notification-types"

export interface ToolNotificationsFeedProps {
  /** Tool ID (e.g. TIMBER_TOOL_ID, EUDR_TOOL_ID). Notifications are shown only for this tool. */
  toolId: string
  /** Optional max number of notifications to show. Default: all. */
  limit?: number
  /** Optional title override. Default: "Avvisi e notifiche". */
  title?: string
}

function toDisplayItem(
  row: Awaited<ReturnType<typeof listNotificationsForTool>>[number]
): NotificationDisplayItem {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    created_at: row.created_at,
    expires_at: row.expires_at,
  }
}

/**
 * Reusable feed of active notifications for a given tool.
 * Use on the tool home page (e.g. timberRegulation/page.tsx, EUDR/page.tsx).
 * Fetches and displays active, non-expired notifications in a card grid.
 */
export async function ToolNotificationsFeed({
  toolId,
  limit,
  title = "Avvisi e notifiche",
}: ToolNotificationsFeedProps) {
  const notifications = await listNotificationsForTool(toolId)
  const list = limit != null ? notifications.slice(0, limit) : notifications
  const displayItems = list.map(toDisplayItem)

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Bell className="h-5 w-5 text-amber-600" />
        {title}
      </h2>
      {displayItems.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-500">Nessuna notifica al momento.</p>
        </div>
      ) : (
        <ToolNotificationsFeedClient notifications={displayItems} />
      )}
    </section>
  )
}
