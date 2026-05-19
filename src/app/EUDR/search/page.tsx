import { Suspense } from "react"
import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { Lock } from "lucide-react"
import { EudrSearchData } from "@/components/eudr/EudrSearchData"
import { SearchTabSkeleton } from "@/components/search/SearchTabSkeleton"

export default async function EudrSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const { role, userId } = await getToolAccess(EUDR_TOOL_ID)
  const hasAccess = role === "admin" || role === "premium"
  const isAdmin = role === "admin"

  if (!hasAccess) {
    return <LockedSearchView />
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Storico verifiche e analisi EUDR</h1>
        <p className="text-slate-500">
          Passa rapidamente tra analisi finali e verifiche preliminari per EUDR.
        </p>
      </div>

      <Suspense fallback={<SearchTabSkeleton />}>
        <EudrSearchData searchParams={params} isAdmin={isAdmin} userId={userId} />
      </Suspense>
    </div>
  )
}

function LockedSearchView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="p-4 bg-slate-100 rounded-full">
        <Lock className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-700">Archivio Analisi Bloccato</h2>
      <p className="text-slate-500 text-sm">
        Passa a Premium per cercare e gestire lo storico delle analisi e verifiche EUDR.
      </p>
    </div>
  )
}
