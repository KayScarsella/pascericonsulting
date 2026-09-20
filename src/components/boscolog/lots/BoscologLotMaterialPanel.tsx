'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  createBoscologLotExit,
  createBoscologLotMovement,
  createBoscologLotSpecies,
  deleteBoscologLotExit,
  deleteBoscologLotMovement,
  deleteBoscologLotSpecies,
  setBoscologLotParents,
  updateBoscologLotExit,
  updateBoscologLotMovement,
  updateBoscologLotSpecies,
  type BoscologLotMaterial,
} from '@/actions/boscolog/lot-operations'
import type {
  BoscologLotExit,
  BoscologLotExitInput,
  BoscologLotMovement,
  BoscologLotMovementInput,
  BoscologLotSpecies,
  BoscologLotSpeciesInput,
  BoscologParty,
} from '@/types/boscolog'
import {
  BOSCOLOG_COMMON_SPECIES,
  BOSCOLOG_MOVEMENT_TYPES,
  BOSCOLOG_UNITS,
  movementLabel,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function emptySpecies(): BoscologLotSpeciesInput {
  return {
    common: '',
    scientific: '',
    assortment: '',
    qty: '',
    unit: 'm³',
    notes: '',
    quality_class: '',
    moisture_pct: '',
    log_length: '',
  }
}

function emptyExit(): BoscologLotExitInput {
  return {
    species_id: '',
    buyer_id: '',
    buyer_name: '',
    exit_date: '',
    product: '',
    qty: '',
    unit: 'm³',
    doc_ref: '',
    notes: '',
  }
}

function emptyMovement(): BoscologLotMovementInput {
  return {
    type: 'ingresso',
    movement_date: '',
    qty_in: '',
    qty_out: '',
    unit: 'm³',
    yield_pct: '',
    loss_pct: '',
    product: '',
    party_id: '',
    party_name: '',
    doc_ref: '',
    location: '',
    notes: '',
  }
}

function speciesRowLabel(s: BoscologLotSpecies, index: number): string {
  return s.common || s.scientific || `Specie #${index + 1}`
}

const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function BoscologLotMaterialPanel({
  lotId,
  initial,
  parties,
  canEdit,
}: {
  lotId: string
  initial: BoscologLotMaterial
  parties: BoscologParty[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()

  const [speciesOpen, setSpeciesOpen] = useState(false)
  const [editingSpecies, setEditingSpecies] = useState<BoscologLotSpecies | null>(null)
  const [speciesForm, setSpeciesForm] = useState(emptySpecies())

  const [exitOpen, setExitOpen] = useState(false)
  const [editingExit, setEditingExit] = useState<BoscologLotExit | null>(null)
  const [exitForm, setExitForm] = useState(emptyExit())

  const [moveOpen, setMoveOpen] = useState(false)
  const [editingMove, setEditingMove] = useState<BoscologLotMovement | null>(null)
  const [moveForm, setMoveForm] = useState(emptyMovement())

  const [parentIds, setParentIds] = useState(initial.parentIds)

  useEffect(() => {
    setData(initial)
    setParentIds(initial.parentIds)
  }, [initial])

  const buyers = parties.filter((p) => p.role === 'Acquirente' || p.role === 'Ente')
  const allParties = parties

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

  const openSpeciesCreate = () => {
    setEditingSpecies(null)
    setSpeciesForm(emptySpecies())
    setSpeciesOpen(true)
  }
  const openSpeciesEdit = (row: BoscologLotSpecies) => {
    setEditingSpecies(row)
    setSpeciesForm({
      common: row.common ?? '',
      scientific: row.scientific ?? '',
      assortment: row.assortment ?? '',
      qty: row.qty ?? '',
      unit: row.unit ?? 'm³',
      notes: row.notes ?? '',
      quality_class: row.quality_class ?? '',
      moisture_pct: row.moisture_pct ?? '',
      log_length: row.log_length ?? '',
    })
    setSpeciesOpen(true)
  }
  const saveSpecies = () => {
    run(async () => {
      if (editingSpecies) {
        return updateBoscologLotSpecies(lotId, editingSpecies.id, speciesForm)
      }
      return createBoscologLotSpecies(lotId, speciesForm)
    }, editingSpecies ? 'Specie aggiornata.' : 'Specie aggiunta.')
    setSpeciesOpen(false)
  }

  const openExitCreate = () => {
    setEditingExit(null)
    setExitForm(emptyExit())
    setExitOpen(true)
  }
  const openExitEdit = (row: BoscologLotExit) => {
    setEditingExit(row)
    setExitForm({
      species_id: row.species_id ?? '',
      buyer_id: row.buyer_id ?? '',
      buyer_name: row.buyer_name ?? '',
      exit_date: row.exit_date ?? '',
      product: row.product ?? '',
      qty: row.qty ?? '',
      unit: row.unit ?? 'm³',
      doc_ref: row.doc_ref ?? '',
      notes: row.notes ?? '',
    })
    setExitOpen(true)
  }
  const saveExit = () => {
    if (data.species.length > 0 && !exitForm.species_id) {
      toast.error('Seleziona la specie')
      return
    }
    run(async () => {
      if (editingExit) return updateBoscologLotExit(lotId, editingExit.id, exitForm)
      return createBoscologLotExit(lotId, exitForm)
    }, editingExit ? 'Uscita aggiornata.' : 'Uscita aggiunta.')
    setExitOpen(false)
  }

  const openMoveCreate = () => {
    setEditingMove(null)
    setMoveForm(emptyMovement())
    setMoveOpen(true)
  }
  const openMoveEdit = (row: BoscologLotMovement) => {
    setEditingMove(row)
    setMoveForm({
      type: row.type,
      movement_date: row.movement_date ?? '',
      qty_in: row.qty_in ?? '',
      qty_out: row.qty_out ?? '',
      unit: row.unit ?? 'm³',
      yield_pct: row.yield_pct ?? '',
      loss_pct: row.loss_pct ?? '',
      product: row.product ?? '',
      party_id: row.party_id ?? '',
      party_name: row.party_name ?? '',
      doc_ref: row.doc_ref ?? '',
      location: row.location ?? '',
      notes: row.notes ?? '',
    })
    setMoveOpen(true)
  }
  const saveMove = () => {
    run(async () => {
      if (editingMove) return updateBoscologLotMovement(lotId, editingMove.id, moveForm)
      return createBoscologLotMovement(lotId, moveForm)
    }, editingMove ? 'Movimento aggiornato.' : 'Movimento aggiunto.')
    setMoveOpen(false)
  }

  const saveParents = () => {
    run(() => setBoscologLotParents(lotId, parentIds), 'Lotti padre aggiornati.')
  }

  const toggleParent = (id: string) => {
    setParentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const exitSpeciesLabel = (speciesId: string | null) => {
    if (!speciesId) return '—'
    const idx = data.species.findIndex((s) => s.id === speciesId)
    if (idx < 0) return '—'
    return speciesRowLabel(data.species[idx], idx)
  }

  const { totals, massBalance } = data
  const showMassBalance =
    massBalance.hasData || data.parentIds.length > 0 || data.movements.length > 0

  return (
    <div className="space-y-8">
      {/* Riepilogo */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Riepilogo quantità</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Totale specie</p>
            <p className="text-xl font-semibold text-slate-900">
              {totals.total || '—'}
              {totals.unit ? ` ${totals.unit}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Venduto / uscite</p>
            <p className="text-xl font-semibold text-slate-900">
              {totals.sold || '—'}
              {totals.unit ? ` ${totals.unit}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Residuo</p>
            <p
              className={`text-xl font-semibold ${
                totals.residueNegative ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {totals.residue || '—'}
              {totals.unit ? ` ${totals.unit}` : ''}
            </p>
            {totals.residueNegative ? (
              <p className="text-sm text-red-600">Attenzione: residuo negativo</p>
            ) : null}
          </div>
        </div>

        {data.speciesTotals?.length ? (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h3 className="text-sm font-medium text-slate-800">Per specie</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Specie</TableHead>
                  <TableHead>Totale</TableHead>
                  <TableHead>Venduto</TableHead>
                  <TableHead>Residuo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.speciesTotals.map((row) => (
                  <TableRow key={row.speciesId}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>
                      {row.total || '—'}
                      {row.unit ? ` ${row.unit}` : ''}
                    </TableCell>
                    <TableCell>
                      {row.sold || '—'}
                      {row.unit && row.sold ? ` ${row.unit}` : ''}
                    </TableCell>
                    <TableCell
                      className={row.residueNegative ? 'font-medium text-red-600' : undefined}
                    >
                      {row.residue || '—'}
                      {row.unit && row.residue ? ` ${row.unit}` : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {showMassBalance ? (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <h3 className="text-sm font-medium text-slate-800">Mass balance</h3>
            {massBalance.unitWarning ? (
              <p className="text-sm text-amber-700">{massBalance.unitWarning}</p>
            ) : null}
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-slate-500">Da lotti padre: </span>
                {massBalance.parentInput || '—'}
                {massBalance.unit ? ` ${massBalance.unit}` : ''}
              </div>
              <div>
                <span className="text-slate-500">Mov. in: </span>
                {massBalance.mvIn || '—'}
              </div>
              <div>
                <span className="text-slate-500">Mov. out: </span>
                {massBalance.mvOut || '—'}
              </div>
              <div>
                <span className="text-slate-500">Bilancio: </span>
                <span className="font-medium">{massBalance.balance || '—'}</span>
                {massBalance.unit ? ` ${massBalance.unit}` : ''}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Specie */}
      <OpsSection
        title="Specie"
        canEdit={canEdit}
        pending={pending}
        onAdd={openSpeciesCreate}
        empty={!data.species.length}
        emptyLabel="Nessuna specie. Aggiungi la composizione del lotto."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comune</TableHead>
              <TableHead>Assortimento</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unità</TableHead>
              <TableHead>Qualità</TableHead>
              {canEdit ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.species.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.common || '—'}</TableCell>
                <TableCell>{row.assortment || '—'}</TableCell>
                <TableCell>{row.qty || '—'}</TableCell>
                <TableCell>{row.unit || '—'}</TableCell>
                <TableCell>{row.quality_class || '—'}</TableCell>
                {canEdit ? (
                  <TableCell className="space-x-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openSpeciesEdit(row)}
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
                          () => deleteBoscologLotSpecies(lotId, row.id),
                          'Specie eliminata.'
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

      {/* Uscite */}
      <OpsSection
        title="Uscite"
        canEdit={canEdit}
        pending={pending}
        onAdd={openExitCreate}
        empty={!data.exits.length}
        emptyLabel="Nessuna uscita registrata."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Specie</TableHead>
              <TableHead>Acquirente</TableHead>
              <TableHead>Prodotto</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Doc</TableHead>
              {canEdit ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.exits.map((row) => {
              const buyer =
                row.buyer_name ||
                parties.find((p) => p.id === row.buyer_id)?.name ||
                '—'
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.exit_date || '—'}</TableCell>
                  <TableCell>{exitSpeciesLabel(row.species_id)}</TableCell>
                  <TableCell>{buyer}</TableCell>
                  <TableCell>{row.product || '—'}</TableCell>
                  <TableCell>
                    {row.qty || '—'}
                    {row.unit ? ` ${row.unit}` : ''}
                  </TableCell>
                  <TableCell>{row.doc_ref || '—'}</TableCell>
                  {canEdit ? (
                    <TableCell className="space-x-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openExitEdit(row)}
                        disabled={pending}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          run(() => deleteBoscologLotExit(lotId, row.id), 'Uscita eliminata.')
                        }
                        disabled={pending}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </OpsSection>

      {/* Movimenti */}
      <OpsSection
        title="Movimenti"
        canEdit={canEdit}
        pending={pending}
        onAdd={openMoveCreate}
        empty={!data.movements.length}
        emptyLabel="Nessun movimento."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>In</TableHead>
              <TableHead>Out</TableHead>
              <TableHead>Controparte</TableHead>
              {canEdit ? <TableHead className="w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.movements.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{movementLabel(row.type)}</TableCell>
                <TableCell>{row.movement_date || '—'}</TableCell>
                <TableCell>
                  {row.qty_in || '—'}
                  {row.unit ? ` ${row.unit}` : ''}
                </TableCell>
                <TableCell>
                  {row.qty_out || '—'}
                  {row.unit ? ` ${row.unit}` : ''}
                </TableCell>
                <TableCell>
                  {row.party_name ||
                    parties.find((p) => p.id === row.party_id)?.name ||
                    '—'}
                </TableCell>
                {canEdit ? (
                  <TableCell className="space-x-1 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openMoveEdit(row)}
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
                          () => deleteBoscologLotMovement(lotId, row.id),
                          'Movimento eliminato.'
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

      {/* Lotti padre */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Lotti padre</h2>
          {canEdit ? (
            <Button type="button" size="sm" onClick={saveParents} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salva selezione
            </Button>
          ) : null}
        </div>
        {!data.parentOptions.length ? (
          <p className="text-sm text-slate-500">Nessun altro lotto disponibile in azienda.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {data.parentOptions.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={parentIds.includes(opt.id)}
                  disabled={!canEdit || pending}
                  onChange={() => toggleParent(opt.id)}
                />
                <span>{opt.name}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <Dialog open={speciesOpen} onOpenChange={setSpeciesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSpecies ? 'Modifica specie' : 'Aggiungi specie'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome comune</Label>
              <Input
                list="boscolog-species-list"
                value={speciesForm.common ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, common: e.target.value })}
              />
              <datalist id="boscolog-species-list">
                {BOSCOLOG_COMMON_SPECIES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome scientifico</Label>
              <Input
                value={speciesForm.scientific ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, scientific: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Assortimento</Label>
              <Input
                value={speciesForm.assortment ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, assortment: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Classe qualità</Label>
              <Input
                value={speciesForm.quality_class ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, quality_class: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Quantità</Label>
              <Input
                value={speciesForm.qty ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, qty: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Unità</Label>
              <select
                className={selectCls}
                value={speciesForm.unit ?? 'm³'}
                onChange={(e) => setSpeciesForm({ ...speciesForm, unit: e.target.value })}
              >
                {BOSCOLOG_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Umidità %</Label>
              <Input
                value={speciesForm.moisture_pct ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, moisture_pct: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Lunghezza</Label>
              <Input
                value={speciesForm.log_length ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, log_length: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Note</Label>
              <Input
                value={speciesForm.notes ?? ''}
                onChange={(e) => setSpeciesForm({ ...speciesForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSpeciesOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={saveSpecies} disabled={pending}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingExit ? 'Modifica uscita' : 'Aggiungi uscita'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.species.length > 0 ? (
              <div className="space-y-1 sm:col-span-2">
                <Label>Specie</Label>
                <select
                  className={selectCls}
                  value={exitForm.species_id ?? ''}
                  onChange={(e) => {
                    const id = e.target.value
                    const sp = data.species.find((s) => s.id === id)
                    setExitForm({
                      ...exitForm,
                      species_id: id,
                      ...(sp?.unit ? { unit: sp.unit } : {}),
                    })
                  }}
                  required
                >
                  <option value="">— Seleziona —</option>
                  {data.species.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {speciesRowLabel(s, i)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <Label>Acquirente (anagrafica)</Label>
              <select
                className={selectCls}
                value={exitForm.buyer_id ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  const party = buyers.find((b) => b.id === id)
                  setExitForm({
                    ...exitForm,
                    buyer_id: id,
                    buyer_name: party?.name ?? exitForm.buyer_name,
                  })
                }}
              >
                <option value="">—</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome acquirente (manuale)</Label>
              <Input
                value={exitForm.buyer_name ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, buyer_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={exitForm.exit_date ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, exit_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Prodotto</Label>
              <Input
                value={exitForm.product ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, product: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Quantità</Label>
              <Input
                value={exitForm.qty ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, qty: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Unità</Label>
              <select
                className={selectCls}
                value={exitForm.unit ?? 'm³'}
                onChange={(e) => setExitForm({ ...exitForm, unit: e.target.value })}
              >
                {BOSCOLOG_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Riferimento documento</Label>
              <Input
                value={exitForm.doc_ref ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, doc_ref: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Note</Label>
              <Input
                value={exitForm.notes ?? ''}
                onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExitOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={saveExit} disabled={pending}>
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMove ? 'Modifica movimento' : 'Aggiungi movimento'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tipo</Label>
              <select
                className={selectCls}
                value={moveForm.type ?? 'ingresso'}
                onChange={(e) => setMoveForm({ ...moveForm, type: e.target.value })}
              >
                {BOSCOLOG_MOVEMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={moveForm.movement_date ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, movement_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Unità</Label>
              <select
                className={selectCls}
                value={moveForm.unit ?? 'm³'}
                onChange={(e) => setMoveForm({ ...moveForm, unit: e.target.value })}
              >
                {BOSCOLOG_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Qty in</Label>
              <Input
                value={moveForm.qty_in ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, qty_in: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Qty out</Label>
              <Input
                value={moveForm.qty_out ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, qty_out: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Resa %</Label>
              <Input
                value={moveForm.yield_pct ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, yield_pct: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Perdita %</Label>
              <Input
                value={moveForm.loss_pct ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, loss_pct: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Controparte</Label>
              <select
                className={selectCls}
                value={moveForm.party_id ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  const party = allParties.find((p) => p.id === id)
                  setMoveForm({
                    ...moveForm,
                    party_id: id,
                    party_name: party?.name ?? moveForm.party_name,
                  })
                }}
              >
                <option value="">—</option>
                {allParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome controparte (manuale)</Label>
              <Input
                value={moveForm.party_name ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, party_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Prodotto</Label>
              <Input
                value={moveForm.product ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, product: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Luogo</Label>
              <Input
                value={moveForm.location ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Rif. documento</Label>
              <Input
                value={moveForm.doc_ref ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, doc_ref: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Note</Label>
              <Input
                value={moveForm.notes ?? ''}
                onChange={(e) => setMoveForm({ ...moveForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMoveOpen(false)}>
              Annulla
            </Button>
            <Button type="button" onClick={saveMove} disabled={pending}>
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
