import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FscModulePlaceholder } from '@/components/cloud-fsc/FscModulePlaceholder'

export default async function AutovalutazioneIloPage() {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  return (
    <FscModulePlaceholder
      title="Autovalutazione lavoratori (ILO)"
      description="Modello Word, compilazione annuale e archivio PDF."
    />
  )
}
