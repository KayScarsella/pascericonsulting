interface FscModulePlaceholderProps {
  title: string
  description?: string
}

export function FscModulePlaceholder({ title, description }: FscModulePlaceholderProps) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-slate-500">{description}</p>}
      </div>
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-lg font-medium text-slate-700">Modulo in preparazione</p>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          La navigazione è attiva; l&apos;implementazione delle funzionalità seguirà le specifiche
          del progetto.
        </p>
      </div>
    </div>
  )
}
