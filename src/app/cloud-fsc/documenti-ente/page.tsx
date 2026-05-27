import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function DocumentiEntePage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Documenti di interscambio con l'ente"
      description="Visura, M210, fatturato, certificato, contratto e documenti di sistema."
    />
  )
}
