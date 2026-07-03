'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscProductGroupCatalog,
  deleteFscProductGroupCatalog,
  updateFscProductGroupCatalog,
  type FscProductGroupCatalogInput,
} from '@/actions/fsc/product-groups'
import {
  DataManagementTable,
  type DataManagementColumn,
} from '@/components/admin/DataManagementTable'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
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
import type { FscProductGroupCatalog } from '@/types/fsc'

type FscMasterProductGroupsSectionProps = {
  catalog: FscProductGroupCatalog[]
  page: number
  totalPages: number
  totalCount: number
  q: string
  status: 'all' | 'active' | 'inactive'
  basePath: string
}

type FormState = FscProductGroupCatalogInput

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  keywords: '',
  is_active: true,
})

export function FscMasterProductGroupsSection({
  catalog,
  page,
  totalPages,
  totalCount,
  q,
  status,
  basePath,
}: FscMasterProductGroupsSectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FscProductGroupCatalog | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(false)

  const pushParams = (next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    router.push(`${basePath}?${sp.toString()}`)
  }

  const columns: DataManagementColumn<FscProductGroupCatalog>[] = [
    {
      id: 'code',
      header: 'Codice FSC',
      sortKey: 'code',
      render: (row) => <span className="font-mono text-sm">{row.code}</span>,
    },
    {
      id: 'name',
      header: 'Nome',
      sortKey: 'name',
      render: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      id: 'keywords',
      header: 'Keywords',
      sortKey: 'keywords',
      render: (row) => <span className="text-slate-600">{row.keywords ?? '—'}</span>,
    },
    {
      id: 'active',
      header: 'Attivo',
      sortKey: 'is_active',
      render: (row) => (
        <span className={row.is_active ? 'text-green-700' : 'text-slate-500'}>
          {row.is_active ? 'Sì' : 'No'}
        </span>
      ),
    },
  ]

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (row: FscProductGroupCatalog) => {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      keywords: row.keywords ?? '',
      is_active: row.is_active,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (row: FscProductGroupCatalog) => {
    if (!confirm(`Eliminare "${row.name}" dal catalogo?`)) return
    const result = await deleteFscProductGroupCatalog(row.id)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success('Voce eliminata')
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = editing
        ? await updateFscProductGroupCatalog(editing.id, form)
        : await createFscProductGroupCatalog(form)

      if (!result.success) {
        toast.error(result.error ?? 'Operazione fallita')
        return
      }

      toast.success(editing ? 'Voce aggiornata' : 'Voce creata')
      setDialogOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catalogo gruppi prodotto FSC</h1>
        <p className="mt-1 text-slate-500">
          Gestisci il catalogo globale: solo gruppi ufficiali con codice FSC.
        </p>
      </div>

      <DataManagementTable
        title="Gruppi FSC ufficiali"
        data={catalog}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Cerca nome, codice o keywords…"
        searchMode="server"
        search={{
          value: q,
          onChange: (next) => pushParams({ q: next || null, page: '1' }),
        }}
        pagination={{
          page,
          totalPages,
          onPageChange: (newPage) => pushParams({ page: String(newPage) }),
        }}
        resultCountLabel={`${totalCount} voci`}
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(v) =>
                pushParams({
                  status: v === 'all' ? null : v,
                  page: '1',
                })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Solo attivi</SelectItem>
                <SelectItem value="inactive">Solo inattivi</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" size="sm" className="bg-[#967635] hover:bg-[#7d6230]" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />
              Nuovo
            </Button>
          </div>
        }
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
              <Pencil className="mr-1 h-4 w-4" />
              Modifica
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => handleDelete(row)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Elimina
            </Button>
          </div>
        )}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifica voce catalogo' : 'Nuova voce catalogo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-code">Codice FSC</Label>
              <Input
                id="catalog-code"
                value={form.code ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="Es. W9.2"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-name">Nome</Label>
              <Input
                id="catalog-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-keywords">Keywords (ricerca)</Label>
              <Input
                id="catalog-keywords"
                value={form.keywords ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
                placeholder="legno costruzione timber"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v === true }))}
              />
              Attivo nel catalogo
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={loading} className="bg-[#967635] hover:bg-[#7d6230]">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
