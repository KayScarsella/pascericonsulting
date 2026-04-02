import { getToolAccess } from '@/lib/tool-auth'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { redirect, notFound } from 'next/navigation'
import { getToolUsersForAdminPaginated } from '@/actions/users'
import { listSpeciesPaginated, listCountriesPaginated } from '@/actions/master-data'
import { listNotificationsPaginated } from '@/actions/notifications'
import { MasterSectionClient } from '@/components/admin/MasterSectionClient'
import type { MasterSection } from '@/components/admin/MasterSectionClient'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parsePageParam, parseSearchParam, parseSortDirParam } from '@/lib/table-query'

const VALID_SECTIONS: readonly MasterSection[] = ['users', 'species', 'countries', 'notifications']
const PAGE_SIZE = 25

export default async function MasterSectionPage({
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
  const { role } = await getToolAccess(EUDR_TOOL_ID)
  if (role !== 'admin') redirect('/landingPage')

  const sp = await searchParams
  const page = parsePageParam(sp.page, 1)
  const q = parseSearchParam(sp.q)
  const sort = (sp.sort as string) || undefined
  const dir = parseSortDirParam(sp.dir)

  let usersRes: Awaited<ReturnType<typeof getToolUsersForAdminPaginated>> | null = null
  let speciesRes: Awaited<ReturnType<typeof listSpeciesPaginated>> | null = null
  let countriesRes: Awaited<ReturnType<typeof listCountriesPaginated>> | null = null
  let notificationsRes: Awaited<ReturnType<typeof listNotificationsPaginated>> | null = null

  if (section === 'users') {
    usersRes = await getToolUsersForAdminPaginated(EUDR_TOOL_ID, page, PAGE_SIZE, { q })
  } else if (section === 'species') {
    speciesRes = await listSpeciesPaginated(EUDR_TOOL_ID, page, PAGE_SIZE, {
      q,
      sort: sort as any,
      dir,
    })
  } else if (section === 'countries') {
    countriesRes = await listCountriesPaginated(EUDR_TOOL_ID, page, PAGE_SIZE, {
      q,
      sort: sort as any,
      dir,
    })
  } else if (section === 'notifications') {
    notificationsRes = await listNotificationsPaginated(EUDR_TOOL_ID, page, PAGE_SIZE, {
      q,
      sort: sort as any,
      dir,
    })
  }

  const error =
    usersRes?.error ??
    speciesRes?.error ??
    countriesRes?.error ??
    notificationsRes?.error
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Errore: {error}
      </div>
    )
  }

  const totalCount =
    usersRes?.totalCount ??
    speciesRes?.totalCount ??
    countriesRes?.totalCount ??
    notificationsRes?.totalCount ??
    0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1
  const basePath = `/EUDR/master/${section}`

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/EUDR/master" className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Master
        </Link>
      </Button>
      <MasterSectionClient
        section={section as MasterSection}
        toolId={EUDR_TOOL_ID}
        usersData={section === 'users' ? (usersRes?.data ?? null) : undefined}
        speciesData={section === 'species' ? (speciesRes?.data ?? null) : undefined}
        countriesData={section === 'countries' ? (countriesRes?.data ?? null) : undefined}
        notificationsData={section === 'notifications' ? (notificationsRes?.data ?? null) : undefined}
        page={page}
        totalPages={totalPages}
        basePath={basePath}
      />
    </div>
  )
}
