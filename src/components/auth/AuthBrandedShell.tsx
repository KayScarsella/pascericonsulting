import type { ReactNode } from 'react'

import { ArchiveBackButton } from '@/components/auth/ArchiveBackButton'

type AuthBrandedShellProps = {
  children: ReactNode
}

/**
 * Sfondo e header comune per tutte le pagine auth.
 * Sfondo bosco condiviso con la home di accesso.
 */
export function AuthBrandedShell({ children }: AuthBrandedShellProps) {
  return (
    <div className="site-forest-bg relative flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ArchiveBackButton />
      </div>
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-8">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
            Pasceri Consulting
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">Portale gestionale</h1>
        </header>
        <div className="flex w-full flex-col items-center">{children}</div>
      </div>
    </div>
  )
}
