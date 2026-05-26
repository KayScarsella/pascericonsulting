import { getToolAccess } from "@/lib/tool-auth"
import { canAccessMinRole, type DocumentMinRole } from "@/lib/tool-role-access"
import { FileExplorer } from "@/components/ui/fileExplorer"
import { createDocumentSignedUrls } from "@/lib/documents-download"
import { logRoutePerf } from "@/lib/perf-debug"
import { createClient } from "@/utils/supabase/server"
import { PremiumFolderUpsell } from "@/components/documents/PremiumFolderUpsell"

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

  const folderQuery = currentFolderId
    ? supabase
        .from("documents")
        .select("*")
        .eq("id", currentFolderId)
        .eq("tool_id", toolId)
        .maybeSingle()
    : null

  let documentsQuery = supabase.from("documents").select("*").eq("tool_id", toolId)
  if (currentFolderId) {
    documentsQuery = documentsQuery.eq("parent_id", currentFolderId)
  } else {
    documentsQuery = documentsQuery.is("parent_id", null)
  }

  queryCount += 1
  if (folderQuery) queryCount += 1

  const [{ data: documents }, folderResult] = await Promise.all([
    documentsQuery.order("type", { ascending: false }).order("name", { ascending: true }),
    folderQuery ?? Promise.resolve({ data: null, error: null }),
  ])

  if (currentFolderId) {
    if (folderResult.error) {
      console.error("[documents] folder lookup failed:", folderResult.error.message)
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Archivio Documentale</h2>
          <p className="text-slate-600">
            Impossibile aprire la cartella. Se il problema persiste, verifica che la migration
            documenti sia applicata sul database.
          </p>
        </div>
      )
    }

    if (!folderResult.data || folderResult.data.type !== "folder") {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Archivio Documentale</h2>
          <p className="text-slate-600">Cartella non trovata.</p>
        </div>
      )
    }

    const folderMinRole = (folderResult.data.min_role ?? "standard") as DocumentMinRole
    if (!canAccessMinRole(role, folderMinRole)) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Archivio Documentale</h2>
          <PremiumFolderUpsell
            folderName={folderResult.data.name}
            archivePath={basePath}
            variant="page"
          />
        </div>
      )
    }
  }

  const parentFolderId = folderResult.data?.parent_id ?? null
  const parentIsPremium =
    currentFolderId &&
    folderResult.data &&
    (folderResult.data.min_role ?? "standard") === "premium"

  // Cartelle premium visibili come teaser; file solo se il ruolo lo consente.
  const visibleDocuments = (documents || []).filter(
    (d) =>
      d.type === "folder" ||
      canAccessMinRole(role, (d.min_role ?? "standard") as DocumentMinRole)
  )

  const filePaths = visibleDocuments
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
        items={visibleDocuments}
        currentFolderId={currentFolderId}
        parentFolderId={parentFolderId}
        isAdmin={isAdmin}
        userRole={role}
        toolId={toolId}
        pathRevalidate={basePath}
        parentIsPremium={!!parentIsPremium}
        downloadUrls={downloadUrls}
      />
    </div>
  )
}
