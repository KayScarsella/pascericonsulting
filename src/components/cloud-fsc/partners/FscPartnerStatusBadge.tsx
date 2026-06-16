import { Badge } from '@/components/ui/badge'
import { getFscSupplierStatusLabel } from '@/lib/fsc/partners'
import type { FscSupplierStatus } from '@/types/fsc'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<FscSupplierStatus, { className: string }> = {
  active: {
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  inactive: {
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  reactivated: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
}

type FscPartnerStatusBadgeProps = {
  status: FscSupplierStatus
  className?: string
}

export function FscPartnerStatusBadge({ status, className }: FscPartnerStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn('border', config.className, className)}>
      {getFscSupplierStatusLabel(status)}
    </Badge>
  )
}
