import { Wrench } from "lucide-react"
import { fetchLandingToolItems } from "@/lib/landing-data"
import { logRoutePerf } from "@/lib/perf-debug"
import { LandingToolCard } from "@/components/landing/LandingToolCard"

export async function LandingToolGrid() {
  const perfStart = Date.now()
  const items = await fetchLandingToolItems()

  logRoutePerf("/landingPage/tools", {
    tab: "grid",
    queryCount: 2,
    durationMs: Date.now() - perfStart,
  })

  if (items.length === 0) {
    return <LandingEmptyState />
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <LandingToolCard
          key={item.toolId}
          toolId={item.toolId}
          tool={item.tool}
          hasAccess={item.hasAccess}
          role={item.role}
        />
      ))}
    </div>
  )
}

function LandingEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <div className="rounded-full bg-slate-100 p-4">
        <Wrench className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Nessun modulo disponibile</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Il catalogo moduli è vuoto. Contatta il tuo amministratore per maggiori informazioni.
      </p>
    </div>
  )
}
