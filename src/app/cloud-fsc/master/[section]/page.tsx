import { getToolAccess } from '@/lib/tool-auth'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { redirect, notFound } from 'next/navigation'
import { getToolUsersForAdminPaginated } from '@/actions/users'
import { MasterSectionClient } from '@/components/admin/MasterSectionClient'
import { parsePageParam, parseSearchParam } from '@/lib/table-query'

const VALID_SECTIONS = ['users'] as const
const PAGE_SIZE = 25

export default async function CloudFscMasterSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { section } = await params
  if (!VALID_SECTIONS.includes(section as (typeof VALID_SECTIONS)[number])) {
    notFound()
  }

  const { role } = await getToolAccess(CLOUD_FSC_TOOL_ID)
  if (role !== 'admin') redirect('/landingPage')

  const sp = await searchParams
  const page = parsePageParam(sp.page, 1)
  const q = parseSearchParam(sp.q)

  const usersRes = await getToolUsersForAdminPaginated(CLOUD_FSC_TOOL_ID, page, PAGE_SIZE, { q })

  if (usersRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Errore: {usersRes.error}
      </div>
    )
  }

  const totalPages = Math.ceil((usersRes.totalCount ?? 0) / PAGE_SIZE) || 1

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-900 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Master CLOUD FSC</h1>
        <p className="text-slate-300">Gestione utenti e permessi sul tool.</p>
      </div>

      <MasterSectionClient
        section="users"
        toolId={CLOUD_FSC_TOOL_ID}
        usersData={usersRes.data ?? null}
        page={page}
        totalPages={totalPages}
        basePath="/cloud-fsc/master/users"
      />
    </div>
  )
}
