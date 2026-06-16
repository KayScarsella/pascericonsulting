'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscSupplier,
  updateFscSupplier,
  type FscSupplierInput,
} from '@/actions/fsc/suppliers'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FSC_CONTROL_FREQUENCY_OPTIONS,
  FSC_PRODUCT_CLAIM_OPTIONS,
} from '@/lib/fsc/partners'
import type { FscProductClaim, FscSupplierWithDetails } from '@/types/fsc'

type FscSupplierFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: FscSupplierWithDetails | null
}

const emptyForm = (): FscSupplierInput & { claimsSet: Set<FscProductClaim> } => ({
  ragione_sociale: '',
  certificate_number: '',
  certificate_valid_until: '',
  last_control_date: '',
  control_frequency: 'annual',
  claimsSet: new Set(),
})

export function FscSupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: FscSupplierFormDialogProps) {
  const router = useRouter()
  const isEdit = !!supplier
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return
    if (supplier) {
      setForm({
        ragione_sociale: supplier.ragione_sociale,
        certificate_number: supplier.certificate_number ?? '',
        certificate_valid_until: supplier.certificate_valid_until ?? '',
        last_control_date: supplier.last_control_date ?? '',
        control_frequency: supplier.control_frequency,
        claimsSet: new Set(supplier.claims),
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, supplier])

  const toggleClaim = (claim: FscProductClaim) => {
    setForm((prev) => {
      const next = new Set(prev.claimsSet)
      if (next.has(claim)) {
        next.delete(claim)
      } else if (next.size < 2) {
        next.add(claim)
      } else {
        toast.error('Massimo 2 claim per fornitore')
        return prev
      }
      return { ...prev, claimsSet: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const input: FscSupplierInput = {
        ragione_sociale: form.ragione_sociale,
        certificate_number: form.certificate_number || null,
        certificate_valid_until: form.certificate_valid_until || null,
        last_control_date: form.last_control_date || null,
        control_frequency: form.control_frequency,
        claims: [...form.claimsSet],
      }

      const result = isEdit
        ? await updateFscSupplier(supplier!.id, input)
        : await createFscSupplier(input)

      if (!result.success) {
        toast.error(result.error ?? 'Salvataggio fallito')
        return
      }

      toast.success(isEdit ? 'Fornitore aggiornato' : 'Fornitore creato')
      onOpenChange(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica fornitore' : 'Nuovo fornitore'}</DialogTitle>
          <DialogDescription>
            Dati certificazione e gruppi di prodotto vendibili (max 2 claim).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ragione_sociale">Ragione sociale *</Label>
            <Input
              id="ragione_sociale"
              value={form.ragione_sociale}
              onChange={(e) => setForm((p) => ({ ...p, ragione_sociale: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="certificate_number">N. certificato</Label>
              <Input
                id="certificate_number"
                value={form.certificate_number ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, certificate_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="certificate_valid_until">Validità certificato</Label>
              <Input
                id="certificate_valid_until"
                type="date"
                value={form.certificate_valid_until ?? ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, certificate_valid_until: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="last_control_date">Ultimo controllo</Label>
              <Input
                id="last_control_date"
                type="date"
                value={form.last_control_date ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, last_control_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Frequenza controllo</Label>
              <Select
                value={form.control_frequency}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    control_frequency: v as FscSupplierInput['control_frequency'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FSC_CONTROL_FREQUENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gruppi di prodotto vendibili (max 2)</Label>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              {FSC_PRODUCT_CLAIM_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.claimsSet.has(opt.value)}
                    onCheckedChange={() => toggleClaim(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
