import { FscLogosListView } from '@/components/cloud-fsc/loghi/FscLogosListView'
import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>
}

export default async function LoghiPage({ searchParams }: PageProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const params = await searchParams
  return <FscLogosListView searchParams={params} />
}
