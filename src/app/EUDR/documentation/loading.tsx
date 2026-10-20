export default function DocumentationLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="min-h-[500px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
          <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
        </div>
        <ul className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
