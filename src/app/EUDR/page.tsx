import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ShieldAlert, Activity } from "lucide-react"

export default async function TimberHomePage() {
  const { role } = await getToolAccess(EUDR_TOOL_ID)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard Timber Regulation</h1>
        <p className="text-slate-500">Benvenuto nel pannello di gestione della conformità EUTR/EUDR.</p>
      </div>

      {/* KPI Cards Esempio */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-[#967635] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documenti Caricati</CardTitle>
            <FileText className="h-4 w-4 text-[#967635]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-slate-500">+2 rispetto al mese scorso</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#967635] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analisi Rischio</CardTitle>
            <ShieldAlert className="h-4 w-4 text-[#967635]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Basso</div>
            <p className="text-xs text-slate-500">Ultimo aggiornamento: Oggi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#967635] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stato Conformità</CardTitle>
            <Activity className="h-4 w-4 text-[#967635]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Attivo</div>
            <p className="text-xs text-slate-500">Tutti i sistemi operativi</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Sezione Contenuto */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium">Attività Recenti</h3>
        <p className="text-slate-500 text-sm mt-2">Nessuna attività recente registrata.</p>
      </div>
    </div>
  )
}