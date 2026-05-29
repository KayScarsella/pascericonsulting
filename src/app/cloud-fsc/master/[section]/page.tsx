import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { redirect, notFound } from 'next/navigation'
import { getToolUsersForAdminPaginated } from '@/actions/users'
import { getEmailSupervisionForTool } from '@/actions/email-supervision'
import { MasterSectionClient, type MasterSection } from '@/components/admin/MasterSectionClient'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parsePageParam, parseSearchParam } from '@/lib/table-query'

const VALID_SECTIONS: readonly MasterSection[] = ['users', 'email-supervision']
const PAGE_SIZE = 25

export default async function CloudFscMasterSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { section } = await params
  if (!VALID_SECTIONS.includes(section as MasterSection)) {
    notFound()
  }

  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') redirect('/landingPage')

  const sp = await searchParams
  const page = parsePageParam(sp.page, 1)
  const q = parseSearchParam(sp.q)
  const basePath = `/cloud-fsc/master/${section}`

  let usersRes: Awaited<ReturnType<typeof getToolUsersForAdminPaginated>> | null = null
  let emailSupervisionRes: Awaited<ReturnType<typeof getEmailSupervisionForTool>> | null = null

  if (section === 'users') {
    usersRes = await getToolUsersForAdminPaginated(CLOUD_FSC_TOOL_ID, page, PAGE_SIZE, { q })
  } else if (section === 'email-supervision') {
    emailSupervisionRes = await getEmailSupervisionForTool(CLOUD_FSC_TOOL_ID, page, PAGE_SIZE, { q })
  }

  const error = usersRes?.error ?? emailSupervisionRes?.error
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Errore: {error}
      </div>
    )
  }

  const totalCount = usersRes?.totalCount ?? emailSupervisionRes?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/cloud-fsc/master" className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Master
        </Link>
      </Button>

      <MasterSectionClient
        section={section as MasterSection}
        toolId={CLOUD_FSC_TOOL_ID}
        usersData={section === 'users' ? (usersRes?.data ?? null) : undefined}
        emailSupervisionData={
          section === 'email-supervision' ? (emailSupervisionRes?.data ?? null) : undefined
        }
        resendConfigured={emailSupervisionRes?.resendConfigured ?? false}
        needsResendTotalCount={emailSupervisionRes?.needsResendTotalCount ?? 0}
        emailSupervisionTotalUserCount={emailSupervisionRes?.totalCount ?? 0}
        page={page}
        totalPages={totalPages}
        basePath={basePath}
      />
    </div>
  )
}
