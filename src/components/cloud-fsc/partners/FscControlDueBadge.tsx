import { Badge } from '@/components/ui/badge'
import {
  computeFscControlDueDate,
  getFscControlDueStatus,
  type FscControlDueStatus,
} from '@/lib/fsc/partners'
import type { FscControlFrequency } from '@/types/fsc'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<
  FscControlDueStatus,
  { label: string; className: string }
> = {
  overdue: {
    label: 'Controllo scaduto',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  warning: {
    label: 'Controllo in scadenza',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  ok: {
    label: 'Controllo ok',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  none: {
    label: 'Nessun controllo',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

type FscControlDueBadgeProps = {
  lastControlDate: string | null | undefined
  frequency: FscControlFrequency
  showDate?: boolean
}

export function FscControlDueBadge({
  lastControlDate,
  frequency,
  showDate = true,
}: FscControlDueBadgeProps) {
  const status = getFscControlDueStatus(lastControlDate, frequency)
  const config = STATUS_CONFIG[status]
  const dueDate = computeFscControlDueDate(lastControlDate, frequency)

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className={cn('border', config.className)}>
        {config.label}
      </Badge>
      {showDate && dueDate && (
        <span className="text-xs text-slate-500">
          Prossimo: {dueDate.toLocaleDateString('it-IT')}
        </span>
      )}
    </div>
  )
}
