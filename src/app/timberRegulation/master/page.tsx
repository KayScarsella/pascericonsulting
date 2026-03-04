import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { redirect } from "next/navigation"
import { Settings, Users, Database } from "lucide-react"

export default async function MasterPage() {
  const { role } = await getToolAccess(TIMBER_TOOL_ID)

  // SICUREZZA FERREA: Redirect se non sei admin
  if (role !== 'admin') {
    redirect(`/landiPage`)
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-lg shadow-lg flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold">Pannello Master</h1>
            <p className="text-slate-300">Configurazione globale del sistema Timber Regulation.</p>
        </div>
        <Settings className="w-10 h-10 text-[#967635]" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card Configurazione 1 */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
                    <Users className="w-6 h-6 text-[#967635] group-hover:text-white" />
                </div>
                <h3 className="font-semibold text-lg">Gestione Utenti</h3>
            </div>
            <p className="text-slate-500 text-sm">Modifica ruoli, aggiungi collaboratori e gestisci permessi.</p>
        </div>

        {/* Card Configurazione 2 */}
        <div className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
                    <Database className="w-6 h-6 text-[#967635] group-hover:text-white" />
                </div>
                <h3 className="font-semibold text-lg">Parametri Rischio</h3>
            </div>
            <p className="text-slate-500 text-sm">Imposta le soglie e i criteri per il calcolo automatico del rischio.</p>
        </div>
      </div>
    </div>
  )
}