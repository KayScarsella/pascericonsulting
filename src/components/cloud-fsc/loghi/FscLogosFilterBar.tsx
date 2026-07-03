'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FSC_LOGO_TYPE_OPTIONS } from '@/lib/fsc/logos'
import { FscEnterToSearchInput } from '@/components/cloud-fsc/shared/FscEnterToSearchInput'
import { useFscUrlParams } from '@/components/cloud-fsc/shared/useFscUrlParams'

export function FscLogosFilterBar() {
  const { searchParams, updateParams, isPending } = useFscUrlParams()

  const search = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? 'product'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <FscEnterToSearchInput
        value={search}
        placeholder="Cerca per codice o note…"
        disabled={isPending}
        onSearch={(q) => updateParams({ q: q || null })}
      />
      <Select
        value={type}
        onValueChange={(v) => updateParams({ type: v })}
        disabled={isPending}
      >
        <SelectTrigger className="w-full sm:w-[240px]">
          <SelectValue placeholder="Tipo logo" />
        </SelectTrigger>
        <SelectContent>
          {FSC_LOGO_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
