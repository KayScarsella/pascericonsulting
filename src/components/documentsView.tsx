import { getToolAccess } from "@/lib/tool-auth"
import { FileExplorer } from "@/components/ui/fileExplorer"
import { createDocumentSignedUrls } from "@/lib/documents-download"
import { logRoutePerf } from "@/lib/perf-debug"
import { createClient } from "@/utils/supabase/server"

interface ToolDocumentsViewProps {
  toolId: string
  searchParams: Promise<{ folderId?: string }>
  basePath: string
}

export async function ToolDocumentsView({
  toolId,
  searchParams,
  basePath,
}: ToolDocumentsViewProps) {
  const perfStart = Date.now()
  let queryCount = 0

  const params = await searchParams
  const currentFolderId = params.folderId || null

  const { role } = await getToolAccess(toolId)
  if (!role) {
    return <div>Accesso negato al tool.</div>
  }

  const isAdmin = role === "admin"
  const supabase = await createClient()

  let documentsQuery = supabase.from("documents").select("*").eq("tool_id", toolId)
  if (currentFolderId) {
    documentsQuery = documentsQuery.eq("parent_id", currentFolderId)
  } else {
    documentsQuery = documentsQuery.is("parent_id", null)
  }

  queryCount += 1
  const parentQuery = currentFolderId
    ? supabase
        .from("documents")
        .select("parent_id")
        .eq("id", currentFolderId)
        .eq("tool_id", toolId)
        .single()
    : null

  const [{ data: documents }, parentResult] = await Promise.all([
    documentsQuery.order("type", { ascending: false }).order("name", { ascending: true }),
    parentQuery ?? Promise.resolve({ data: null }),
  ])
  if (parentQuery) queryCount += 1

  const parentFolderId = parentResult.data?.parent_id ?? null

  const filePaths = (documents || [])
    .filter((d) => d.type === "file" && d.storage_path)
    .map((d) => d.storage_path as string)

  const downloadUrls =
    filePaths.length > 0 ? await createDocumentSignedUrls(supabase, toolId, filePaths) : {}

  logRoutePerf(basePath, {
    tab: currentFolderId ?? "root",
    queryCount,
    durationMs: Date.now() - perfStart,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Archivio Documentale</h2>
          <p className="text-slate-500">
            {isAdmin
              ? "Gestisci cartelle e file per questo tool."
              : "Consulta i documenti disponibili per questo tool."}
          </p>
        </div>
      </div>

      <FileExplorer
        items={documents || []}
        currentFolderId={currentFolderId}
        parentFolderId={parentFolderId}
        isAdmin={isAdmin}
        toolId={toolId}
        pathRevalidate={basePath}
        downloadUrls={downloadUrls}
      />
    </div>
  )
}
