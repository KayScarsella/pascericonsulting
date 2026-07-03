import { FscSubcontractorsListView } from '@/components/cloud-fsc/partners/FscSubcontractorsListView'
import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string }>
}

export default async function TerzistiPage({ searchParams }: PageProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const params = await searchParams
  return <FscSubcontractorsListView searchParams={params} />
}
