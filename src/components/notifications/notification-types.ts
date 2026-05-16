/** Serializable notification fields for client components. */
export type NotificationDisplayItem = {
  id: string
  title: string
  message: string | null
  created_at: string
  expires_at: string | null
}
