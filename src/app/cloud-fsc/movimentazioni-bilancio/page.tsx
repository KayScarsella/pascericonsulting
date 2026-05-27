import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function MovimentazioniBilancioPage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Movimentazione e bilancio FSC"
      description="Acquisti, vendite, scarti, declassamenti e bilancio annuale automatico."
    />
  )
}
