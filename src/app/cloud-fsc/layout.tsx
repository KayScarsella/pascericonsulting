import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { ToolNavbar, NavItem } from '@/components/ui/topBar'
import { getFscCompanyContext } from '@/actions/fsc/company'
import { FscCompanySwitcher } from '@/components/cloud-fsc/company/FscCompanySwitcher'
import { FscNavbarSettingsButton } from '@/components/cloud-fsc/FscNavbarSettingsButton'
import { ToolPreviewBanner } from '@/components/ToolPreviewBanner'

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

const ONBOARDING_NAV_ITEMS: NavItem[] = [
  { label: 'Presentazione', href: '/presentazione', iconName: 'BookOpen', minRole: 'standard' },
  { label: 'Configura impresa', href: '/setup', iconName: 'Settings', minRole: 'premium' },
]

export default async function CloudFscLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role, isToolActive } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getFscCompanyContext()

  const inOnboarding = Boolean(companyCtx.needsSetup && role !== 'admin')

  const navItems = (inOnboarding ? ONBOARDING_NAV_ITEMS : CLOUD_FSC_NAV_ITEMS).filter((item) => {
    if (item.href === '/setup') return role === 'premium'
    if (item.href === '/presentazione') return role !== 'premium'
    return true
  })

  const headerLeading = inOnboarding ? undefined : <FscNavbarSettingsButton />

  const toolbarExtra =
    companyCtx.data && companyCtx.companies && companyCtx.companies.length > 0 ? (
      <FscCompanySwitcher
        companies={companyCtx.companies}
        activeCompanyId={companyCtx.data.company.id}
      />
    ) : null

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <ToolNavbar
        toolName="CLOUD FSC"
        basePath="/cloud-fsc"
        userRole={role}
        items={navItems}
        toolbarExtra={toolbarExtra}
        headerLeading={headerLeading}
      />
      {!isToolActive && <ToolPreviewBanner toolName="CLOUD FSC" />}
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  )
}
