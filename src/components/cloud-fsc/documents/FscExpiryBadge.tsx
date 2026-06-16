import { Badge } from '@/components/ui/badge'
import { getFscExpiryStatus, type FscExpiryStatus } from '@/lib/fsc/expiry-status'
import { cn } from '@/lib/utils'

export { getFscExpiryStatus, type FscExpiryStatus }

const STATUS_CONFIG: Record<
  FscExpiryStatus,
  { label: string; className: string }
> = {
  expired: {
    label: 'Scaduto',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  warning: {
    label: 'In scadenza',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  ok: {
    label: 'Valido',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  none: {
    label: 'Senza scadenza',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

type FscExpiryBadgeProps = {
  expiresAt: string | null | undefined
  showDate?: boolean
}

export function FscExpiryBadge({ expiresAt, showDate = true }: FscExpiryBadgeProps) {
  const status = getFscExpiryStatus(expiresAt)
  const config = STATUS_CONFIG[status]

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className={cn('border', config.className)}>
        {config.label}
      </Badge>
      {showDate && expiresAt && (
        <span className="text-xs text-slate-500">
          {new Date(expiresAt).toLocaleDateString('it-IT')}
        </span>
      )}
    </div>
  )
}
