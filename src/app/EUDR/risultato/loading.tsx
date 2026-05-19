import { EudrRisultatoPdfSkeleton } from "@/components/eudr/EudrRisultatoDeferredSkeleton"

export default function EudrRisultatoLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 mt-6 mb-6" />
      <div className="h-48 animate-pulse rounded-2xl bg-slate-100 border border-slate-200 mb-10" />
      <EudrRisultatoPdfSkeleton />
    </div>
  )
}
