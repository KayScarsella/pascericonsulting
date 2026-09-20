'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  createBoscologCompany,
  updateBoscologCompany,
  uploadBoscologCompanyLogo,
  removeBoscologCompanyLogo,
} from '@/actions/boscolog/company'
import type { BoscologCompany, BoscologCompanyInput } from '@/types/boscolog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function readCompanyForm(fd: FormData): BoscologCompanyInput {
  return {
    name: String(fd.get('name') ?? ''),
    vat: String(fd.get('vat') ?? ''),
    cf: String(fd.get('cf') ?? ''),
    address: String(fd.get('address') ?? ''),
    city: String(fd.get('city') ?? ''),
    province: String(fd.get('province') ?? ''),
    cap: String(fd.get('cap') ?? ''),
    phone: String(fd.get('phone') ?? ''),
    email: String(fd.get('email') ?? ''),
    pec: String(fd.get('pec') ?? ''),
    rea: String(fd.get('rea') ?? ''),
    legal_rep: String(fd.get('legal_rep') ?? ''),
  }
}

export function BoscologCompanyForm({
  mode,
  company,
  canEdit = true,
  logoUrl,
}: {
  mode: 'create' | 'edit'
  company?: BoscologCompany | null
  canEdit?: boolean
  logoUrl?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [logoPending, startLogoTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canEdit) return
    const input = readCompanyForm(new FormData(e.currentTarget))
    if (!input.name.trim()) {
      toast.error('Inserisci la ragione sociale.')
      return
    }

    startTransition(async () => {
      if (mode === 'create') {
        const res = await createBoscologCompany(input)
        if (!res.success) {
          toast.error(res.error ?? 'Creazione fallita')
          return
        }
        toast.success('Impresa creata.')
        router.refresh()
        return
      }

      if (!company) return
      const res = await updateBoscologCompany(company.id, input)
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito')
        return
      }
      toast.success('Dati azienda salvati.')
      router.refresh()
    })
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !company || !canEdit) return
    const fd = new FormData()
    fd.set('file', file)
    startLogoTransition(async () => {
      const res = await uploadBoscologCompanyLogo(company.id, fd)
      if (!res.success) {
        toast.error(res.error ?? 'Upload logo fallito')
        return
      }
      toast.success('Logo caricato.')
      router.refresh()
    })
  }

  const handleRemoveLogo = () => {
    if (!company || !canEdit) return
    startLogoTransition(async () => {
      const res = await removeBoscologCompanyLogo(company.id)
      if (!res.success) {
        toast.error(res.error ?? 'Rimozione fallita')
        return
      }
      toast.success('Logo rimosso.')
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    })
  }

  const disabled = !canEdit || pending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="name">Ragione sociale / Ditta *</Label>
          <Input
            id="name"
            name="name"
            required
            disabled={disabled}
            defaultValue={company?.name ?? ''}
            placeholder="Es. Impresa Boschiva Rossi Giovanni"
          />
        </div>
        <div className="space-y-2 sm:col-span-3 lg:col-span-1">
          <Label htmlFor="vat">Partita IVA</Label>
          <Input id="vat" name="vat" disabled={disabled} defaultValue={company?.vat ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-3 lg:col-span-2">
          <Label htmlFor="cf">Codice Fiscale</Label>
          <Input id="cf" name="cf" disabled={disabled} defaultValue={company?.cf ?? ''} />
        </div>

        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="address">Indirizzo sede legale</Label>
          <Input
            id="address"
            name="address"
            disabled={disabled}
            defaultValue={company?.address ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="city">Comune</Label>
          <Input id="city" name="city" disabled={disabled} defaultValue={company?.city ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="province">Prov.</Label>
          <Input
            id="province"
            name="province"
            maxLength={2}
            disabled={disabled}
            defaultValue={company?.province ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="cap">CAP</Label>
          <Input
            id="cap"
            name="cap"
            maxLength={5}
            disabled={disabled}
            defaultValue={company?.cap ?? ''}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" disabled={disabled} defaultValue={company?.phone ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            disabled={disabled}
            defaultValue={company?.email ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="pec">PEC</Label>
          <Input
            id="pec"
            name="pec"
            type="email"
            disabled={disabled}
            defaultValue={company?.pec ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="rea">N. REA / Albo</Label>
          <Input id="rea" name="rea" disabled={disabled} defaultValue={company?.rea ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="legal_rep">Rappresentante legale</Label>
          <Input
            id="legal_rep"
            name="legal_rep"
            disabled={disabled}
            defaultValue={company?.legal_rep ?? ''}
          />
        </div>
      </div>

      {mode === 'edit' && company ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <Label>Logo aziendale (intestazione documenti)</Label>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo azienda"
                className="h-12 max-w-[150px] rounded border border-slate-200 object-contain"
              />
            ) : (
              <span className="text-sm text-slate-500">Nessun logo caricato</span>
            )}
            <Input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={!canEdit || logoPending}
              onChange={handleLogoChange}
              className="max-w-xs"
            />
            {logoUrl ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canEdit || logoPending}
                onClick={handleRemoveLogo}
              >
                Rimuovi
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">Max 200KB. Formati: JPEG, PNG, WebP, GIF.</p>
        </div>
      ) : null}

      {canEdit ? (
        <Button type="submit" disabled={pending}>
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvataggio...
            </span>
          ) : mode === 'create' ? (
            'Crea impresa'
          ) : (
            'Salva dati azienda'
          )}
        </Button>
      ) : (
        <p className="text-sm text-slate-500">Non hai permessi di modifica su questa impresa.</p>
      )}
    </form>
  )
}
