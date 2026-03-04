import { ToolDocumentsView } from "@/components/documentsView" // Importa il componente generico
import { EUDR_TOOL_ID } from "@/lib/constants"

export default function documentation({ searchParams }: { searchParams: Promise<{ folderId?: string }> }) {
  return (
    <ToolDocumentsView 
      toolId={EUDR_TOOL_ID} 
      searchParams={searchParams}
      basePath="/EUDR/documentation" 
    />
  )
}