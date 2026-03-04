import { getToolAccess } from "@/lib/tool-auth"
import { FileExplorer } from "@/components/ui/fileExplorer" 
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"

interface ToolDocumentsViewProps {
  toolId: string
  searchParams: Promise<{ folderId?: string }>
  basePath: string // L'URL base per revalidare (es: "/tools/timber/documents")
}

export async function ToolDocumentsView({ toolId, searchParams, basePath }: ToolDocumentsViewProps) {
  // Risolvi i parametri
  const params = await searchParams
  const currentFolderId = params.folderId || null

  // 1. Controllo Accesso
  const { role } = await getToolAccess(toolId)
  
  // Se non c'è accesso (es. role undefined o errore), gestisci qui (es. redirect o messaggio)
  if (!role) {
      return <div>Accesso negato al tool.</div>
  }
  
  const isAdmin = role === 'admin'
  
  // 2. Setup Supabase
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // 3. Query Documenti
  // Filtra SEMPRE per tool_id per garantire isolamento
  let query = supabase
    .from('documents')
    .select('*')
    .eq('tool_id', toolId)

  if (currentFolderId) {
    query = query.eq('parent_id', currentFolderId)
  } else {
    query = query.is('parent_id', null)
  }

  const { data: documents } = await query
    .order('type', { ascending: false }) // Prima cartelle, poi file
    .order('name', { ascending: true })

  // 4. Fetch Parent ID (per navigazione breadcrumb "Indietro")
  let parentFolderId = null
  if (currentFolderId) {
    const { data: currentFolder } = await supabase
        .from('documents')
        .select('parent_id')
        .eq('id', currentFolderId)
        .eq('tool_id', toolId) // Security check extra
        .single()
    parentFolderId = currentFolder?.parent_id || null
  }

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
        pathRevalidate={basePath} // Importante per aggiornare la UI corretta
      />
    </div>
  )
}