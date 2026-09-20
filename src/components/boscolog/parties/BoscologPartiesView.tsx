'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createBoscologParty,
  deleteBoscologParty,
  updateBoscologParty,
} from '@/actions/boscolog/parties'
import type { BoscologParty, BoscologPartyInput, BoscologPartyRole } from '@/types/boscolog'
import { BOSCOLOG_PARTY_ROLES } from '@/types/boscolog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

function emptyForm(): BoscologPartyInput {
  return {
    name: '',
    role: 'Acquirente',
    vat: '',
    address: '',
    notes: '',
    bp_cert_id: '',
    bp_expire: '',
    bp_org: '',
  }
}

function partyToForm(p: BoscologParty): BoscologPartyInput {
  return {
    name: p.name,
    role: p.role,
    vat: p.vat ?? '',
    address: p.address ?? '',
    notes: p.notes ?? '',
    bp_cert_id: p.bp_cert_id ?? '',
    bp_expire: p.bp_expire ?? '',
    bp_org: p.bp_org ?? '',
  }
}

function bpBadge(expire: string | null) {
  if (!expire) return null
  const exp = new Date(`${expire}T00:00:00`)
  const days = Math.round((exp.getTime() - Date.now()) / 86400000)
  if (Number.isNaN(days)) return null
  if (days < 0) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">BiomassPlus scaduto</Badge>
  }
  if (days < 60) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        BiomassPlus {days}g
      </Badge>
    )
  }
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">BiomassPlus</Badge>
}

export function BoscologPartiesView({
  initialParties,
  canEdit,
}: {
  initialParties: BoscologParty[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [parties, setParties] = useState(initialParties)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<BoscologPartyRole | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<BoscologParty | null>(null)
  const [form, setForm] = useState<BoscologPartyInput>(emptyForm())
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setParties(initialParties)
  }, [initialParties])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return parties.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false
      if (!needle) return true
      const hay = `${p.name} ${p.vat ?? ''} ${p.address ?? ''} ${p.notes ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [parties, q, roleFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  const openEdit = (p: BoscologParty) => {
    setEditing(p)
    setForm(partyToForm(p))
    setOpen(true)
  }

  const handleSave = () => {
    if (!canEdit) return
    if (!form.name.trim()) {
      toast.error('Inserisci il nome / ragione sociale.')
      return
    }
    startTransition(async () => {
      if (editing) {
        const res = await updateBoscologParty(editing.id, form)
        if (!res.success) {
          toast.error(res.error ?? 'Salvataggio fallito')
          return
        }
        toast.success('Anagrafica aggiornata.')
      } else {
        const res = await createBoscologParty(form)
        if (!res.success) {
          toast.error(res.error ?? 'Creazione fallita')
          return
        }
        toast.success('Anagrafica creata.')
      }
      setOpen(false)
      router.refresh()
    })
  }

  const handleDelete = (p: BoscologParty) => {
    if (!canEdit) return
    if (!confirm(`Eliminare l'anagrafica "${p.name}"?`)) return
    startTransition(async () => {
      const res = await deleteBoscologParty(p.id)
      if (!res.success) {
        toast.error(res.error ?? 'Eliminazione fallita')
        return
      }
      setParties((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('Anagrafica eliminata.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="space-y-2 sm:max-w-xs sm:flex-1">
            <Label htmlFor="party_q">Cerca</Label>
            <Input
              id="party_q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, P.IVA, indirizzo..."
            />
          </div>
          <div className="space-y-2 sm:w-48">
            <Label>Ruolo</Label>
            <Select
              value={roleFilter}
              onValueChange={(v) => setRoleFilter(v as BoscologPartyRole | 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tutti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                {BOSCOLOG_PARTY_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {canEdit ? (
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Nuova anagrafica
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead>P.IVA / CF</TableHead>
              <TableHead>BiomassPlus</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-slate-500">
                  Nessuna anagrafica.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.role}</TableCell>
                  <TableCell className="text-slate-600">{p.vat || '—'}</TableCell>
                  <TableCell>{bpBadge(p.bp_expire)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canEdit ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(p)}
                            aria-label="Modifica"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(p)}
                            aria-label="Elimina"
                            disabled={pending}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifica anagrafica' : 'Nuova anagrafica'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="p_name">Nome / Ragione sociale *</Label>
              <Input
                id="p_name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as BoscologPartyRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOSCOLOG_PARTY_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_vat">P.IVA / CF</Label>
              <Input
                id="p_vat"
                value={form.vat ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, vat: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_address">Indirizzo</Label>
              <Input
                id="p_address"
                value={form.address ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_notes">Note</Label>
              <textarea
                id="p_notes"
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>
            <p className="text-sm font-medium text-slate-700">Certificazione BiomassPlus (facoltativo)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="p_bp">Codice</Label>
                <Input
                  id="p_bp"
                  value={form.bp_cert_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bp_cert_id: e.target.value }))}
                  placeholder="BP-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_bp_exp">Scadenza</Label>
                <Input
                  id="p_bp_exp"
                  type="date"
                  value={form.bp_expire ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bp_expire: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_bp_org">Organismo</Label>
                <Input
                  id="p_bp_org"
                  value={form.bp_org ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bp_org: e.target.value }))}
                  placeholder="ENAMA"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvataggio...
                </span>
              ) : (
                'Salva'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
