'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DataManagementTable,
  type DataManagementColumn,
} from '@/components/admin/DataManagementTable'
import {
  createSpecies,
  updateSpecies,
  deleteSpecies,
  deleteSpeciesBulk,
  createCountry,
  updateCountry,
  deleteCountry,
  deleteCountriesBulk,
} from '@/actions/master-data'
import {
  createNotification,
  updateNotification,
  deleteNotification,
  deleteNotificationsBulk,
} from '@/actions/notifications'
import { updateUserRoleAction, removeUserFromToolAction } from '@/actions/users'
import type { ToolUserRow } from '@/actions/users'
import type { Database } from '@/types/supabase'
import { toast } from 'sonner'
import { Edit, Plus, Trash2, Loader2 } from 'lucide-react'

type SpeciesRow = Database['public']['Tables']['species']['Row']
type CountryRow = Database['public']['Tables']['country']['Row']
type NotificationRow = Database['public']['Tables']['notifications']['Row']

export const MASTER_SECTIONS = ['users', 'species', 'countries', 'notifications'] as const
export type MasterSection = (typeof MASTER_SECTIONS)[number]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  premium: 'Premium',
  standard: 'Standard',
}

export interface MasterSectionClientProps {
  section: MasterSection
  toolId: string
  usersData?: ToolUserRow[] | null
  speciesData?: SpeciesRow[] | null
  countriesData?: CountryRow[] | null
  notificationsData?: NotificationRow[] | null
  /** Current page (1-based). Used with totalPages and basePath for server-side pagination. */
  page?: number
  /** Total number of pages. */
  totalPages?: number
  /** Base path for pagination links (e.g. /timberRegulation/master/species). */
  basePath?: string
}

