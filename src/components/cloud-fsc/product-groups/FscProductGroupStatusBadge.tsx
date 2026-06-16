import { Badge } from '@/components/ui/badge'

type FscProductGroupStatusBadgeProps = {
  isActive: boolean
}

export function FscProductGroupStatusBadge({ isActive }: FscProductGroupStatusBadgeProps) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-600' : ''}>
      {isActive ? 'Attivo' : 'Inattivo'}
    </Badge>
  )
}
