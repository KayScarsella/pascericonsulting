'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscCompanyProductGroup,
  listFscOfficialProductGroupsCatalog,
  searchFscProductGroupsCatalog,
  updateFscCompanyProductGroup,
  type FscCompanyProductGroupInput,
} from '@/actions/fsc/product-groups'
import { AsyncSelect } from '@/components/shared/AsyncSelect'
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
import { FSC_PRODUCT_CLAIM_OPTIONS } from '@/lib/fsc/partners'
import type {
  FscCompanyProductGroupWithDetails,
  FscProductClaim,
  FscProductGroupCatalog,
} from '@/types/fsc'

type FscProductGroupFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: FscCompanyProductGroupWithDetails | null
  onCreated?: (group: FscCompanyProductGroupWithDetails) => void
}

type FormState = FscCompanyProductGroupInput & {
  mode: 'catalog' | 'custom'
  catalogSearch: string
  catalogGroupId: string
  claimsSet: Set<FscProductClaim>
}

const emptyForm = (): FormState => ({
  mode: 'catalog',
  catalogSearch: '',
  catalogGroupId: '',
  custom_label: '',
  species_id: null,
  required_inputs: '',
  claimsSet: new Set(),
})

export function FscProductGroupFormDialog({
  open,
  onOpenChange,
  group,
  onCreated,
}: FscProductGroupFormDialogProps) {
  const router = useRouter()
  const isEdit = !!group
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [officialCatalog, setOfficialCatalog] = useState<FscProductGroupCatalog[]>([])
  const [searchResults, setSearchResults] = useState<FscProductGroupCatalog[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!open) return

    void listFscOfficialProductGroupsCatalog().then(setOfficialCatalog)

    if (group) {
      setForm({
        mode: group.catalog_group_id ? 'catalog' : 'custom',
        catalogSearch: '',
        catalogGroupId: group.catalog_group_id ?? '',
        custom_label: group.custom_label ?? '',
        species_id: group.species_id,
        required_inputs: group.required_inputs ?? '',
        claimsSet: new Set(group.claims),
      })
    } else {
      setForm(emptyForm())
      setSearchResults([])
    }
  }, [open, group])

  useEffect(() => {
    if (!open || isEdit || form.mode !== 'catalog') return

    const timer = setTimeout(() => {
      setSearching(true)
      void searchFscProductGroupsCatalog(form.catalogSearch)
        .then(setSearchResults)
        .finally(() => setSearching(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [open, isEdit, form.mode, form.catalogSearch])

  const catalogOptions = useMemo(() => {
    if (isEdit) return officialCatalog
    if (form.catalogSearch.trim()) return searchResults
    return officialCatalog
  }, [isEdit, form.catalogSearch, officialCatalog, searchResults])

  const toggleClaim = (claim: FscProductClaim) => {
    setForm((prev) => {
      const next = new Set(prev.claimsSet)
      if (next.has(claim)) next.delete(claim)
      else next.add(claim)
      return { ...prev, claimsSet: next }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const input: FscCompanyProductGroupInput = {
        catalog_group_id: form.mode === 'catalog' ? form.catalogGroupId || null : null,
        custom_label: form.mode === 'custom' ? form.custom_label?.trim() || null : null,
        species_id: form.species_id || null,
        required_inputs: form.required_inputs?.trim() || null,
        claims: [...form.claimsSet],
      }

      if (!isEdit && form.mode === 'catalog' && !input.catalog_group_id) {
        toast.error('Seleziona un gruppo dal catalogo FSC')
        return
      }
      if (!isEdit && form.mode === 'custom' && !input.custom_label) {
        toast.error('Inserisci un nome per il gruppo personalizzato')
        return
      }

      const result = isEdit
        ? await updateFscCompanyProductGroup(group!.id, input)
        : await createFscCompanyProductGroup(input)

      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Operazione fallita')
        return
      }

      toast.success(isEdit ? 'Gruppo aggiornato' : 'Gruppo attivato')
      onOpenChange(false)
      router.refresh()
      if (!isEdit) onCreated?.(result.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica gruppo' : 'Nuovo gruppo di prodotto'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Aggiorna claim, specie e input necessari.'
              : 'Attiva un gruppo dal catalogo FSC o crea un gruppo personalizzato.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-3">
              <Label>Tipo gruppo</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.mode === 'catalog'}
                    onChange={() => setForm((p) => ({ ...p, mode: 'catalog' }))}
                  />
                  Da catalogo FSC
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={form.mode === 'custom'}
                    onChange={() => setForm((p) => ({ ...p, mode: 'custom' }))}
                  />
                  Personalizzato
                </label>
              </div>
            </div>
          )}

          {!isEdit && form.mode === 'catalog' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="catalog-search">Ricerca per parola chiave</Label>
                <Input
                  id="catalog-search"
                  placeholder="Es. legno, carta, plywood…"
                  value={form.catalogSearch}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, catalogSearch: e.target.value, catalogGroupId: '' }))
                  }
                />
                {searching && (
                  <p className="text-xs text-slate-500">Ricerca in corso…</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gruppo FSC ufficiale</Label>
                <Select
                  value={form.catalogGroupId}
                  onValueChange={(v) => setForm((p) => ({ ...p, catalogGroupId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona gruppo FSC" />
                  </SelectTrigger>
                  <SelectContent className="max-h-52">
                    {catalogOptions.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Nessun risultato
                      </SelectItem>
                    ) : (
                      catalogOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.code ? `${item.code} — ` : ''}
                          {item.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {!isEdit && form.mode === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-label">Nome gruppo personalizzato</Label>
              <Input
                id="custom-label"
                value={form.custom_label ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, custom_label: e.target.value }))}
                placeholder="Es. Prodotto speciale non in catalogo"
              />
            </div>
          )}

          {isEdit && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Gruppo: </span>
              {group?.catalog?.name ?? group?.custom_label ?? '—'}
              {group?.catalog?.code ? ` (${group.catalog.code})` : ''}
            </div>
          )}

          <div className="space-y-2">
            <Label>Claim (selezione multipla)</Label>
            <div className="flex flex-col gap-2">
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

          <div className="space-y-2">
            <Label>Specie (opzionale)</Label>
            <AsyncSelect
              config={{
                source_table: 'species',
                source_label_col: 'common_name',
                source_value_col: 'id',
                source_extra_cols: ['scientific_name'],
                placeholder: 'Cerca specie…',
              }}
              value={form.species_id}
              onChange={(v) =>
                setForm((p) => ({ ...p, species_id: v ? v : null }))
              }
              clearLabel="Nessuna specie"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-inputs">Input necessari</Label>
            <textarea
              id="required-inputs"
              value={form.required_inputs ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, required_inputs: e.target.value }))}
              placeholder="Descrivi gli input necessari per questo gruppo…"
              rows={3}
              className="border-input placeholder:text-muted-foreground flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#967635] hover:bg-[#7d6230]">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salva' : 'Attiva gruppo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
