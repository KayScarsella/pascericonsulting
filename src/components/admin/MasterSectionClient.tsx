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
import { updateProfileAdmin } from '@/actions/profiles-admin'
import { inviteUserToToolAction } from '@/actions/invite'
import {
  createNotification,
  updateNotification,
  deleteNotification,
  deleteNotificationsBulk,
} from '@/actions/notifications'
import {
  updateUserRoleAction,
  deleteUserFromToolAction,
  cleanupPendingOnboardingUsersAction,
} from '@/actions/users'
import type { ToolUserRow } from '@/actions/users'
import type { Database } from '@/types/supabase'
import { toast } from 'sonner'
import { Edit, Plus, Trash2, Loader2 } from 'lucide-react'

type SpeciesRow = Database['public']['Tables']['species']['Row']
type CountryRow = Database['public']['Tables']['country']['Row']
type NotificationRow = Database['public']['Tables']['notifications']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

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

  // profiles form state (admin, used from users section)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileFullName, setProfileFullName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [profileRagioneSociale, setProfileRagioneSociale] = useState('')
  const [profileCfPiva, setProfileCfPiva] = useState('')
  const [profileTelefono, setProfileTelefono] = useState('')
  const [profileIndirizzo, setProfileIndirizzo] = useState('')
  const [profileCitta, setProfileCitta] = useState('')
  const [profileProvincia, setProfileProvincia] = useState('')
  const [profileCap, setProfileCap] = useState('')
  const [profileSettore, setProfileSettore] = useState('')
  const [profileAttivita, setProfileAttivita] = useState('')
  const [profileSito, setProfileSito] = useState('')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'standard' | 'premium'>('standard')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)

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
    const handleDeleteUser = async (userId: string) => {
      if (
        !confirm(
          'Eliminare utente dal tool? Se e\' associato solo a questo tool verra\' eliminato completamente (auth, profilo, accessi). Verranno anche rimosse analisi e file collegati.'
        )
      ) {
        return
      }
      setUpdating(`delete-${userId}`)
      const res = await deleteUserFromToolAction(userId, toolId)
      setUpdating(null)
      if (res.success) {
        toast.success('Utente eliminato correttamente.')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Eliminazione account fallita.')
      }
    }
    const openEditProfile = (row: ToolUserRow) => {
      // #region agent log
      fetch('http://127.0.0.1:7443/ingest/e3f27f07-b7f1-4eb5-9645-5d724b3a3d9b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1c1df8'},body:JSON.stringify({sessionId:'1c1df8',runId:'pre-fix',hypothesisId:'H3',location:'src/components/admin/MasterSectionClient.tsx:openEditProfile',message:'Row profiles shape before edit dialog',data:{userId:row.user_id,profilesType:typeof row.profiles,profilesIsArray:Array.isArray(row.profiles),profilesIsNull:row.profiles===null,profilesHasOnboardingCompleted:typeof (row.profiles as { onboarding_completed?: unknown } | null)?.onboarding_completed !== 'undefined'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const profile = row.profiles as ProfileRow | null
      if (!profile) return
      setProfileId(profile.id)
      setProfileFullName(profile.full_name ?? '')
      setProfileEmail(profile.email ?? '')
      setProfileUsername(profile.username ?? '')
      setProfileRagioneSociale(profile.ragione_sociale ?? '')
      setProfileCfPiva(profile.cf_partita_iva ?? '')
      setProfileTelefono(profile.recapito_telefonico ?? '')
      setProfileIndirizzo(profile.indirizzo ?? '')
      setProfileCitta(profile.citta ?? '')
      setProfileProvincia(profile.provincia ?? '')
      setProfileCap(profile.cap ?? '')
      setProfileSettore(profile.settore_merceologico ?? '')
      setProfileAttivita(profile.attivita ?? '')
      setProfileSito(profile.sito_internet ?? '')
      setDialogOpen(true)
    }

    const resetProfileForm = () => {
      setProfileId(null)
      setProfileFullName('')
      setProfileEmail('')
      setProfileUsername('')
      setProfileRagioneSociale('')
      setProfileCfPiva('')
      setProfileTelefono('')
      setProfileIndirizzo('')
      setProfileCitta('')
      setProfileProvincia('')
      setProfileCap('')
      setProfileSettore('')
      setProfileAttivita('')
      setProfileSito('')
    }

    const handleProfileSubmit = async () => {
      if (!profileId) return
      setUpdating(profileId)
      const res = await updateProfileAdmin(toolId, profileId, {
        full_name: profileFullName.trim() || null,
        username: profileUsername.trim() || null,
        ragione_sociale: profileRagioneSociale.trim() || null,
        cf_partita_iva: profileCfPiva.trim() || null,
        recapito_telefonico: profileTelefono.trim() || null,
        indirizzo: profileIndirizzo.trim() || null,
        citta: profileCitta.trim() || null,
        provincia: profileProvincia.trim() || null,
        cap: profileCap.trim() || null,
        settore_merceologico: profileSettore.trim() || null,
        attivita: profileAttivita.trim() || null,
        sito_internet: profileSito.trim() || null,
      })
      setUpdating(null)

      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success('Profilo aggiornato.')
      setDialogOpen(false)
      resetProfileForm()
      router.refresh()
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
        id: 'email',
        header: 'Email',
        render: (row) => (
          <span className="text-slate-600">
            {(row.profiles as { email?: string } | null)?.email ?? '—'}
          </span>
        ),
      },
      {
        id: 'ragione_sociale',
        header: 'Ragione sociale',
        render: (row) => (
          <span className="text-slate-600">
            {(row.profiles as { ragione_sociale?: string } | null)
              ?.ragione_sociale ?? '—'}
          </span>
        ),
      },
      {
        id: 'recapito_telefonico',
        header: 'Telefono',
        render: (row) => (
          <span className="text-slate-600 text-sm">
            {(row.profiles as { recapito_telefonico?: string } | null)
              ?.recapito_telefonico ?? '—'}
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
      {
        id: 'onboarding_status',
        header: 'Onboarding',
        render: (row) => {
          const profile = row.profiles as (ProfileRow & { onboarding_completed?: boolean }) | null
          const done = Boolean(profile?.onboarding_completed)
          return (
            <span
              className={
                done
                  ? 'rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                  : 'rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700'
              }
            >
              {done ? 'Completato' : 'Da completare'}
            </span>
          )
        },
      },
    ]
    const handleInvite = async () => {
      const email = inviteEmail.trim()
      if (!email) {
        toast.error('Inserisci un indirizzo email.')
        return
      }
      setInviteLoading(true)
      const res = await inviteUserToToolAction(toolId, email, inviteRole)
      setInviteLoading(false)
      if (res.success) {
        toast.success('Invito inviato.', {
          description: 'L’utente riceverà un’email da Supabase per completare l’accesso.',
        })
        setInviteOpen(false)
        setInviteEmail('')
        setInviteRole('standard')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Invito non riuscito')
      }
    }

    return (
      <>
        <div className="mb-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              setCleanupLoading(true)
              const res = await cleanupPendingOnboardingUsersAction(toolId, 7)
              setCleanupLoading(false)
              if (res.success) {
                toast.success(`Cleanup completato: ${res.removed} account rimossi.`)
                router.refresh()
              } else {
                toast.error(res.error ?? 'Cleanup fallito.')
              }
            }}
            disabled={cleanupLoading}
          >
            {cleanupLoading ? 'Cleanup...' : 'Cleanup onboarding > 7 giorni'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            Invita utente per email
          </Button>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invita utente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nome@azienda.it"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ruolo iniziale</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'standard' | 'premium')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-slate-500">
                Serve <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> sul
                server e <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SITE_URL</code> con
                l’URL dell’app (non *.supabase.co).
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleInvite} disabled={inviteLoading}>
                {inviteLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Invio...
                  </span>
                ) : (
                  'Invia invito'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DataManagementTable<ToolUserRow>
          title="Gestione Utenti"
          data={data}
          columns={columns}
          getRowId={(row) => row.user_id}
          searchPlaceholder="Cerca per nome, email o ragione sociale..."
          filterPredicate={(row, q) => {
            const profile = row.profiles as ProfileRow | null
            const name = (profile?.full_name ?? '').toLowerCase()
            const email = (profile?.email ?? '').toLowerCase()
            const rs = (profile?.ragione_sociale ?? '').toLowerCase()
            const term = q.toLowerCase()
            return (
              name.includes(term) ||
              email.includes(term) ||
              rs.includes(term)
            )
          }}
          emptyMessage="Nessun utente con accesso al tool."
          resultCountLabel={`${data.length} utenti`}
          pagination={paginationConfig}
          renderRowActions={(row) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:bg-slate-100"
                onClick={() => openEditProfile(row)}
                title="Modifica profilo"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:bg-red-50"
                onClick={() => handleDeleteUser(row.user_id)}
                disabled={updating === `delete-${row.user_id}`}
                title="Elimina utente"
              >
                {updating === `delete-${row.user_id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
        />

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetProfileForm()
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifica profilo utente</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="profile-full-name">Nome</Label>
                <Input
                  id="profile-full-name"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={profileEmail} readOnly className="bg-slate-50 text-slate-600" />
                <p className="text-xs text-slate-500">L’email non può essere modificata da admin.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-ragione-sociale">Ragione sociale</Label>
                <Input
                  id="profile-ragione-sociale"
                  value={profileRagioneSociale}
                  onChange={(e) => setProfileRagioneSociale(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-cf">CF / Partita IVA</Label>
                <Input
                  id="profile-cf"
                  value={profileCfPiva}
                  onChange={(e) => setProfileCfPiva(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-tel">Telefono</Label>
                <Input
                  id="profile-tel"
                  value={profileTelefono}
                  onChange={(e) => setProfileTelefono(e.target.value)}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="profile-indirizzo">Indirizzo</Label>
                <Input
                  id="profile-indirizzo"
                  value={profileIndirizzo}
                  onChange={(e) => setProfileIndirizzo(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-citta">Città</Label>
                <Input
                  id="profile-citta"
                  value={profileCitta}
                  onChange={(e) => setProfileCitta(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-provincia">Provincia</Label>
                <Input
                  id="profile-provincia"
                  value={profileProvincia}
                  onChange={(e) => setProfileProvincia(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-cap">CAP</Label>
                <Input
                  id="profile-cap"
                  value={profileCap}
                  onChange={(e) => setProfileCap(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-settore">Settore</Label>
                <Input
                  id="profile-settore"
                  value={profileSettore}
                  onChange={(e) => setProfileSettore(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-attivita">Attività</Label>
                <Input
                  id="profile-attivita"
                  value={profileAttivita}
                  onChange={(e) => setProfileAttivita(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-sito">Sito</Label>
                <Input
                  id="profile-sito"
                  value={profileSito}
                  onChange={(e) => setProfileSito(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleProfileSubmit} disabled={!profileId || updating === profileId}>
                {updating === profileId ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvataggio...
                  </span>
                ) : (
                  'Salva'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
