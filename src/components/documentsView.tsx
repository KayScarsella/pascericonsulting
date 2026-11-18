import { getToolAccess } from "@/lib/tool-auth"
import type { ToolRole } from "@/lib/tool-auth"
import {
  canAccessAllowedRoles,
  DEFAULT_ALLOWED_ROLES,
  normalizeAllowedRoles,
} from "@/lib/tool-role-access"
import { FileExplorer, type DocItem } from "@/components/ui/fileExplorer"
import { getCachedDocumentsListing } from "@/lib/documents-cache"
import { logRoutePerf } from "@/lib/perf-debug"
import { createServiceRoleClient } from "@/utils/supabase/admin"
import { PremiumFolderUpsell } from "@/components/documents/PremiumFolderUpsell"

interface ToolDocumentsViewProps {
  toolId: string
  searchParams: Promise<{ folderId?: string }>
  basePath: string
}

function docAllowedRoles(doc: {
  allowed_roles?: string[] | null
  min_role?: string | null
}): ToolRole[] {
  if (doc.allowed_roles?.length) {
    return normalizeAllowedRoles(doc.allowed_roles)
  }
  if (doc.min_role === "premium") return ["premium", "admin"]
  return DEFAULT_ALLOWED_ROLES
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

  let folderResult: {
    data: {
      id: string
      name: string
      type: string
      parent_id: string | null
      allowed_roles?: string[] | null
      min_role?: string | null
    } | null
    error: { message: string } | null
  } = { data: null, error: null }

  // ACL cartella prima del listing figli (evita lavoro inutile se locked/inesistente).
  if (currentFolderId) {
    queryCount += 1
    const supabase = createServiceRoleClient()
    folderResult = await supabase
      .from("documents")
      .select("id, name, type, parent_id, allowed_roles, min_role")
      .eq("id", currentFolderId)
      .eq("tool_id", toolId)
      .maybeSingle()

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

    const folderRoles = docAllowedRoles(folderResult.data)
    if (!canAccessAllowedRoles(role, folderRoles)) {
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

  queryCount += 1
  const documents = await getCachedDocumentsListing(toolId, currentFolderId)

  const parentFolderId = folderResult.data?.parent_id ?? null
  const parentAllowedRoles = folderResult.data
    ? docAllowedRoles(folderResult.data)
    : null

  // Cartelle locked visibili come teaser; file solo se il ruolo lo consente.
  const visibleDocuments = documents.filter(
    (d) => d.type === "folder" || canAccessAllowedRoles(role, docAllowedRoles(d))
  ) as DocItem[]

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
        parentAllowedRoles={parentAllowedRoles}
      />
    </div>
  )
}
