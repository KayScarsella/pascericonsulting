'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FSC_PRODUCT_GROUP_STATUS_OPTIONS } from '@/lib/fsc/product-groups'

export function FscProductGroupsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'active'

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || (key === 'status' && value === 'all')) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      startTransition(() => {
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname)
      })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        placeholder="Cerca per nome, codice FSC o input…"
        defaultValue={search}
        className="sm:max-w-xs"
        disabled={isPending}
        onChange={(e) => updateParams({ q: e.target.value || null })}
      />
      <Select
        value={status}
        onValueChange={(v) => updateParams({ status: v === 'all' ? null : v })}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti</SelectItem>
          {FSC_PRODUCT_GROUP_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
