'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

type CatalogKind = 'official' | 'unofficial'

type FscMasterProductGroupsSectionProps = {
  official: FscProductGroupCatalog[]
  unofficial: FscProductGroupCatalog[]
}

type FormState = FscProductGroupCatalogInput

const emptyForm = (): FormState => ({
  code: '',
  name: '',
  keywords: '',
  is_active: true,
})

function catalogFilter(row: FscProductGroupCatalog, search: string): boolean {
  const term = search.toLowerCase()
  return (
    row.name.toLowerCase().includes(term) ||
    (row.code?.toLowerCase().includes(term) ?? false) ||
    (row.keywords?.toLowerCase().includes(term) ?? false)
  )
}

function CatalogTable({
  title,
  kind,
  data,
  onEdit,
  onDelete,
  onCreate,
}: {
  title: string
  kind: CatalogKind
  data: FscProductGroupCatalog[]
  onEdit: (row: FscProductGroupCatalog) => void
  onDelete: (row: FscProductGroupCatalog) => void
  onCreate: () => void
}) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filteredData = useMemo(() => {
    if (activeFilter === 'all') return data
    if (activeFilter === 'active') return data.filter((r) => r.is_active)
    return data.filter((r) => !r.is_active)
  }, [activeFilter, data])

  const columns: DataManagementColumn<FscProductGroupCatalog>[] = [
    ...(kind === 'official'
      ? [
          {
            id: 'code',
            header: 'Codice FSC',
            sortKey: 'code',
            render: (row: FscProductGroupCatalog) => (
              <span className="font-mono text-sm">{row.code ?? '—'}</span>
            ),
          },
        ]
      : []),
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

  return (
    <DataManagementTable
      title={title}
      data={filteredData}
      columns={columns}
      getRowId={(row) => row.id}
      searchPlaceholder="Cerca nome, codice o keywords…"
      searchMode="client"
      filterPredicate={catalogFilter}
      resultCountLabel={`${filteredData.length} voci`}
      toolbarExtra={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
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
          <Button type="button" size="sm" className="bg-[#967635] hover:bg-[#7d6230]" onClick={onCreate}>
            <Plus className="mr-1 h-4 w-4" />
            Nuovo
          </Button>
        </div>
      }
      renderRowActions={(row) => (
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)}>
            <Pencil className="mr-1 h-4 w-4" />
            Modifica
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => onDelete(row)}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Elimina
          </Button>
        </div>
      )}
    />
  )
}

export function FscMasterProductGroupsSection({
  official,
  unofficial,
}: FscMasterProductGroupsSectionProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKind, setDialogKind] = useState<CatalogKind>('official')
  const [editing, setEditing] = useState<FscProductGroupCatalog | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [loading, setLoading] = useState(false)

  const openCreate = (kind: CatalogKind) => {
    setDialogKind(kind)
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  const openEdit = (row: FscProductGroupCatalog, kind: CatalogKind) => {
    setDialogKind(kind)
    setEditing(row)
    setForm({
      code: row.code ?? '',
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
        ? await updateFscProductGroupCatalog(editing.id, form, dialogKind === 'official')
        : await createFscProductGroupCatalog(form, dialogKind === 'official')

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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catalogo gruppi prodotto FSC</h1>
        <p className="mt-1 text-slate-500">
          Gestisci il catalogo globale: gruppi ufficiali con codice FSC e voci non ufficiali senza
          codice.
        </p>
      </div>

      <CatalogTable
        title="Gruppi FSC ufficiali"
        kind="official"
        data={official}
        onCreate={() => openCreate('official')}
        onEdit={(row) => openEdit(row, 'official')}
        onDelete={handleDelete}
      />

      <CatalogTable
        title="Gruppi non ufficiali (catalogo)"
        kind="unofficial"
        data={unofficial}
        onCreate={() => openCreate('unofficial')}
        onEdit={(row) => openEdit(row, 'unofficial')}
        onDelete={handleDelete}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifica voce catalogo' : 'Nuova voce catalogo'} —{' '}
              {dialogKind === 'official' ? 'ufficiale' : 'non ufficiale'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {dialogKind === 'official' && (
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
            )}
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
