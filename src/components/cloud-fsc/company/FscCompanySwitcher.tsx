'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setActiveFscCompany } from '@/actions/fsc/company'
import type { FscCompany } from '@/types/fsc'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

type FscCompanySwitcherProps = {
  companies: FscCompany[]
  activeCompanyId: string
}

export function FscCompanySwitcher({ companies, activeCompanyId }: FscCompanySwitcherProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (companies.length <= 1) return null

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Building2 className="h-4 w-4 text-slate-400" aria-hidden />
      <Select
        value={activeCompanyId}
        disabled={pending}
        onValueChange={(companyId) => {
          startTransition(async () => {
            const res = await setActiveFscCompany(companyId)
            if (!res.success) {
              toast.error(res.error ?? 'Impossibile cambiare impresa.')
              return
            }
            router.refresh()
          })
        }}
      >
        <SelectTrigger className="h-8 w-[200px] border-slate-200 text-sm">
          <SelectValue placeholder="Seleziona impresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.ragione_sociale}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
