import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { ToolNavbar, NavItem } from '@/components/ui/topBar'

const CLOUD_FSC_NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '', iconName: 'Home', minRole: 'standard' },
  { label: 'Doc. gestione', href: '/documenti-gestione', iconName: 'FileText', minRole: 'standard' },
  { label: 'Doc. ente', href: '/documenti-ente', iconName: 'BookOpen', minRole: 'standard' },
  { label: 'Autovalut. ILO', href: '/autovalutazione-ilo', iconName: 'ClipboardList', minRole: 'standard' },
  { label: 'Fornitori', href: '/fornitori', iconName: 'Users', minRole: 'standard' },
  { label: 'Terzisti', href: '/terzisti', iconName: 'UserCheck', minRole: 'standard' },
  { label: 'Gruppi prodotto', href: '/gruppi-prodotto', iconName: 'Database', minRole: 'standard' },
  { label: 'Loghi', href: '/loghi', iconName: 'ImageIcon', minRole: 'standard' },
  {
    label: 'Movimentazioni',
    href: '/movimentazioni-bilancio',
    iconName: 'TrendingUp',
    minRole: 'premium',
  },
  { label: 'Master', href: '/master', iconName: 'Lock', minRole: 'admin' },
]

export default async function CloudFscLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <ToolNavbar
        toolName="CLOUD FSC"
        basePath="/cloud-fsc"
        userRole={role}
        items={CLOUD_FSC_NAV_ITEMS}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  )
}
