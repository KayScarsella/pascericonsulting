'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FSC_PRODUCT_GROUP_STATUS_OPTIONS } from '@/lib/fsc/product-groups'
import { FscEnterToSearchInput } from '@/components/cloud-fsc/shared/FscEnterToSearchInput'
import { useFscUrlParams } from '@/components/cloud-fsc/shared/useFscUrlParams'

export function FscProductGroupsFilterBar() {
  const { searchParams, updateParams, isPending } = useFscUrlParams()

  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'active'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FscEnterToSearchInput
        value={search}
        placeholder="Cerca per nome, codice FSC o parole chiave…"
        disabled={isPending}
        onSearch={(q) => updateParams({ q: q || null })}
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
