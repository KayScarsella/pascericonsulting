'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscSubcontractor,
  updateFscSubcontractor,
  type FscSubcontractorInput,
} from '@/actions/fsc/subcontractors'
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
import { FSC_CONTROL_FREQUENCY_OPTIONS } from '@/lib/fsc/partners'
import type { FscSubcontractorWithDetails } from '@/types/fsc'

type FscSubcontractorFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subcontractor?: FscSubcontractorWithDetails | null
}

const emptyForm = (): FscSubcontractorInput => ({
  ragione_sociale: '',
  is_certified: false,
  work_type: '',
  coc_risk: false,
  certificate_number: '',
  certificate_valid_until: '',
  last_control_date: '',
  control_frequency: 'annual',
})

export function FscSubcontractorFormDialog({
  open,
  onOpenChange,
  subcontractor,
}: FscSubcontractorFormDialogProps) {
  const router = useRouter()
  const isEdit = !!subcontractor
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FscSubcontractorInput>(emptyForm())

  useEffect(() => {
    if (!open) return
    if (subcontractor) {
      setForm({
        ragione_sociale: subcontractor.ragione_sociale,
        is_certified: subcontractor.is_certified,
        work_type: subcontractor.work_type ?? '',
        coc_risk: subcontractor.coc_risk,
        certificate_number: subcontractor.certificate_number ?? '',
        certificate_valid_until: subcontractor.certificate_valid_until ?? '',
        last_control_date: subcontractor.last_control_date ?? '',
        control_frequency: subcontractor.control_frequency,
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, subcontractor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = isEdit
        ? await updateFscSubcontractor(subcontractor!.id, form)
        : await createFscSubcontractor(form)

      if (!result.success) {
        toast.error(result.error ?? 'Salvataggio fallito')
        return
      }

      toast.success(isEdit ? 'Terzista aggiornato' : 'Terzista creato')
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
          <DialogTitle>{isEdit ? 'Modifica terzista' : 'Nuovo terzista'}</DialogTitle>
          <DialogDescription>
            Terzisti certificati o non certificati con lavorazioni e rischio CoC.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sub_ragione_sociale">Ragione sociale *</Label>
            <Input
              id="sub_ragione_sociale"
              value={form.ragione_sociale}
              onChange={(e) => setForm((p) => ({ ...p, ragione_sociale: e.target.value }))}
              required
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
            <Checkbox
              id="is_certified"
              checked={form.is_certified}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                setForm((p) => ({
                  ...p,
                  is_certified: checked === true,
                  ...(checked !== true
                    ? { certificate_number: '', certificate_valid_until: '' }
                    : {}),
                }))
              }
            />
            <Label htmlFor="is_certified">Certificato FSC</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work_type">Tipo lavorazione</Label>
            <Input
              id="work_type"
              value={form.work_type ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, work_type: e.target.value }))}
              placeholder="Es. verniciatura, assemblaggio…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="coc_risk"
              checked={form.coc_risk ?? false}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, coc_risk: checked === true }))
              }
            />
            <Label htmlFor="coc_risk">Rischio CoC</Label>
          </div>

          {form.is_certified && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sub_certificate_number">N. certificato *</Label>
                <Input
                  id="sub_certificate_number"
                  value={form.certificate_number ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, certificate_number: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub_certificate_valid_until">Validità *</Label>
                <Input
                  id="sub_certificate_valid_until"
                  type="date"
                  value={form.certificate_valid_until ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, certificate_valid_until: e.target.value }))
                  }
                  required
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sub_last_control_date">Ultimo controllo</Label>
              <Input
                id="sub_last_control_date"
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
                    control_frequency: v as FscSubcontractorInput['control_frequency'],
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
