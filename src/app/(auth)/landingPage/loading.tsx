import { ToolGridSkeleton } from "@/components/landing/ToolGridSkeleton"

export default function LandingPageLoading() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-5 w-80 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-md bg-slate-200" />
        </header>
        <ToolGridSkeleton />
      </div>
    </div>
  )
}
