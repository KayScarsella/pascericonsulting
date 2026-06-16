export function assertFscPartnerCanEdit(ctx: { canEdit: boolean }): string | null {
  if (!ctx.canEdit) return 'Permesso di modifica non disponibile'
  return null
}
