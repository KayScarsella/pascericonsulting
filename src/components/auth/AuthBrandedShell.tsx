import type { ReactNode } from 'react'

type AuthBrandedShellProps = {
  children: ReactNode
}

/**
 * Sfondo e header comune per tutte le pagine auth.
 * Allineato allo stile di `landingPage` (bg-slate-50/50 + card chiare).
 */
export function AuthBrandedShell({ children }: AuthBrandedShellProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-50/50 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.06),transparent_55%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.07),transparent_60%)]" aria-hidden />
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
