import { FscDocumentsView } from '@/components/cloud-fsc/documents/FscDocumentsView'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'

export default async function DocumentiGestionePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const params = await searchParams

  return <FscDocumentsView module="gestione" initialCategory={params.category} />
}
