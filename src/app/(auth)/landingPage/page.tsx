import { Suspense } from "react"
import { SignOutForm } from "@/components/landing/SignOutForm"
import { LandingToolGrid } from "@/components/landing/LandingToolGrid"
import { ToolGridSkeleton } from "@/components/landing/ToolGridSkeleton"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Portale Gestionale
            </h1>
            <p className="text-slate-500">Benvenuto, seleziona un modulo per iniziare.</p>
          </div>
          <SignOutForm />
        </header>
        <Suspense fallback={<ToolGridSkeleton />}>
          <LandingToolGrid />
        </Suspense>
      </div>
    </div>
  )
}
