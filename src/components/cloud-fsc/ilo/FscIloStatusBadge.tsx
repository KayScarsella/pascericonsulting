import { Badge } from '@/components/ui/badge'
import { FSC_ILO_STATUS_LABELS, type FscIloStatus } from '@/lib/fsc/ilo/status'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<FscIloStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  overdue: 'bg-red-50 text-red-800 border-red-200',
}

type FscIloStatusBadgeProps = {
  status: FscIloStatus
  className?: string
}

export function FscIloStatusBadge({ status, className }: FscIloStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {FSC_ILO_STATUS_LABELS[status]}
    </Badge>
  )
}
