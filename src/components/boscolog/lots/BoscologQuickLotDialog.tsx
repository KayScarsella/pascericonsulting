'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createBoscologLotQuick } from '@/actions/boscolog/lots'
import type { BoscologParty } from '@/types/boscolog'
import {
  BOSCOLOG_PRODUCT_CATEGORIES,
  BOSCOLOG_PRODUCT_TYPES,
  BOSCOLOG_QUICK_UNITS,
} from '@/lib/boscolog/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function BoscologQuickLotDialog({
  open,
  onOpenChange,
  parties,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parties: BoscologParty[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const suppliers = parties.filter((p) => p.role === 'Fornitore' || p.role === 'Ente')
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    quick_species: '',
    product_type: 'cippato',
    quick_qty: '',
    quick_unit: 'm³',
    comune: '',
    cutting_date: today,
    supplier_id: '',
    dds_ref: '',
    notes: '',
  })

  const handleSave = () => {
    startTransition(async () => {
      const res = await createBoscologLotQuick({
        ...form,
        supplier_id: form.supplier_id || null,
      })
      if (!res.success || !res.id) {
        toast.error(res.error ?? 'Creazione fallita')
        return
      }
      toast.success('Lotto rapido creato.')
      onOpenChange(false)
      router.push(`/boscolog/lotti/${res.id}`)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lotto rapido</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Compila solo i campi essenziali. Specie/uscite/autorizzazioni complete arriveranno nelle
          fasi successive.
        </p>
        <div className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cosa? (specie)</Label>
            <Input
              value={form.quick_species}
              onChange={(e) => setForm((f) => ({ ...f, quick_species: e.target.value }))}
              placeholder="Es. faggio, larice..."
              autoFocus
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Tipo prodotto</Label>
            <select
              value={form.product_type}
              onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
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
          <div className="space-y-2">
            <Label>Quanto?</Label>
            <Input
              value={form.quick_qty}
              onChange={(e) => setForm((f) => ({ ...f, quick_qty: e.target.value }))}
              placeholder="Es. 30"
            />
          </div>
          <div className="space-y-2">
            <Label>Unità</Label>
            <select
              value={form.quick_unit}
              onChange={(e) => setForm((f) => ({ ...f, quick_unit: e.target.value }))}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {BOSCOLOG_QUICK_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Dove? (comune)</Label>
            <Input
              value={form.comune}
              onChange={(e) => setForm((f) => ({ ...f, comune: e.target.value }))}
              placeholder="Es. Chianocco"
            />
          </div>
          <div className="space-y-2">
            <Label>Quando? (data taglio)</Label>
            <Input
              type="date"
              value={form.cutting_date}
              onChange={(e) => setForm((f) => ({ ...f, cutting_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Fornitore</Label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">— seleziona o lascia vuoto —</option>
              {suppliers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>DDT / riferimento</Label>
            <Input
              value={form.dds_ref}
              onChange={(e) => setForm((f) => ({ ...f, dds_ref: e.target.value }))}
              placeholder="Es. DDT 2026/001"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Note</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creazione...
              </span>
            ) : (
              'Crea lotto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
