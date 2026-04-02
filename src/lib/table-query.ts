export type SortDir = 'asc' | 'desc'

export type TableQueryParams = {
  page: number
  q: string
  sort: string | null
  dir: SortDir
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function parsePageParam(
  value: string | string[] | undefined,
  defaultPage: number = 1
): number {
  const raw = firstParam(value)
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(n) || n < 1) return defaultPage
  return n
}

export function parseSearchParam(
  value: string | string[] | undefined,
  maxLen: number = 200
): string {
  const raw = (firstParam(value) ?? '').trim()
  if (!raw) return ''
  return raw.slice(0, maxLen)
}

export function parseSortDirParam(value: string | string[] | undefined): SortDir {
  const raw = (firstParam(value) ?? '').toLowerCase()
  return raw === 'asc' ? 'asc' : 'desc'
}

export function parseSortKeyParam(
  value: string | string[] | undefined,
  allowed: readonly string[]
): string | null {
  const raw = firstParam(value)
  if (!raw) return null
  return allowed.includes(raw) ? raw : null
}

export function parseTableQueryParams(opts: {
  params: Record<string, string | string[] | undefined>
  allowedSortKeys: readonly string[]
  defaultDir?: SortDir
  defaultPage?: number
}): TableQueryParams {
  const page = parsePageParam(opts.params.page, opts.defaultPage ?? 1)
  const q = parseSearchParam(opts.params.q)
  const sort = parseSortKeyParam(opts.params.sort, opts.allowedSortKeys)
  const dir =
    sort == null ? (opts.defaultDir ?? 'desc') : parseSortDirParam(opts.params.dir)
  return { page, q, sort, dir }
}

