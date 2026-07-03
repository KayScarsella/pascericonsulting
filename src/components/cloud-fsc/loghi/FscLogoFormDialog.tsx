'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscLogo,
  getFscLogo,
  updateFscLogo,
  type FscLogoInput,
} from '@/actions/fsc/logos'
import { FscLogoFileSlot } from '@/components/cloud-fsc/loghi/FscLogoFileSlot'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FSC_LOGO_TYPE_OPTIONS } from '@/lib/fsc/logos'
import type { FscLogo, FscLogoType } from '@/types/fsc'

type FscLogoFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  logo?: FscLogo | null
  defaultType?: FscLogoType
  canEdit?: boolean
}

export function FscLogoFormDialog({
  open,
  onOpenChange,
  logo: initialLogo,
  defaultType = 'product',
  canEdit = true,
}: FscLogoFormDialogProps) {
  const router = useRouter()
  const isEdit = !!initialLogo
  const [loading, setLoading] = useState(false)
  const [logo, setLogo] = useState<FscLogo | null>(initialLogo ?? null)
  const [form, setForm] = useState<FscLogoInput>({
    logo_type: defaultType,
    notes: '',
  })

  useEffect(() => {
    if (!open) return

    if (initialLogo) {
      setLogo(initialLogo)
      setForm({
        logo_type: initialLogo.logo_type,
        notes: initialLogo.notes ?? '',
      })
    } else {
      setLogo(null)
      setForm({
        logo_type: defaultType,
        notes: '',
      })
    }
  }, [open, initialLogo, defaultType])

  const refreshLogo = async () => {
    if (!logo?.id) return
    const result = await getFscLogo(logo.id)
    if (result.success && result.data) {
      setLogo(result.data)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (isEdit && logo) {
        const result = await updateFscLogo(logo.id, { notes: form.notes })
        if (!result.success) {
          toast.error(result.error ?? 'Salvataggio fallito')
          return
        }
        if (result.data) setLogo(result.data)
        toast.success('Logo aggiornato')
        router.refresh()
        return
      }

      const result = await createFscLogo(form)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Creazione fallita')
        return
      }
      setLogo(result.data)
      toast.success(`Logo creato — codice ${result.data.progressive_code}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const readOnly = !canEdit
  const showFiles = !!logo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? (readOnly ? 'Dettaglio logo' : 'Modifica logo') : 'Nuovo logo'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Visualizza o modifica i dati e i file del logo.'
              : 'Crea un nuovo logo: il codice progressivo viene assegnato automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {logo && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Codice progressivo
              </p>
              <p className="font-mono text-lg font-semibold text-slate-900">
                {logo.progressive_code}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="logo-type">Tipo logo</Label>
            <Select
              value={form.logo_type}
              onValueChange={(v) => setForm((f) => ({ ...f, logo_type: v as FscLogoType }))}
              disabled={readOnly || isEdit}
            >
              <SelectTrigger id="logo-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FSC_LOGO_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-slate-500">Il tipo non può essere modificato dopo la creazione.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-notes">Note descrittive</Label>
            <textarea
              id="logo-notes"
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Descrizione del logo, prodotto, cliente…"
              rows={3}
              disabled={readOnly}
              className="border-input placeholder:text-muted-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {showFiles && logo && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-800">File allegati</p>
              <FscLogoFileSlot
                logoId={logo.id}
                fileKind="approval"
                storagePath={logo.approval_file_path ?? null}
                canEdit={canEdit}
                onUpdated={() => void refreshLogo()}
              />
              <FscLogoFileSlot
                logoId={logo.id}
                fileKind="graphic"
                storagePath={logo.graphic_file_path ?? null}
                canEdit={canEdit}
                onUpdated={() => void refreshLogo()}
              />
            </div>
          )}

          {!showFiles && !readOnly && (
            <p className="text-sm text-slate-500">
              Salva il logo per abilitare il caricamento dell&apos;email di approvazione e della
              grafica.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {showFiles && readOnly ? 'Chiudi' : 'Annulla'}
          </Button>
          {!readOnly && (
            <Button
              type="button"
              className="bg-[#967635] hover:bg-[#7d6230]"
              disabled={loading}
              onClick={() => void handleSave()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salva note' : logo ? 'Salva note' : 'Crea logo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
