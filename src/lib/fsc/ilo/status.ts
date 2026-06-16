export type FscIloStatus = 'draft' | 'completed' | 'warning' | 'overdue'

const ILO_REMINDER_MONTHS = 10

export function getFscIloStatus(
  completedAt: string | null | undefined,
  hasFormData: boolean
): FscIloStatus {
  if (!completedAt) {
    return hasFormData ? 'draft' : 'overdue'
  }

  const completed = new Date(completedAt)
  const threshold = new Date()
  threshold.setMonth(threshold.getMonth() - ILO_REMINDER_MONTHS)

  if (completed <= threshold) return 'overdue'

  const warningThreshold = new Date()
  warningThreshold.setMonth(warningThreshold.getMonth() - (ILO_REMINDER_MONTHS - 1))

  if (completed <= warningThreshold) return 'warning'

  return 'completed'
}

export const FSC_ILO_STATUS_LABELS: Record<FscIloStatus, string> = {
  draft: 'Bozza',
  completed: 'Completata',
  warning: 'Da aggiornare',
  overdue: 'Scaduta',
}
