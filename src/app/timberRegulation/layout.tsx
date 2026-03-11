import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { ToolNavbar, NavItem } from "@/components/ui/topBar"

const TIMBER_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '', iconName: 'Home', minRole: 'standard' },
  { label: 'Analisi Rischio', href: '/risk-analysis', iconName: 'ShieldAlert', minRole: 'premium' },
  { label: 'Cerca', href: '/search', iconName: 'Search', minRole: 'premium' },
  { label: 'Documentazione', href: '/documentation', iconName: 'FileText', minRole: 'standard' },
  { label: 'Master', href: '/master', iconName: 'Database', minRole: 'admin' },
]

export default async function TimberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(TIMBER_TOOL_ID)

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f4]">
      <ToolNavbar
        toolName="Timber Regulation"
        basePath="/timberRegulation"
        userRole={role}
        items={TIMBER_NAV_ITEMS}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}