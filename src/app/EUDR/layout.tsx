import { Suspense } from "react"
import { getToolAccess } from "@/lib/tool-auth"
import { getToolImpersonation } from "@/lib/tool-impersonation"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { ToolImpersonationBanner } from "@/components/admin/ToolImpersonationBanner"
// Importiamo solo NavItem per il tipo, NON le icone qui
import { ToolNavbar, NavItem } from "@/components/ui/topBar"

const EUDR_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '', iconName: 'Home', minRole: 'standard' },
  { label: 'Documentazione', href: '/documentation', iconName: 'FileText', minRole: 'standard' },
  { label: 'Analisi Rischio', href: '/risk-analysis', iconName: 'ShieldAlert', minRole: 'premium' },
  { label: 'Cerca', href: '/search', iconName: 'Search', minRole: 'premium' },
  { label: 'Impostazioni', href: '/impostazioni', iconName: 'Settings', minRole: 'standard' },
  { label: 'Master', href: '/master', iconName: 'Database', minRole: 'admin' },
]

function EudrNavSkeleton() {
  return (
    <div
      className="sticky top-0 z-40 h-16 w-full border-b border-slate-200 bg-white"
      aria-hidden
    />
  )
}

async function EudrChrome() {
  const [{ role }, impersonation] = await Promise.all([
    getToolAccess(EUDR_TOOL_ID),
    getToolImpersonation(EUDR_TOOL_ID),
  ])
  const targetLabel =
    impersonation?.targetFullName?.trim() ||
    impersonation?.targetEmail?.trim() ||
    'utente selezionato'

  return (
    <>
      <ToolNavbar
        toolName="EUDR"
        basePath="/EUDR"
        userRole={role}
        items={EUDR_NAV_ITEMS}
      />
      {impersonation ? (
        <ToolImpersonationBanner toolId={EUDR_TOOL_ID} targetLabel={targetLabel} />
      ) : null}
    </>
  )
}

export default function EudrLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Suspense fallback={<EudrNavSkeleton />}>
        <EudrChrome />
      </Suspense>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}