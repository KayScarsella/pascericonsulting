'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, User } from 'lucide-react'
import { cn } from '@/lib/utils'

type FscSettingsModuleNavProps = {
  showCompany: boolean
}

const MODULES = [
  {
    id: 'profilo',
    href: '/cloud-fsc/impostazioni/profilo',
    label: 'Profilo utente',
    description: 'Dati personali e sicurezza',
    icon: User,
  },
  {
    id: 'impresa',
    href: '/cloud-fsc/impostazioni/impresa',
    label: 'Impresa FSC',
    description: 'Dati azienda e team',
    icon: Building2,
    ownerOnly: true,
  },
] as const

export function FscSettingsModuleNav({ showCompany }: FscSettingsModuleNavProps) {
  const pathname = usePathname()

  const visible = MODULES.filter((m) => !('ownerOnly' in m && m.ownerOnly) || showCompany)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>
        <p className="mt-1 text-sm text-slate-500">
          Profilo personale e configurazione dell&apos;impresa FSC
        </p>
      </div>
      <nav
        className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
        aria-label="Modulo impostazioni"
      >
        {visible.map((mod) => {
          const Icon = mod.icon
          const active = pathname.startsWith(mod.href)
          return (
            <Link
              key={mod.id}
              href={mod.href}
              prefetch={false}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-white text-[#7d6230] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{mod.label}</span>
              <span className="sm:hidden">{mod.id === 'profilo' ? 'Profilo' : 'Impresa'}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
