'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createBoscologLot, updateBoscologLot } from '@/actions/boscolog/lots'
import type { BoscologLot, BoscologLotInput, BoscologParty } from '@/types/boscolog'
import {
  BOSCOLOG_MODES,
  BOSCOLOG_ORIGIN_OPTIONS,
  BOSCOLOG_PRODUCT_CATEGORIES,
  BOSCOLOG_PRODUCT_TYPES,
  BOSCOLOG_QUICK_UNITS,
} from '@/lib/boscolog/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function readForm(fd: FormData): BoscologLotInput {
  return {
    name: String(fd.get('name') ?? ''),
    lot_date: String(fd.get('lot_date') ?? ''),
    mode: String(fd.get('mode') ?? 'diretta'),
    product_type: String(fd.get('product_type') ?? '') || null,
    product_other: String(fd.get('product_other') ?? ''),
    origin_eu: String(fd.get('origin_eu') ?? ''),
    state: String(fd.get('state') ?? ''),
    region: String(fd.get('region') ?? ''),
    province: String(fd.get('province') ?? ''),
    comune: String(fd.get('comune') ?? ''),
    localita: String(fd.get('localita') ?? ''),
    notes: String(fd.get('notes') ?? ''),
    cutting_date: String(fd.get('cutting_date') ?? ''),
    supplier_id: String(fd.get('supplier_id') ?? '') || null,
    dds_ref: String(fd.get('dds_ref') ?? ''),
    deforestation_free: String(fd.get('deforestation_free') ?? ''),
    custody_model: String(fd.get('custody_model') ?? ''),
    quick_species: String(fd.get('quick_species') ?? ''),
    quick_qty: String(fd.get('quick_qty') ?? ''),
    quick_unit: String(fd.get('quick_unit') ?? ''),
  }
}

export function BoscologLotForm({
  mode,
  lot,
  parties,
  canEdit = true,
}: {
  mode: 'create' | 'edit'
  lot?: BoscologLot | null
  parties: BoscologParty[]
  canEdit?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const suppliers = parties.filter((p) => p.role === 'Fornitore' || p.role === 'Ente')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canEdit) return
    const input = readForm(new FormData(e.currentTarget))
    if (!input.name.trim()) {
      toast.error('Inserisci il nome del lotto.')
      return
    }

    startTransition(async () => {
      if (mode === 'create') {
        const res = await createBoscologLot(input)
        if (!res.success || !res.id) {
          toast.error(res.error ?? 'Creazione fallita')
          return
        }
        toast.success('Lotto creato.')
        router.replace(`/boscolog/lotti/${res.id}`)
        router.refresh()
        return
      }
      if (!lot) return
      const res = await updateBoscologLot(lot.id, input)
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito')
        return
      }
      toast.success('Lotto salvato.')
      router.refresh()
    })
  }

  const disabled = !canEdit || pending

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="space-y-2 sm:col-span-4">
          <Label htmlFor="name">Nome lotto *</Label>
          <Input
            id="name"
            name="name"
            required
            disabled={disabled}
            defaultValue={lot?.name ?? ''}
            placeholder="Es. Lotto Chianocco 2026"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="lot_date">Data registrazione</Label>
          <Input
            id="lot_date"
            name="lot_date"
            type="date"
            disabled={disabled}
            defaultValue={lot?.lot_date ?? new Date().toISOString().slice(0, 10)}
          />
        </div>

        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="mode">Modalità filiera</Label>
          <select
            id="mode"
            name="mode"
            disabled={disabled}
            defaultValue={lot?.mode ?? 'diretta'}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {BOSCOLOG_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="product_type">Tipo prodotto</Label>
          <select
            id="product_type"
            name="product_type"
            disabled={disabled}
            defaultValue={lot?.product_type ?? ''}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">—</option>
            {BOSCOLOG_PRODUCT_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.label}>
                {BOSCOLOG_PRODUCT_TYPES.filter((p) => p.cat === cat.id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="product_other">Prodotto (altro / dettaglio)</Label>
          <Input
            id="product_other"
            name="product_other"
            disabled={disabled}
            defaultValue={lot?.product_other ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="cutting_date">Data taglio / raccolta</Label>
          <Input
            id="cutting_date"
            name="cutting_date"
            type="date"
            disabled={disabled}
            defaultValue={lot?.cutting_date ?? ''}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="comune">Comune</Label>
          <Input id="comune" name="comune" disabled={disabled} defaultValue={lot?.comune ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor="province">Prov.</Label>
          <Input
            id="province"
            name="province"
            maxLength={2}
            disabled={disabled}
            defaultValue={lot?.province ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="localita">Località</Label>
          <Input
            id="localita"
            name="localita"
            disabled={disabled}
            defaultValue={lot?.localita ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="region">Regione</Label>
          <Input
            id="region"
            name="region"
            disabled={disabled}
            defaultValue={lot?.region ?? 'Piemonte'}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="state">Stato</Label>
          <Input id="state" name="state" disabled={disabled} defaultValue={lot?.state ?? 'Italia'} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="origin_eu">Origine</Label>
          <select
            id="origin_eu"
            name="origin_eu"
            disabled={disabled}
            defaultValue={
              lot?.origin_eu === 'extraUE' ? 'extraUE' : lot?.origin_eu === 'UE' ? 'UE' : 'UE'
            }
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {BOSCOLOG_ORIGIN_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="supplier_id">Fornitore</Label>
          <select
            id="supplier_id"
            name="supplier_id"
            disabled={disabled}
            defaultValue={lot?.supplier_id ?? ''}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">— nessuno —</option>
            {suppliers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="dds_ref">Rif. DDS / DDT</Label>
          <Input id="dds_ref" name="dds_ref" disabled={disabled} defaultValue={lot?.dds_ref ?? ''} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="deforestation_free">Deforestazione zero</Label>
          <select
            id="deforestation_free"
            name="deforestation_free"
            disabled={disabled}
            defaultValue={
              lot?.deforestation_free === 'si'
                ? 'yes'
                : (lot?.deforestation_free ?? '')
            }
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">—</option>
            <option value="yes">Sì</option>
            <option value="no">No</option>
            <option value="nd">Non determinato</option>
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="custody_model">Catena di custodia</Label>
          <select
            id="custody_model"
            name="custody_model"
            disabled={disabled}
            defaultValue={lot?.custody_model ?? ''}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value="">—</option>
            <option value="segregazione">Segregazione</option>
            <option value="mass_balance">Mass balance</option>
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="quick_species">Specie (rapido)</Label>
          <Input
            id="quick_species"
            name="quick_species"
            disabled={disabled}
            defaultValue={lot?.quick_species ?? ''}
            placeholder="Es. faggio"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="quick_qty">Quantità (rapido)</Label>
          <Input
            id="quick_qty"
            name="quick_qty"
            disabled={disabled}
            defaultValue={lot?.quick_qty ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="quick_unit">Unità (rapido)</Label>
          <select
            id="quick_unit"
            name="quick_unit"
            disabled={disabled}
            defaultValue={lot?.quick_unit ?? 'm³'}
            className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {BOSCOLOG_QUICK_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-6">
          <Label htmlFor="notes">Note</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={disabled}
            defaultValue={lot?.notes ?? ''}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50"
          />
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvataggio...
              </span>
            ) : mode === 'create' ? (
              'Crea lotto'
            ) : (
              'Salva lotto'
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/boscolog/lotti')}>
            Torna alla lista
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Non hai permessi di modifica.</p>
      )}
    </form>
  )
}
