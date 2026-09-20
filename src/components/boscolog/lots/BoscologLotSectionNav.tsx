import Link from 'next/link'
import { Button } from '@/components/ui/button'

const SECTIONS = [
  { id: 'anagrafica', label: 'Anagrafica', href: (id: string) => `/boscolog/lotti/${id}` },
  {
    id: 'materiale',
    label: 'Materiale',
    href: (id: string) => `/boscolog/lotti/${id}/materiale`,
  },
  {
    id: 'compliance',
    label: 'Compliance',
    href: (id: string) => `/boscolog/lotti/${id}/compliance`,
  },
] as const

export function BoscologLotSectionNav({
  lotId,
  lotName,
  active,
}: {
  lotId: string
  lotName: string
  active: 'anagrafica' | 'materiale' | 'compliance'
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/boscolog/lotti">← Lotti</Link>
        </Button>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{lotName}</h1>
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-px">
        {SECTIONS.map((s) => {
          const isActive = s.id === active
          return (
            <Link
              key={s.id}
              href={s.href(lotId)}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border border-b-0 border-slate-200 bg-white text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
