import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings, Users, Database, Leaf, Globe, Bell } from "lucide-react"

export default async function MasterPage() {
  const { role } = await getToolAccess(TIMBER_TOOL_ID)

  if (role !== 'admin') {
    redirect("/landingPage")
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
        <Link href="/timberRegulation/master/users" className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group block">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
              <Users className="w-6 h-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-lg">Gestione Utenti</h3>
          </div>
          <p className="text-slate-500 text-sm">Modifica ruoli, aggiungi collaboratori e gestisci permessi.</p>
        </Link>

        <Link href="/timberRegulation/master/species" className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group block">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
              <Leaf className="w-6 h-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-lg">Gestione Specie</h3>
          </div>
          <p className="text-slate-500 text-sm">Aggiungi e modifica le specie legnose (nome scientifico, comune, CITES).</p>
        </Link>

        <Link href="/timberRegulation/master/countries" className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group block">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
              <Globe className="w-6 h-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-lg">Gestione Paesi</h3>
          </div>
          <p className="text-slate-500 text-sm">Gestisci i paesi (extra UE, conflitti, sanzioni, codice corruzione).</p>
        </Link>

        <Link href="/timberRegulation/master/notifications" className="bg-white p-6 rounded-lg border border-slate-200 hover:border-[#967635] transition-colors cursor-pointer group block">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded group-hover:bg-[#967635] transition-colors">
              <Bell className="w-6 h-6 text-[#967635] group-hover:text-white" />
            </div>
            <h3 className="font-semibold text-lg">Gestione Notifiche</h3>
          </div>
          <p className="text-slate-500 text-sm">Crea e gestisci le notifiche visibili a tutti gli utenti in home.</p>
        </Link>

        <div className="bg-white p-6 rounded-lg border border-slate-200 opacity-75 cursor-not-allowed" aria-disabled>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded">
              <Database className="w-6 h-6 text-[#967635]" />
            </div>
            <h3 className="font-semibold text-lg">Parametri Rischio</h3>
          </div>
          <p className="text-slate-500 text-sm">Imposta le soglie e i criteri per il calcolo automatico del rischio. (Prossimamente)</p>
        </div>
      </div>
    </div>
  )
}