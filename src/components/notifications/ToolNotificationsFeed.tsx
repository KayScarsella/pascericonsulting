import { Bell, Calendar } from "lucide-react"
import { listNotificationsForTool } from "@/actions/notifications"

export interface ToolNotificationsFeedProps {
  /** Tool ID (e.g. TIMBER_TOOL_ID, EUDR_TOOL_ID). Notifications are shown only for this tool. */
  toolId: string
  /** Optional max number of notifications to show. Default: all. */
  limit?: number
  /** Optional title override. Default: "Avvisi e notifiche". */
  title?: string
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

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
        <Bell className="h-5 w-5 text-amber-600" />
        {title}
      </h2>
      {list.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-slate-500">Nessuna notifica al momento.</p>
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((notif) => (
          <div
            key={notif.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Bell className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                {notif.message && (
                  <p className="text-sm text-slate-600 line-clamp-3">{notif.message}</p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(notif.created_at).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {notif.expires_at && (
                    <>
                      <span> · Scade il </span>
                      {new Date(notif.expires_at).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  )
}
