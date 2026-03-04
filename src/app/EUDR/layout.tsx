import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
// Importiamo solo NavItem per il tipo, NON le icone qui
import { ToolNavbar, NavItem } from "@/components/ui/topBar"

const EUDR_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '', iconName: 'Home', minRole: 'standard' },
  { label: 'Documentazione', href: '/documentation', iconName: 'FileText', minRole: 'standard' },
  { label: 'Analisi Rischio', href: '/risk-analysis', iconName: 'ShieldAlert', minRole: 'premium' },
  { label: 'Cerca', href: '/search', iconName: 'Search', minRole: 'premium' },
  { label: 'Registro', href: '/registry', iconName: 'BookOpen', minRole: 'premium' },
  { label: 'Valuta Fornitore', href: '/supplier-check', iconName: 'UserCheck', minRole: 'premium' },
  { label: 'Master', href: '/master', iconName: 'Database', minRole: 'admin' },
]

export default async function EudrLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(EUDR_TOOL_ID)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
       <ToolNavbar 
          toolName="EUDR"
          basePath="/EUDR"
          userRole={role}
          items={EUDR_NAV_ITEMS}
       />
       <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
         {children}
       </main>
    </div>
  )
}