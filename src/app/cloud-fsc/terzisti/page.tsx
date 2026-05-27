import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function TerzistiPage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Terzisti"
      description="Terzisti, lavorazioni, rischio e documentazione CoC."
    />
  )
}
