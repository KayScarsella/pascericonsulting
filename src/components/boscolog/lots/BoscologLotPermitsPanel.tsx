'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createBoscologLotPermit,
  deleteBoscologLotPermit,
  updateBoscologLotPermit,
} from '@/actions/boscolog/lot-operations'
import type { BoscologLotPermit, BoscologLotPermitInput } from '@/types/boscolog'
import { BOSCOLOG_PERMIT_TYPES, permitLabel } from '@/lib/boscolog/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function emptyPermit(): BoscologLotPermitInput {
  return {
    type: 'forestale',
    other: '',
    protocol: '',
    authority: '',
    issue_date: '',
    expire_date: '',
    notes: '',
  }
}

function permitBadge(expire: string | null) {
  if (!expire) return null
  const exp = new Date(`${expire}T00:00:00`)
  const days = Math.round((exp.getTime() - Date.now()) / 86400000)
  if (Number.isNaN(days)) return null
  if (days < 0) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Scaduta</Badge>
  }
  if (days < 30) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Scade tra {days}g
      </Badge>
    )
  }
  return null
}

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function BoscologLotPermitsPanel({
  lotId,
  initial,
  canEdit,
}: {
  lotId: string
  initial: BoscologLotPermit[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [permits, setPermits] = useState(initial)
  const [pending, startTransition] = useTransition()

  const [permitOpen, setPermitOpen] = useState(false)
  const [editingPermit, setEditingPermit] = useState<BoscologLotPermit | null>(null)
  const [permitForm, setPermitForm] = useState(emptyPermit())

  useEffect(() => {
    setPermits(initial)
  }, [initial])

  const refresh = () => router.refresh()

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) => {
    if (!canEdit) return
    startTransition(async () => {
      const res = await fn()
      if (!res.success) {
        toast.error(res.error ?? 'Operazione fallita')
        return
      }
      toast.success(okMsg)
      refresh()
    })
  }

  const openPermitCreate = () => {
    setEditingPermit(null)
    setPermitForm(emptyPermit())
    setPermitOpen(true)
  }
  const openPermitEdit = (row: BoscologLotPermit) => {
    setEditingPermit(row)
    setPermitForm({
      type: row.type,
      other: row.other ?? '',
      protocol: row.protocol ?? '',
      authority: row.authority ?? '',
      issue_date: row.issue_date ?? '',
      expire_date: row.expire_date ?? '',
      notes: row.notes ?? '',
    })
    setPermitOpen(true)
  }
  const savePermit = () => {
    run(async () => {
      if (editingPermit) return updateBoscologLotPermit(lotId, editingPermit.id, permitForm)
      return createBoscologLotPermit(lotId, permitForm)
    }, editingPermit ? 'Autorizzazione aggiornata.' : 'Autorizzazione aggiunta.')
    setPermitOpen(false)
  }

  return (
    <div className="space-y-8">
      <OpsSection
        title="Autorizzazioni"
        canEdit={canEdit}
        pending={pending}
        onAdd={openPermitCreate}
        empty={!permits.length}
        emptyLabel="Nessuna autorizzazione."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Protocollo</TableHead>
              <TableHead>Ente</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead />
              {canEdit ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permits.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.type === 'altro' && row.other ? row.other : permitLabel(row.type)}
                </TableCell>
                <TableCell>{row.protocol || '—'}</TableCell>
                <TableCell>{row.authority || '—'}</TableCell>
                <TableCell>{row.expire_date || '—'}</TableCell>
                <TableCell>{permitBadge(row.expire_date)}</TableCell>
                {canEdit ? (
                  <TableCell className="space-x-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openPermitEdit(row)}
                      disabled={pending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        run(
                          () => deleteBoscologLotPermit(lotId, row.id),
                          'Autorizzazione eliminata.'
                        )
                      }
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </OpsSection>

      <Dialog open={permitOpen} onOpenChange={setPermitOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPermit ? 'Modifica autorizzazione' : 'Aggiungi autorizzazione'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tipo</Label>
              <select
                className={selectCls}
                value={permitForm.type ?? 'forestale'}
                onChange={(e) => setPermitForm({ ...permitForm, type: e.target.value })}
              >
                {BOSCOLOG_PERMIT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {permitForm.type === 'altro' ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>Specifica</Label>
                <Input
                  value={permitForm.other ?? ''}
                  onChange={(e) => setPermitForm({ ...permitForm, other: e.target.value })}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>Protocollo</Label>
              <Input
                value={permitForm.protocol ?? ''}
                onChange={(e) => setPermitForm({ ...permitForm, protocol: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Ente</Label>
              <Input
                value={permitForm.authority ?? ''}
                onChange={(e) => setPermitForm({ ...permitForm, authority: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data rilascio</Label>
              <Input
                type="date"
                value={permitForm.issue_date ?? ''}
                onChange={(e) => setPermitForm({ ...permitForm, issue_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Scadenza</Label>
              <Input
                type="date"
                value={permitForm.expire_date ?? ''}
                onChange={(e) => setPermitForm({ ...permitForm, expire_date: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Note</Label>
              <Input
                value={permitForm.notes ?? ''}
                onChange={(e) => setPermitForm({ ...permitForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermitOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={savePermit} disabled={pending}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OpsSection({
  title,
  canEdit,
  pending,
  onAdd,
  empty,
  emptyLabel,
  children,
}: {
  title: string
  canEdit: boolean
  pending: boolean
  onAdd: () => void
  empty: boolean
  emptyLabel: string
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={onAdd} disabled={pending}>
            <Plus className="mr-1 h-4 w-4" />
            Aggiungi
          </Button>
        ) : null}
      </div>
      {empty ? <p className="text-sm text-slate-500">{emptyLabel}</p> : children}
    </section>
  )
}
