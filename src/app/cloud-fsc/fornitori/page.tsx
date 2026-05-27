import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function FornitoriPage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Fornitori"
      description="Elenco fornitori, certificati, gruppi di prodotto e controlli periodici."
    />
  )
}
