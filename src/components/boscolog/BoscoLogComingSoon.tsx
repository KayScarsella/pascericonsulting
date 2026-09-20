export function BoscoLogComingSoon({
  title,
  phaseLabel,
  description,
}: {
  title: string
  phaseLabel: string
  description?: string
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="text-slate-500">
        {description ?? `Sezione in preparazione — disponibile dalla ${phaseLabel}.`}
      </p>
    </div>
  )
}
