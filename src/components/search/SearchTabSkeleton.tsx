export function SearchTabSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Caricamento tabella">
      <div className="h-9 w-full max-w-xs animate-pulse rounded-md bg-slate-200" />
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-slate-100 last:border-0 animate-pulse bg-slate-50/80"
          />
        ))}
      </div>
    </div>
  )
}
