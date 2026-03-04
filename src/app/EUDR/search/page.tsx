import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { Lock, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default async function SearchPage() {
  const { role } = await getToolAccess(EUDR_TOOL_ID)
  
  const hasAccess = role === 'admin' || role === 'premium'

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-slate-100 rounded-full">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Ricerca Avanzata Bloccata</h2>
        <p className="text-slate-500 text-sm">Passa a Premium per cercare in tutto il database storico.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Ricerca Globale</h1>
        <p className="text-slate-500">Cerca tra fornitori, documenti, analisi e normative.</p>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Cerca per nome, codice fiscale o ID..." className="h-12 text-lg shadow-sm" />
        <Button className="h-12 px-8 bg-[#967635] hover:bg-[#856625]">
            <Search className="w-5 h-5" />
        </Button>
      </div>

      <div className="text-center text-sm text-slate-400">
        Prova a cercare &quot;Fornitore Mario&quot; o &quot;Regolamento 995&quot;
      </div>
    </div>
  )
}