export function MasterSectionClient({
  section,
  toolId,
  usersData,
  speciesData,
  countriesData,
  notificationsData,
  page = 1,
  totalPages: totalPagesProp = 1,
  basePath,
}: MasterSectionClientProps) {
  const router = useRouter()
  const hasPagination = typeof basePath === 'string' && totalPagesProp > 1
  const paginationConfig = hasPagination && basePath
    ? {
        page,
        totalPages: totalPagesProp,
        onPageChange: (newPage: number) => {
          router.push(`${basePath}?page=${newPage}`)
        },
      }
    : undefined
  const [updating, setUpdating] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scientificName, setScientificName] = useState('')
  const [commonName, setCommonName] = useState('')
  const [citesStr, setCitesStr] = useState('')
  const [countryName, setCountryName] = useState('')
  const [extraEu, setExtraEu] = useState(false)
  const [conflicts, setConflicts] = useState(false)
  const [sanction, setSanction] = useState(false)
  const [corruptionCode, setCorruptionCode] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifExpiresAt, setNotifExpiresAt] = useState('')
  const [notifActive, setNotifActive] = useState(true)

  if (section === 'users') {
    const data = usersData ?? []
    const handleRoleChange = async (
      userId: string,
      newRole: 'standard' | 'premium' | 'admin'
    ) => {
      setUpdating(userId)
      const res = await updateUserRoleAction(userId, toolId, newRole)
      setUpdating(null)
      if (res.success) {
        toast.success('Ruolo aggiornato.')
        router.refresh()
      } else toast.error(res.error ?? 'Errore aggiornamento ruolo.')
    }
    const handleRemove = async (userId: string) => {
      if (!confirm('Rimuovere questo utente dal tool?')) return
      setUpdating(userId)
      const res = await removeUserFromToolAction(userId, toolId)
      setUpdating(null)
      if (res.success) {
        toast.success('Utente rimosso.')
        router.refresh()
      } else toast.error(res.error)
    }
    const columns: DataManagementColumn<ToolUserRow>[] = [
      {
        id: 'name',
        header: 'Nome',
        render: (row) => (
          <span className="font-medium text-slate-900">
            {(row.profiles as { full_name?: string } | null)?.full_name ?? '—'}
          </span>
        ),
      },
      {
        id: 'role',
        header: 'Ruolo',
        render: (row) => {
          const uid = row.user_id
          const busy = updating === uid
          return (
            <Select
              value={row.role}
              onValueChange={(v) =>
                handleRoleChange(uid, v as 'standard' | 'premium' | 'admin')
              }
              disabled={busy}
            >
              <SelectTrigger className="h-8 w-[120px] border-slate-200">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                <SelectItem value="premium">{ROLE_LABELS.premium}</SelectItem>
                <SelectItem value="standard">{ROLE_LABELS.standard}</SelectItem>
              </SelectContent>
            </Select>
          )
        },
      },
    ]
    return (
      <DataManagementTable<ToolUserRow>
        title="Gestione Utenti"
        data={data}
        columns={columns}
        getRowId={(row) => row.user_id}
        searchPlaceholder="Cerca per nome..."
        filterPredicate={(row, q) => {
          const name = (
            (row.profiles as { full_name?: string } | null)?.full_name ?? ''
          ).toLowerCase()
          return name.includes(q)
        }}
        emptyMessage="Nessun utente con accesso al tool."
        resultCountLabel={`${data.length} utenti`}
        pagination={paginationConfig}
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:bg-red-50"
              onClick={() => handleRemove(row.user_id)}
              disabled={updating === row.user_id}
              title="Rimuovi dal tool"
            >
              {updating === row.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      />
    )
  }

  if (section === 'species') {
    const data = speciesData ?? []
    const handleSort = (field: string) => {
      if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortField(field)
        setSortDir('asc')
      }
    }
    const sortCompareSpecies = (a: SpeciesRow, b: SpeciesRow, field: string, dir: 'asc' | 'desc') => {
      let va: string | number = ''
      let vb: string | number = ''
      if (field === 'scientific_name') {
        va = (a.scientific_name ?? '').toLowerCase()
        vb = (b.scientific_name ?? '').toLowerCase()
      } else if (field === 'common_name') {
        va = (a.common_name ?? '').toLowerCase()
        vb = (b.common_name ?? '').toLowerCase()
      } else if (field === 'cites') {
        va = a.cites ?? -1
        vb = b.cites ?? -1
      }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    }
    const resetForm = () => {
      setEditingId(null)
      setScientificName('')
      setCommonName('')
      setCitesStr('')
    }
    const openCreate = () => {
      resetForm()
      setDialogOpen(true)
    }
    const openEdit = (row: SpeciesRow) => {
      setEditingId(row.id)
      setScientificName(row.scientific_name ?? '')
      setCommonName(row.common_name ?? '')
      setCitesStr(row.cites != null ? String(row.cites) : '')
      setDialogOpen(true)
    }
    const handleSubmit = async () => {
      const cites = citesStr.trim() ? parseInt(citesStr, 10) : null
      if (editingId) {
        const res = await updateSpecies(toolId, editingId, {
          scientific_name: scientificName.trim() || null,
          common_name: commonName.trim() || null,
          cites: Number.isNaN(cites as number) ? null : (cites as number),
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Specie aggiornata.')
      } else {
        const res = await createSpecies(toolId, {
          scientific_name: scientificName.trim() || null,
          common_name: commonName.trim() || null,
          cites: Number.isNaN(cites as number) ? null : (cites as number),
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Specie creata.')
      }
      setDialogOpen(false)
      resetForm()
      router.refresh()
    }
    const handleDelete = async (id: string) => {
      if (!confirm('Eliminare questa specie?')) return
      const res = await deleteSpecies(toolId, id)
      if (res.success) {
        toast.success('Specie eliminata.')
        router.refresh()
      } else toast.error(res.error)
    }
    const columns: DataManagementColumn<SpeciesRow>[] = [
      {
        id: 'scientific_name',
        header: 'Nome scientifico',
        sortKey: 'scientific_name',
        render: (row) => (
          <span className="font-medium text-slate-900">
            {row.scientific_name ?? '—'}
          </span>
        ),
      },
      {
        id: 'common_name',
        header: 'Nome comune',
        sortKey: 'common_name',
        render: (row) => (
          <span className="text-slate-700">{row.common_name ?? '—'}</span>
        ),
      },
      {
        id: 'cites',
        header: 'CITES',
        sortKey: 'cites',
        render: (row) => (
          <span className="text-slate-600">{row.cites ?? '—'}</span>
        ),
      },
    ]
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Aggiungi specie
          </Button>
        </div>
        <DataManagementTable<SpeciesRow>
          title="Specie"
          data={data}
          columns={columns}
          getRowId={(row) => row.id}
          searchPlaceholder="Cerca per nome scientifico o comune..."
          filterPredicate={(row, q) => {
            const sci = (row.scientific_name ?? '').toLowerCase()
            const common = (row.common_name ?? '').toLowerCase()
            return sci.includes(q) || common.includes(q)
          }}
          sortConfig={{
            field: sortField,
            dir: sortDir,
            onSort: handleSort,
          }}
          sortCompare={sortCompareSpecies}
          selectable
          onBulkDelete={async (ids) => deleteSpeciesBulk(toolId, ids)}
          bulkDeleteLabel="Elimina"
          emptyMessage="Nessuna specie."
          resultCountLabel={`${data.length} specie`}
          pagination={paginationConfig}
          renderRowActions={(row) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:bg-slate-100"
                onClick={() => openEdit(row)}
                title="Modifica"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={() => handleDelete(row.id)}
                title="Elimina"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Modifica specie' : 'Nuova specie'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="species-scientific">Nome scientifico</Label>
                <Input
                  id="species-scientific"
                  value={scientificName}
                  onChange={(e) => setScientificName(e.target.value)}
                  placeholder="es. Quercus robur"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="species-common">Nome comune</Label>
                <Input
                  id="species-common"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                  placeholder="es. Farnia"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="species-cites">CITES (numero)</Label>
                <Input
                  id="species-cites"
                  type="text"
                  inputMode="numeric"
                  value={citesStr}
                  onChange={(e) => setCitesStr(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSubmit}>
                {editingId ? 'Salva' : 'Crea'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (section === 'notifications') {
    const data = notificationsData ?? []

    const resetNotifForm = () => {
      setEditingId(null)
      setNotifTitle('')
      setNotifMessage('')
      setNotifExpiresAt('')
      setNotifActive(true)
    }
    const openCreateNotif = () => {
      resetNotifForm()
      setDialogOpen(true)
    }
    const openEditNotif = (row: NotificationRow) => {
      setEditingId(row.id)
      setNotifTitle(row.title ?? '')
      setNotifMessage(row.message ?? '')
      setNotifExpiresAt(row.expires_at ? row.expires_at.slice(0, 16) : '')
      setNotifActive(row.is_active ?? true)
      setDialogOpen(true)
    }
    const handleNotifSubmit = async () => {
      const expiresAt = notifExpiresAt.trim() ? notifExpiresAt : null
      if (editingId) {
        const res = await updateNotification(toolId, editingId, {
          title: notifTitle.trim() || 'Senza titolo',
          message: notifMessage.trim() || null,
          expires_at: expiresAt,
          is_active: notifActive,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Notifica aggiornata.')
      } else {
        const res = await createNotification(toolId, {
          title: notifTitle.trim() || 'Senza titolo',
          message: notifMessage.trim() || null,
          expires_at: expiresAt,
          is_active: notifActive,
        })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success('Notifica creata.')
      }
      setDialogOpen(false)
      resetNotifForm()
      router.refresh()
    }
    const handleNotifDelete = async (id: string) => {
      if (!confirm('Eliminare questa notifica?')) return
      const res = await deleteNotification(toolId, id)
      if (res.success) {
        toast.success('Notifica eliminata.')
        router.refresh()
      } else toast.error(res.error)
    }

    const notifColumns: DataManagementColumn<NotificationRow>[] = [
      {
        id: 'title',
        header: 'Titolo',
        sortKey: 'title',
        render: (row) => (
          <span className="font-medium text-slate-900">{row.title ?? '—'}</span>
        ),
      },
      {
        id: 'message',
        header: 'Messaggio',
        render: (row) => (
          <span className="text-slate-600 line-clamp-2 max-w-[280px]">
            {row.message ?? '—'}
          </span>
        ),
      },
      {
        id: 'created_at',
        header: 'Data',
        sortKey: 'created_at',
        render: (row) => (
          <span className="text-slate-500 text-sm">
            {row.created_at ? new Date(row.created_at).toLocaleDateString('it-IT') : '—'}
          </span>
        ),
      },
      {
        id: 'expires_at',
        header: 'Scadenza',
        sortKey: 'expires_at',
        render: (row) => (
          <span className="text-slate-500 text-sm">
            {row.expires_at ? new Date(row.expires_at).toLocaleDateString('it-IT') : '—'}
          </span>
        ),
      },
      {
        id: 'is_active',
        header: 'Attiva',
        sortKey: 'is_active',
        render: (row) => (
          <span className={row.is_active ? 'text-green-600 font-medium' : 'text-slate-400'}>
            {row.is_active ? 'Sì' : 'No'}
          </span>
        ),
      },
    ]

    const handleNotifSort = (field: string) => {
      if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      else {
        setSortField(field)
        setSortDir('asc')
      }
    }
    const sortCompareNotif = (a: NotificationRow, b: NotificationRow, field: string, dir: 'asc' | 'desc') => {
      let va: string | number | boolean = ''
      let vb: string | number | boolean = ''
      if (field === 'title') {
        va = (a.title ?? '').toLowerCase()
        vb = (b.title ?? '').toLowerCase()
      } else if (field === 'created_at') {
        va = a.created_at ?? ''
        vb = b.created_at ?? ''
      } else if (field === 'expires_at') {
        va = a.expires_at ?? ''
        vb = b.expires_at ?? ''
      } else if (field === 'is_active') {
        va = a.is_active ? 1 : 0
        vb = b.is_active ? 1 : 0
      }
      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={openCreateNotif} className="gap-2">
            <Plus className="h-4 w-4" /> Nuova notifica
          </Button>
        </div>
        <DataManagementTable<NotificationRow>
          title="Notifiche"
          data={data}
          columns={notifColumns}
          getRowId={(row) => row.id}
          searchPlaceholder="Cerca per titolo o messaggio..."
          filterPredicate={(row, q) => {
            const t = (row.title ?? '').toLowerCase()
            const m = (row.message ?? '').toLowerCase()
            return t.includes(q) || m.includes(q)
          }}
          sortConfig={{
            field: sortField,
            dir: sortDir,
            onSort: handleNotifSort,
          }}
          sortCompare={sortCompareNotif}
          selectable
          onBulkDelete={async (ids) => deleteNotificationsBulk(toolId, ids)}
          bulkDeleteLabel="Elimina"
          emptyMessage="Nessuna notifica."
          resultCountLabel={`${data.length} notifiche`}
          pagination={paginationConfig}
          renderRowActions={(row) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:bg-slate-100"
                onClick={() => openEditNotif(row)}
                title="Modifica"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={() => handleNotifDelete(row.id)}
                title="Elimina"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica notifica' : 'Nuova notifica'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="notif-title">Titolo</Label>
                <Input
                  id="notif-title"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="Titolo della notifica"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notif-message">Messaggio</Label>
                <Input
                  id="notif-message"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Testo (opzionale)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notif-expires">Scadenza (data e ora, opzionale)</Label>
                <Input
                  id="notif-expires"
                  type="datetime-local"
                  value={notifExpiresAt}
                  onChange={(e) => setNotifExpiresAt(e.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={notifActive}
                  onCheckedChange={(c) => setNotifActive(Boolean(c))}
                />
                <span className="text-sm">Notifica attiva (visibile in home)</span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleNotifSubmit}>
                {editingId ? 'Salva' : 'Crea'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // section === 'countries'
  const data = countriesData ?? []
  const handleSortCountry = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
  }
  const sortCompareCountry = (a: CountryRow, b: CountryRow, field: string, dir: 'asc' | 'desc') => {
    let va: string | number | boolean = ''
    let vb: string | number | boolean = ''
    if (field === 'country_name') {
      va = (a.country_name ?? '').toLowerCase()
      vb = (b.country_name ?? '').toLowerCase()
    } else if (field === 'extra_eu') {
      va = a.extra_eu ? 1 : 0
      vb = b.extra_eu ? 1 : 0
    } else if (field === 'conflicts') {
      va = a.conflicts ? 1 : 0
      vb = b.conflicts ? 1 : 0
    } else if (field === 'sanction') {
      va = a.sanction ? 1 : 0
      vb = b.sanction ? 1 : 0
    } else if (field === 'corruption_code') {
      va = (a.corruption_code ?? '').toLowerCase()
      vb = (b.corruption_code ?? '').toLowerCase()
    }
    if (va < vb) return dir === 'asc' ? -1 : 1
    if (va > vb) return dir === 'asc' ? 1 : -1
    return 0
  }
  const resetForm = () => {
    setEditingId(null)
    setCountryName('')
    setExtraEu(false)
    setConflicts(false)
    setSanction(false)
    setCorruptionCode('')
  }
  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }
  const openEdit = (row: CountryRow) => {
    setEditingId(row.id)
    setCountryName(row.country_name ?? '')
    setExtraEu(row.extra_eu ?? false)
    setConflicts(row.conflicts ?? false)
    setSanction(row.sanction ?? false)
    setCorruptionCode(row.corruption_code ?? '')
    setDialogOpen(true)
  }
  const handleSubmit = async () => {
    if (editingId) {
      const res = await updateCountry(toolId, editingId, {
        country_name: countryName.trim() || null,
        extra_eu: extraEu,
        conflicts,
        sanction,
        corruption_code: corruptionCode.trim() || null,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Paese aggiornato.')
    } else {
      const res = await createCountry(toolId, {
        country_name: countryName.trim() || null,
        extra_eu: extraEu,
        conflicts,
        sanction,
        corruption_code: corruptionCode.trim() || null,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Paese creato.')
    }
    setDialogOpen(false)
    resetForm()
    router.refresh()
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo paese?')) return
    const res = await deleteCountry(toolId, id)
    if (res.success) {
      toast.success('Paese eliminato.')
      router.refresh()
    } else toast.error(res.error)
  }
  const columns: DataManagementColumn<CountryRow>[] = [
    {
      id: 'country_name',
      header: 'Paese',
      sortKey: 'country_name',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.country_name ?? '—'}
        </span>
      ),
    },
    {
      id: 'extra_eu',
      header: 'Extra UE',
      sortKey: 'extra_eu',
      render: (row) => (
        <span className="text-slate-600">{row.extra_eu ? 'Sì' : 'No'}</span>
      ),
    },
    {
      id: 'conflicts',
      header: 'Conflitti',
      sortKey: 'conflicts',
      render: (row) => (
        <span
          className={
            row.conflicts ? 'text-amber-600 font-medium' : 'text-slate-500'
          }
        >
          {row.conflicts ? 'Sì' : 'No'}
        </span>
      ),
    },
    {
      id: 'sanction',
      header: 'Sanzioni',
      sortKey: 'sanction',
      render: (row) => (
        <span
          className={
            row.sanction ? 'text-red-600 font-medium' : 'text-slate-500'
          }
        >
          {row.sanction ? 'Sì' : 'No'}
        </span>
      ),
    },
    {
      id: 'corruption_code',
      header: 'Cod. corruzione',
      sortKey: 'corruption_code',
      render: (row) => (
        <span className="text-slate-600 font-mono text-xs">
          {row.corruption_code ?? '—'}
        </span>
      ),
    },
  ]
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Aggiungi paese
        </Button>
      </div>
      <DataManagementTable<CountryRow>
        title="Paesi"
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="Cerca per nome paese..."
        filterPredicate={(row, q) => {
          const name = (row.country_name ?? '').toLowerCase()
          const code = (row.corruption_code ?? '').toLowerCase()
          return name.includes(q) || code.includes(q)
        }}
        sortConfig={{
          field: sortField,
          dir: sortDir,
          onSort: handleSortCountry,
        }}
        sortCompare={sortCompareCountry}
        selectable
        onBulkDelete={async (ids) => deleteCountriesBulk(toolId, ids)}
        bulkDeleteLabel="Elimina"
        emptyMessage="Nessun paese."
        resultCountLabel={`${data.length} paesi`}
        pagination={paginationConfig}
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600 hover:bg-slate-100"
              onClick={() => openEdit(row)}
              title="Modifica"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:bg-red-50"
              onClick={() => handleDelete(row.id)}
              title="Elimina"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifica paese' : 'Nuovo paese'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="country-name">Nome paese</Label>
              <Input
                id="country-name"
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                placeholder="es. Italia"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country-corruption">Codice corruzione</Label>
              <Input
                id="country-corruption"
                value={corruptionCode}
                onChange={(e) => setCorruptionCode(e.target.value)}
                placeholder="opzionale"
              />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={extraEu}
                  onCheckedChange={(c) => setExtraEu(Boolean(c))}
                />
                <span className="text-sm">Extra UE</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={conflicts}
                  onCheckedChange={(c) => setConflicts(Boolean(c))}
                />
                <span className="text-sm">Conflitti</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={sanction}
                  onCheckedChange={(c) => setSanction(Boolean(c))}
                />
                <span className="text-sm">Sanzioni</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? 'Salva' : 'Crea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
