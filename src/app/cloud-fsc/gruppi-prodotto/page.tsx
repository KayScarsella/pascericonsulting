import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function GruppiProdottoPage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Gruppi di prodotto"
      description="Gruppi FSC ufficiali, claim e addendum."
    />
  )
}
