import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { ToolNavbar, NavItem } from '@/components/ui/topBar'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { CloudFscSetupRedirect } from '@/components/cloud-fsc/company/CloudFscSetupRedirect'
import { FscCompanySwitcher } from '@/components/cloud-fsc/company/FscCompanySwitcher'

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
  { label: 'Impostazioni', href: '/impostazioni', iconName: 'Settings', minRole: 'standard' },
  { label: 'Master', href: '/master', iconName: 'Lock', minRole: 'admin' },
]

export default async function CloudFscLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getFscCompanyContext()

  const showSettings = Boolean(
    companyCtx.data &&
      (companyCtx.data.membership.member_type === 'owner' || role === 'admin')
  )

  const navItems = CLOUD_FSC_NAV_ITEMS.filter((item) => {
    if (item.href === '/impostazioni') return showSettings
    return true
  })

  const toolbarExtra =
    companyCtx.data && companyCtx.companies && companyCtx.companies.length > 0 ? (
      <FscCompanySwitcher
        companies={companyCtx.companies}
        activeCompanyId={companyCtx.data.company.id}
      />
    ) : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <CloudFscSetupRedirect needsSetup={Boolean(companyCtx.needsSetup)} userRole={role} />
      <ToolNavbar
        toolName="CLOUD FSC"
        basePath="/cloud-fsc"
        userRole={role}
        items={navItems}
        toolbarExtra={toolbarExtra}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  )
}
