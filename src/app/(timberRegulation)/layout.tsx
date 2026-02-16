import { getToolAccess } from "@/lib/tool-auth"
import { TimberNavbar } from "@/components/ui/TimberNavbar"

export default async function TimberToolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { toolId: string }
}) {
  // 1. Chiamata server-side efficiente (cachata)
  // Se l'utente non ha accesso, viene reindirizzato automaticamente dentro questa funzione
  const { role } = await getToolAccess(params.toolId)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* 2. Passiamo il ruolo alla UI */}
      <TimberNavbar 
        toolId={params.toolId} 
        userRole={role} 
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}