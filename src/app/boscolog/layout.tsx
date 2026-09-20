import { getToolAccess } from '@/lib/tool-auth'
import { BOSCOLOG_TOOL_ID } from '@/lib/constants'
import { ToolNavbar, type NavItem } from '@/components/ui/topBar'
import { ToolPreviewBanner } from '@/components/ToolPreviewBanner'

const BOSCOLOG_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '', iconName: 'Home', minRole: 'standard' },
  { label: 'Lotti', href: '/lotti', iconName: 'Database', minRole: 'standard' },
  { label: 'Anagrafiche', href: '/anagrafiche', iconName: 'Users', minRole: 'standard' },
  { label: 'Azienda', href: '/azienda', iconName: 'Settings', minRole: 'standard' },
  { label: 'Import / Export', href: '/import-export', iconName: 'FileText', minRole: 'standard' },
  { label: 'Note', href: '/note', iconName: 'BookOpen', minRole: 'standard' },
  { label: 'Audit', href: '/audit', iconName: 'ClipboardList', minRole: 'standard' },
]

export default async function BoscoLogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role, isToolActive } = await getToolAccess(BOSCOLOG_TOOL_ID)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <ToolNavbar
        toolName="BoscoLog"
        basePath="/boscolog"
        userRole={role}
        items={BOSCOLOG_NAV_ITEMS}
      />
      {!isToolActive && <ToolPreviewBanner toolName="BoscoLog" />}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  )
}
