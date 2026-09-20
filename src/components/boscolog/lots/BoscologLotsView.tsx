'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { deleteBoscologLot, duplicateBoscologLot } from '@/actions/boscolog/lots'
import type { BoscologLot, BoscologParty } from '@/types/boscolog'
import {
  BOSCOLOG_MODES,
  BOSCOLOG_PRODUCT_TYPES,
  modeLabel,
  productLabel,
} from '@/lib/boscolog/catalog'
import { riskLevelBadgeClass } from '@/lib/boscolog/risk'
import { BoscologQuickLotDialog } from '@/components/boscolog/lots/BoscologQuickLotDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function BoscologLotsView({
  initialLots,
  parties,
  canEdit,
}: {
  initialLots: BoscologLot[]
  parties: BoscologParty[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [lots, setLots] = useState(initialLots)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('')
  const [productType, setProductType] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setLots(initialLots)
  }, [initialLots])

  const suppliers = parties.filter((p) => p.role === 'Fornitore' || p.role === 'Ente')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return lots.filter((l) => {
      if (mode && l.mode !== mode) return false
      if (productType && l.product_type !== productType) return false
      if (supplierId && l.supplier_id !== supplierId) return false
      if (riskLevel && l.risk_level !== riskLevel) return false
      if (!needle) return true
      const hay = `${l.name} ${l.comune ?? ''} ${l.province ?? ''} ${l.notes ?? ''} ${l.dds_ref ?? ''} ${l.supplier_name ?? ''}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [lots, q, mode, productType, supplierId, riskLevel])

  const handleDuplicate = (lot: BoscologLot) => {
    if (!canEdit) return
    startTransition(async () => {
      const res = await duplicateBoscologLot(lot.id)
      if (!res.success || !res.id) {
        toast.error(res.error ?? 'Duplicazione fallita')
        return
      }
      toast.success('Lotto duplicato.')
      router.push(`/boscolog/lotti/${res.id}`)
      router.refresh()
    })
  }

  const handleDelete = (lot: BoscologLot) => {
    if (!canEdit) return
    if (!confirm(`Eliminare il lotto "${lot.name}"?`)) return
    startTransition(async () => {
      const res = await deleteBoscologLot(lot.id)
      if (!res.success) {
        toast.error(res.error ?? 'Eliminazione fallita')
        return
      }
      setLots((prev) => prev.filter((x) => x.id !== lot.id))
      toast.success('Lotto eliminato.')
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="lots_q">Cerca</Label>
            <Input
              id="lots_q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, comune, DDT..."
            />
          </div>
          <div className="space-y-2">
            <Label>Modalità</Label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Tutte</option>
              {BOSCOLOG_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Prodotto</Label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Tutti</option>
              {BOSCOLOG_PRODUCT_TYPES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Tutti</option>
              {suppliers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Rischio</Label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">Tutti</option>
              <option value="Basso">Basso</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </select>
          </div>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => setQuickOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Rapido
            </Button>
            <Button type="button" asChild>
              <Link href="/boscolog/lotti/nuovo">
                <Plus className="mr-1 h-4 w-4" />
                Nuovo lotto
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Comune</TableHead>
              <TableHead>Modalità</TableHead>
              <TableHead>Prodotto</TableHead>
              <TableHead>Rischio</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Fornitore</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-slate-500">
                  Nessun lotto.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/boscolog/lotti/${lot.id}`}
                      className="text-slate-900 underline-offset-2 hover:underline"
                    >
                      {lot.name}
                    </Link>
                  </TableCell>
                  <TableCell>{lot.comune || '—'}</TableCell>
                  <TableCell>{modeLabel(lot.mode)}</TableCell>
                  <TableCell>
                    {productLabel(lot.product_type)}
                    {lot.product_type === 'altro' && lot.product_other
                      ? ` (${lot.product_other})`
                      : ''}
                  </TableCell>
                  <TableCell>
                    {lot.risk_level ? (
                      <Badge className={riskLevelBadgeClass(lot.risk_level)}>
                        {lot.risk_level}
                        {lot.risk_score != null ? ` ${lot.risk_score}` : ''}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{lot.lot_date || '—'}</TableCell>
                  <TableCell>{lot.supplier_name || '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={`/boscolog/lotti/${lot.id}`}>Apri</Link>
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/boscolog/lotti/${lot.id}/materiale`}>Materiale</Link>
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/boscolog/lotti/${lot.id}/compliance`}>Compliance</Link>
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => handleDuplicate(lot)}
                            aria-label="Duplica"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => handleDelete(lot)}
                            aria-label="Elimina"
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

      <BoscologQuickLotDialog open={quickOpen} onOpenChange={setQuickOpen} parties={parties} />
    </div>
  )
}
