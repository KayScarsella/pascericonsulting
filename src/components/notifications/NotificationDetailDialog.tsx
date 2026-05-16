"use client"

import { Bell, Calendar } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { NotificationDisplayItem } from "@/components/notifications/notification-types"

function formatNotificationDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

type NotificationDetailDialogProps = {
  notification: NotificationDisplayItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationDetailDialog({
  notification,
  open,
  onOpenChange,
}: NotificationDetailDialogProps) {
  if (!notification) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Bell className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1 text-left">
              <DialogTitle className="text-xl leading-snug">{notification.title}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Pubblicata il {formatNotificationDate(notification.created_at)}
                  </span>
                  {notification.expires_at && (
                    <span>
                      · Scade il {formatNotificationDate(notification.expires_at)}
                    </span>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
          {notification.message ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {notification.message}
            </p>
          ) : (
            <p className="text-sm italic text-slate-500">Nessun messaggio aggiuntivo.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
