import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

export default function OnboardingEntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
