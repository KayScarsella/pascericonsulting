"use client"

import { useState } from "react"
import { Bell, Calendar } from "lucide-react"

import { NotificationDetailDialog } from "@/components/notifications/NotificationDetailDialog"
import type { NotificationDisplayItem } from "@/components/notifications/notification-types"

type ToolNotificationsFeedClientProps = {
  notifications: NotificationDisplayItem[]
}

export function ToolNotificationsFeedClient({
  notifications,
}: ToolNotificationsFeedClientProps) {
  const [selected, setSelected] = useState<NotificationDisplayItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openNotification = (notif: NotificationDisplayItem) => {
    setSelected(notif)
    setDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setSelected(null)
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notifications.map((notif) => (
          <button
            key={notif.id}
            type="button"
            onClick={() => openNotification(notif)}
            className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:border-amber-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            aria-label={`Apri notifica: ${notif.title}`}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Bell className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-semibold text-slate-900">{notif.title}</h3>
                {notif.message && (
                  <p className="text-sm text-slate-600 line-clamp-3">{notif.message}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
                <p className="text-xs font-medium text-amber-700">Clicca per leggere tutto</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <NotificationDetailDialog
        notification={selected}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
      />
    </>
  )
}
