import { redirect } from "next/navigation"
import Link from "next/link"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Wrench, Shield, ExternalLink, User, Lock, Clock, LogOut, AlertCircle } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
// Assicurati che il percorso ai tipi sia corretto in base a dove si trova questo file
import { Database } from "@/types/supabase"

import { signOutAction } from "@/actions/auth" // O il percorso corretto della tua action

// Aggiungiamo base_path ai dati richiesti
type ToolData = Pick<Database['public']['Tables']['tools']['Row'], 'name' | 'description' | 'is_active' | 'base_path'>

type ToolAccessWithTool = {
  role: Database['public']['Enums']['app_role'] | string
  tool_id: string
  tools: ToolData | null
}

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    }
  )
}

export default async function LandingPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect("/login")
  }

  // Fetch dei tool e del percorso base_path
  const { data, error: toolsError } = await supabase
    .from('tool_access')
    .select(`
      role,
      tool_id,
      tools:tool_id (
        name,
        description,
        is_active,
        base_path
      )
    `)
    .eq('user_id', user.id)

  if (toolsError) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-red-500">
        Si è verificato un errore nel caricamento dei tuoi strumenti.
      </div>
    )
  }

  const accesses = data as unknown as ToolAccessWithTool[]

  const sortedAccesses = accesses?.sort((a, b) => {
    const activeA = a.tools?.is_active ?? false
    const activeB = b.tools?.is_active ?? false
    
    // Ordina prima i tool attivi
    if (activeA && !activeB) return -1;
    if (!activeA && activeB) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Portale Gestionale</h1>
            <p className="text-slate-500">
              Benvenuto, Seleziona un modulo per iniziare.
            </p>
          </div>
            <form action={async () => {
              "use server"
              await signOutAction()
            }}>
              <Button 
                variant="outline" 
                type="submit"  // Aggiungi sempre type="submit" nei form
                className="group gap-2 border-slate-300 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Esci
              </Button>
            </form>
        </div>

        {/* --- GRIGLIA TOOL --- */}
        {sortedAccesses && sortedAccesses.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedAccesses.map((access) => {
              if (!access.tools) return null;
              return (
                <ToolCard 
                  key={access.tool_id} 
                  tool={access.tools} 
                  role={access.role} 
                  toolId={access.tool_id} 
                />
              )
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function ToolCard({ tool, role, toolId }: { tool: ToolData, role: string, toolId: string }) {
    const isAdmin = role === 'admin'
    const isActive = tool.is_active === true
    
    // LOGICA URL: Se manca base_path nel DB, il link è nullo
    const targetUrl = tool.base_path
    // Se isActive è vero MA manca il link nel DB, consideriamo il tool "rotto" o non configurato
    const isConfigured = !!targetUrl

    return (
      <Card className={`group relative flex flex-col overflow-hidden border-slate-200 transition-all duration-300 
        ${isActive && isConfigured
          ? 'hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/50' 
          : 'border-slate-100 bg-slate-50/50 opacity-80' 
        }`}
      >
        <div className={`h-1.5 w-full 
          ${!isActive ? 'bg-slate-300' : (isAdmin ? 'bg-amber-500' : 'bg-blue-500')}
        `} />
  
        <div className={!isActive ? "grayscale filter" : ""}>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2 text-slate-700 ${!isActive ? 'bg-slate-200' : 'bg-slate-100'}`}>
                {!isActive ? <Clock className="h-6 w-6 text-slate-500" /> : <Wrench className="h-6 w-6" />}
              </div>
              
              <Badge variant="secondary" className={`
                ${!isActive 
                  ? 'bg-slate-200 text-slate-500' 
                  : (isAdmin ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")
                } hover:bg-opacity-100`}
              >
                {isAdmin ? (
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin</span>
                ) : (
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> Utente</span>
                )}
              </Badge>
            </div>
            
            <CardTitle className={`mt-4 text-xl font-semibold ${!isActive ? 'text-slate-500' : 'text-slate-900'}`}>
              {tool.name}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-sm text-slate-500">
              {tool.description || "Nessuna descrizione disponibile."}
            </CardDescription>
          </CardHeader>
        </div>
  
        <CardContent className="flex-grow">
          {/* Avviso se attivo ma senza link configurato */}
          {isActive && !isConfigured && (
             <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                <AlertCircle className="w-3 h-3" />
                Configurazione mancante
             </div>
          )}
        </CardContent>
  
        <CardFooter className="pt-0">
          {isActive ? (
             isConfigured ? (
                // CASO 1: Attivo e Configurato -> Mostra Link
                <Button asChild className="w-full gap-2 transition-all group-hover:bg-blue-600 group-hover:text-white" variant={isAdmin ? "outline" : "default"}>
                <Link href={targetUrl}>
                    Apri Tool <ExternalLink className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
                </Link>
                </Button>
             ) : (
                // CASO 2: Attivo ma manca URL nel DB -> Disabilita
                <Button disabled className="w-full gap-2" variant="outline">
                    Errore Link
                </Button>
             )
          ) : (
            // CASO 3: Non attivo -> Prossimamente
            <Button disabled className="w-full gap-2 bg-slate-200 text-slate-500 hover:bg-slate-200" variant="secondary">
              <Lock className="h-4 w-4" /> Prossimamente
            </Button>
          )}
        </CardFooter>
      </Card>
    )
}
  
function EmptyState() {
 return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
    <div className="rounded-full bg-slate-100 p-4">
        <Wrench className="h-8 w-8 text-slate-400" />
    </div>
    <h3 className="mt-4 text-lg font-semibold text-slate-900">Nessun tool assegnato</h3>
    <p className="mt-2 max-w-sm text-sm text-slate-500">
        Non hai ancora accesso a nessuno strumento. Contatta il tuo amministratore.
    </p>
    </div>
 )
}