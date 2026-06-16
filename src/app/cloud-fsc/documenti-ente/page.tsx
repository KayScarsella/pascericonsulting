import { FscDocumentsView } from '@/components/cloud-fsc/documents/FscDocumentsView'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { getToolAccess } from '@/lib/tool-auth'

export default async function DocumentiEntePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; year?: string }>
}) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const params = await searchParams

  return (
    <FscDocumentsView
      module="ente"
      initialCategory={params.category}
      initialYear={params.year}
    />
  )
}
