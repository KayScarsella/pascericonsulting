'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  updateSpeciesBulk,
  createCountry,
  updateCountry,
  deleteCountry,
  deleteCountriesBulk,
  updateCountriesBulk,
} from '@/actions/master-data'
import { updateProfileAdmin } from '@/actions/profiles-admin'
import {
  inviteUserToToolAction,
  resendPendingOnboardingInviteAction,
  resendPendingOnboardingInvitesBulkAction,
  type InviteUserToToolResult,
} from '@/actions/invite'
import {
  createNotification,
  updateNotification,
  deleteNotification,
  deleteNotificationsBulk,
  updateNotificationsBulk,
} from '@/actions/notifications'
import {
  updateUserRoleAction,
  deleteUserFromToolAction,
  cleanupPendingOnboardingUsersAction,
  updateUsersRoleBulkAction,
} from '@/actions/users'
import type { ToolUserRow } from '@/actions/users'
import type { Database } from '@/types/supabase'
import { toast } from 'sonner'
import { Edit, Eye, Plus, Trash2, Loader2, AlertCircle, Mail } from 'lucide-react'
import { NotificationDetailDialog } from '@/components/notifications/NotificationDetailDialog'
import type { NotificationDisplayItem } from '@/components/notifications/notification-types'
import { AUTH_EMAIL_OTP_EXPIRATION_HINT, CLOUD_FSC_TOOL_ID, PENDING_INVITE_BULK_RESEND_MAX } from '@/lib/constants'
import { fscMemberTypeLabel } from '@/lib/fsc/constants'
import type { FscCompanyAdminRow } from '@/actions/fsc/company'
import type { FscMemberType } from '@/types/fsc'
import { FscMasterCompaniesSection } from '@/components/cloud-fsc/master/FscMasterCompaniesSection'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmailSupervisionSection } from '@/components/admin/EmailSupervisionSection'
import type { EmailSupervisionRow } from '@/actions/email-supervision'

type SpeciesRow = Database['public']['Tables']['species']['Row']
type CountryRow = Database['public']['Tables']['country']['Row']
type NotificationRow = Database['public']['Tables']['notifications']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export const MASTER_SECTIONS = ['users', 'email-supervision', 'species', 'countries', 'notifications'] as const
export type MasterSection = (typeof MASTER_SECTIONS)[number] | 'companies'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  premium: 'Premium',
  standard: 'Standard',
}

function isUserRole(value: string): value is 'standard' | 'premium' | 'admin' {
  return value === 'standard' || value === 'premium' || value === 'admin'
}

function isInviteRole(value: string): value is 'standard' | 'premium' {
  return value === 'standard' || value === 'premium'
}

function isBulkSpeciesMode(value: string): value is 'set' | 'clear' {
  return value === 'set' || value === 'clear'
}

function isNotifBulkField(value: string): value is 'is_active' | 'expires_at' {
  return value === 'is_active' || value === 'expires_at'
}

function isBoolString(value: string): value is 'true' | 'false' {
  return value === 'true' || value === 'false'
}

function isNotifExpiryMode(value: string): value is 'clear' {
  return value === 'clear'
}

function isCountryBulkField(
  value: string
): value is 'conflicts' | 'sanction' | 'extra_eu' | 'corruption_code' | 'cpi_multi' {
  return (
    value === 'conflicts' ||
    value === 'sanction' ||
    value === 'extra_eu' ||
    value === 'corruption_code' ||
    value === 'cpi_multi'
  )
}

function isCorruptionCode(value: string): value is 'AA' | 'MA' | 'MB' | 'MM' | 'TT' {
  return value === 'AA' || value === 'MA' || value === 'MB' || value === 'MM' || value === 'TT'
}

function formatCountryNumber(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return String(v)
}

function parseOptionalCountryNumber(raw: string): number | null | false {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n)) return false
  return n
}

export interface MasterSectionClientProps {
  section: MasterSection
  toolId: string
  usersData?: ToolUserRow[] | null
  speciesData?: SpeciesRow[] | null
  countriesData?: CountryRow[] | null
  notificationsData?: NotificationRow[] | null
  emailSupervisionData?: EmailSupervisionRow[] | null
  resendConfigured?: boolean
  needsResendTotalCount?: number
  emailSupervisionTotalUserCount?: number
  /** Current page (1-based). Used with totalPages and basePath for server-side pagination. */
  page?: number
  /** Total number of pages. */
  totalPages?: number
  /** Base path for pagination links (e.g. /timberRegulation/master/species). */
  basePath?: string
  fscCompanies?: FscCompanyAdminRow[]
  fscMembershipsByUser?: Record<
    string,
    { company_id: string; ragione_sociale: string; member_type: FscMemberType; can_edit: boolean }[]
  >
  fscMembersByCompany?: Record<
    string,
    {
      user_id: string
      full_name: string | null
      email: string | null
      member_type: FscMemberType
      can_edit: boolean
    }[]
  >
}

export function MasterSectionClient({
  section,
  toolId,
  usersData,
  speciesData,
  countriesData,
  notificationsData,
  emailSupervisionData,
  resendConfigured = false,
  needsResendTotalCount = 0,
  emailSupervisionTotalUserCount = 0,
  page = 1,
  totalPages: totalPagesProp = 1,
  basePath,
  fscCompanies,
  fscMembershipsByUser,
  fscMembersByCompany,
}: MasterSectionClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const sort = searchParams.get('sort')
  const dir = (searchParams.get('dir') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const pushParams = (next: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    if (basePath) router.push(`${basePath}?${sp.toString()}`)
    else router.push(`?${sp.toString()}`)
  }

  const hasPagination = typeof basePath === 'string' && totalPagesProp > 1
  const paginationConfig = hasPagination && basePath
    ? {
        page,
        totalPages: totalPagesProp,
        onPageChange: (newPage: number) => {
          pushParams({ page: String(newPage) })
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
  const [countryRiskSel, setCountryRiskSel] = useState<'none' | 'RA' | 'RB' | 'RS'>(
    'none'
  )
  const [faoStr, setFaoStr] = useState('')
  const [cpi23Str, setCpi23Str] = useState('')
  const [cpi24Str, setCpi24Str] = useState('')
  const [cpi25Str, setCpi25Str] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifExpiresAt, setNotifExpiresAt] = useState('')
  const [notifActive, setNotifActive] = useState(true)
  const [viewingNotif, setViewingNotif] = useState<NotificationDisplayItem | null>(null)
  const [viewNotifOpen, setViewNotifOpen] = useState(false)

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
  const isCloudFsc = toolId === CLOUD_FSC_TOOL_ID
  const [inviteFscCompanyId, setInviteFscCompanyId] = useState<string>('none')
  const [inviteFscMemberType, setInviteFscMemberType] = useState<FscMemberType>('employee')
  const [inviteFscCanEdit, setInviteFscCanEdit] = useState(true)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [selectionResetKey, setSelectionResetKey] = useState(0)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkUserRole, setBulkUserRole] = useState<'standard' | 'premium' | 'admin'>('standard')
  const [bulkUsersLoading, setBulkUsersLoading] = useState(false)
  const [bulkResendLoading, setBulkResendLoading] = useState(false)
  const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<string[]>([])
  const [bulkSpeciesCites, setBulkSpeciesCites] = useState<string>('0')
  const [bulkSpeciesMode, setBulkSpeciesMode] = useState<'set' | 'clear'>('set')
  const [bulkSpeciesLoading, setBulkSpeciesLoading] = useState(false)
  const [selectedNotifIds, setSelectedNotifIds] = useState<string[]>([])
  const [bulkNotifField, setBulkNotifField] = useState<'is_active' | 'expires_at'>('is_active')
  const [bulkNotifBool, setBulkNotifBool] = useState<'true' | 'false'>('true')
  const [bulkNotifExpiryMode, setBulkNotifExpiryMode] = useState<'clear'>('clear')
  const [bulkNotifLoading, setBulkNotifLoading] = useState(false)
  const [selectedCountryIds, setSelectedCountryIds] = useState<string[]>([])
  const [bulkField, setBulkField] = useState<'conflicts' | 'sanction' | 'extra_eu' | 'corruption_code' | 'cpi_multi'>('conflicts')
  const [bulkBoolValue, setBulkBoolValue] = useState<'true' | 'false'>('false')
  const [bulkCorruptionCode, setBulkCorruptionCode] = useState<'AA' | 'MA' | 'MB' | 'MM' | 'TT'>('MM')
  const [bulkCpi23Enabled, setBulkCpi23Enabled] = useState(false)
  const [bulkCpi24Enabled, setBulkCpi24Enabled] = useState(false)
  const [bulkCpi25Enabled, setBulkCpi25Enabled] = useState(false)
  const [bulkCpi23, setBulkCpi23] = useState('')
  const [bulkCpi24, setBulkCpi24] = useState('')
  const [bulkCpi25, setBulkCpi25] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [emailDeliveryBanner, setEmailDeliveryBanner] = useState<string | null>(null)

  useEffect(() => {
    const key = `pasceri_invite_warn:${toolId}`
    queueMicrotask(() => {
      if (section !== 'users') {
        setEmailDeliveryBanner(null)
        return
      }
      try {
        const w = sessionStorage.getItem(key)
        if (w) setEmailDeliveryBanner(w)
      } catch {
        // sessionStorage unavailable (e.g. private mode) — banner only from in-session toast
      }
    })
  }, [section, toolId])

  if (section === 'companies') {
    return (
      <FscMasterCompaniesSection
        companies={fscCompanies ?? []}
        membersByCompany={fscMembersByCompany ?? {}}
        basePath={basePath ?? ''}
      />
    )
  }

  if (section === 'email-supervision') {
    return (
      <EmailSupervisionSection
        data={emailSupervisionData ?? []}
        page={page}
        totalPages={totalPagesProp}
        basePath={basePath ?? ''}
        resendConfigured={resendConfigured}
        toolId={toolId}
        needsResendTotalCount={needsResendTotalCount}
        totalUserCount={emailSupervisionTotalUserCount}
      />
    )
  }

  if (section === 'users') {
    const inviteWarnStorageKey = `pasceri_invite_warn:${toolId}`

    const notifyInviteEmailOutcome = (res: InviteUserToToolResult): boolean => {
      if (!res.success) {
        toast.error(res.error ?? 'Operazione non riuscita')
        return false
      }
      if (res.warning) {
        try {
          sessionStorage.setItem(inviteWarnStorageKey, res.warning)
        } catch {
          // noop
        }
        setEmailDeliveryBanner(res.warning)
      }
      const delivery = res.inviteEmailDelivery
      if (delivery === 'pending_email_failed' || delivery === 'pending_email_missing_env') {
        toast.warning(res.message ?? 'Invio email incompleto', res.warning ? { description: res.warning } : undefined)
        return true
      }
      const m = res.message ?? ''
      let description: string | undefined
      if (delivery === 'pending_emailed') {
        description =
          'Link porta valido 7 giorni; magic link Supabase (~24 h) solo dopo «Continua e accedi». Controllare spam. In Supervisione email inviti puoi vedere aperture e se serve un reinvio.'
      }
      toast.success(m || 'Operazione completata.', description ? { description } : undefined)
      return true
    }

    const data = usersData ?? []
    const isUserOnboardingPending = (row: ToolUserRow) => {
      const p = row.profiles as (ProfileRow & { onboarding_completed?: boolean }) | null
      return !Boolean(p?.onboarding_completed)
    }
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
      ...(isCloudFsc
        ? ([
            {
              id: 'fsc_company',
              header: 'Impresa FSC',
              render: (row) => {
                const memberships = fscMembershipsByUser?.[row.user_id] ?? []
                if (memberships.length === 0) return <span className="text-slate-400">—</span>
                return (
                  <span className="text-slate-600 text-sm">
                    {memberships.map((m) => m.ragione_sociale).join(', ')}
                  </span>
                )
              },
            },
            {
              id: 'fsc_member_type',
              header: 'Ruolo impresa',
              render: (row) => {
                const memberships = fscMembershipsByUser?.[row.user_id] ?? []
                if (memberships.length === 0) return <span className="text-slate-400">—</span>
                return (
                  <span className="text-slate-600 text-sm">
                    {memberships
                      .map((m) => fscMemberTypeLabel(m.member_type))
                      .join(', ')}
                  </span>
                )
              },
            },
          ] as DataManagementColumn<ToolUserRow>[])
        : []),
    ]
    const dismissEmailDeliveryBanner = () => {
      try {
        sessionStorage.removeItem(inviteWarnStorageKey)
      } catch {
        // noop
      }
      setEmailDeliveryBanner(null)
    }

    const handleInvite = async () => {
      const email = inviteEmail.trim()
      if (!email) {
        toast.error('Inserisci un indirizzo email.')
        return
      }
      setInviteLoading(true)
      const res = await inviteUserToToolAction(toolId, email, inviteRole, {
        fscCompanyId:
          isCloudFsc && inviteFscCompanyId !== 'none' ? inviteFscCompanyId : undefined,
        fscMemberType:
          isCloudFsc && inviteFscCompanyId !== 'none' ? inviteFscMemberType : undefined,
        fscCanEdit: isCloudFsc && inviteFscCompanyId !== 'none' ? inviteFscCanEdit : undefined,
      })
      setInviteLoading(false)
      if (notifyInviteEmailOutcome(res)) {
        setInviteOpen(false)
        setInviteEmail('')
        setInviteRole('standard')
        setInviteFscCompanyId('none')
        setInviteFscMemberType('employee')
        setInviteFscCanEdit(true)
        router.refresh()
      }
    }

    return (
      <>
        {emailDeliveryBanner ? (
          <Alert
            className="mb-4 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50"
            variant="default"
          >
            <AlertCircle className="text-amber-700 dark:text-amber-400" />
            <AlertTitle>Avviso sull’invio email</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <span className="text-left text-sm leading-relaxed">{emailDeliveryBanner}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-300 bg-white hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent"
                onClick={dismissEmailDeliveryBanner}
              >
                Ho capito
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
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
            <p className="text-xs leading-relaxed text-slate-600">
              Il link nell&apos;email resta valido <strong>7 giorni</strong> (pagina porta). Dopo «Continua e
              accedi» il magic link Supabase scade di solito in <strong>~24 ore</strong>: in quel caso
              l&apos;utente può ripremere «Continua» sulla stessa pagina senza reinvio. Reinvia solo se in{' '}
              <strong>Supervisione email inviti</strong> lo stato è «serve reinvio» (ticket scaduto, email
              rimbalzata, nessun link attivo). Chi non ha completato la registrazione non può usare recupero
              password dal login.
            </p>
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
                <Select
                  value={inviteRole}
                  onValueChange={(v) => {
                    if (isInviteRole(v)) setInviteRole(v)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isCloudFsc ? (
                <>
                  <div className="grid gap-2">
                    <Label>Impresa FSC (opzionale)</Label>
                    <Select value={inviteFscCompanyId} onValueChange={setInviteFscCompanyId}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessuna — utente crea al primo accesso</SelectItem>
                        {(fscCompanies ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.ragione_sociale}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteFscCompanyId !== 'none' ? (
                    <>
                      <div className="grid gap-2">
                        <Label>Ruolo in impresa</Label>
                        <Select
                          value={inviteFscMemberType}
                          onValueChange={(v) => setInviteFscMemberType(v as FscMemberType)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Titolare</SelectItem>
                            <SelectItem value="employee">Dipendente</SelectItem>
                            <SelectItem value="consultant">Consulente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={inviteFscCanEdit}
                          onCheckedChange={(c) => setInviteFscCanEdit(Boolean(c))}
                        />
                        <span className="text-sm">Può modificare i dati dell&apos;impresa</span>
                      </label>
                    </>
                  ) : null}
                </>
              ) : null}
              <p className="text-xs text-slate-500">
                Serve <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> sul
                server e <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_SITE_URL</code> con
                l’URL dell’app (non *.supabase.co).
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{AUTH_EMAIL_OTP_EXPIRATION_HINT}</p>
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
          searchMode="server"
          search={{
            value: q,
            onChange: (next) => pushParams({ q: next, page: '1' }),
          }}
          emptyMessage="Nessun utente con accesso al tool."
          resultCountLabel={`${data.length} utenti`}
          pagination={paginationConfig}
          selectable
          selectionResetKey={selectionResetKey}
          onSelectionChange={setSelectedUserIds}
          renderRowActions={(row) => (
            <div className="flex justify-end gap-1">
              {isUserOnboardingPending(row) ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-600 hover:bg-slate-100"
                  onClick={async () => {
                    setUpdating(`resend-${row.user_id}`)
                    const res = await resendPendingOnboardingInviteAction(toolId, row.user_id)
                    setUpdating(null)
                    if (notifyInviteEmailOutcome(res)) {
                      router.refresh()
                    }
                  }}
                  disabled={updating === `resend-${row.user_id}`}
                  title="Reinvia link onboarding (invalida i link delle email precedenti)"
                >
                  {updating === `resend-${row.user_id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </Button>
              ) : null}
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

        {selectedUserIds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-700">{selectedUserIds.length} selezionati</span>
            <Select
              value={bulkUserRole}
              onValueChange={(v) => {
                if (isUserRole(v)) setBulkUserRole(v)
              }}
            >
              <SelectTrigger className="h-8 w-[160px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={bulkUsersLoading}
              onClick={async () => {
                setBulkUsersLoading(true)
                const res = await updateUsersRoleBulkAction(toolId, selectedUserIds, bulkUserRole)
                setBulkUsersLoading(false)
                if (res.success) {
                  toast.success('Ruoli aggiornati.')
                  setSelectionResetKey((k) => k + 1)
                  router.refresh()
                } else toast.error(res.error ?? 'Aggiornamento ruoli fallito.')
              }}
            >
              {bulkUsersLoading ? 'Applico…' : 'Applica ruolo'}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSelectionResetKey((k) => k + 1)}>
              Deseleziona
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={
                bulkResendLoading ||
                selectedUserIds.every((id) => {
                  const row = data.find((r) => r.user_id === id)
                  return !row || !isUserOnboardingPending(row)
                })
              }
              title={`Reinvia link onboarding (max ${PENDING_INVITE_BULK_RESEND_MAX} per volta)`}
              onClick={async () => {
                const pendingIds = selectedUserIds.filter((id) => {
                  const row = data.find((r) => r.user_id === id)
                  return row && isUserOnboardingPending(row)
                })
                if (pendingIds.length === 0) return
                setBulkResendLoading(true)
                const res = await resendPendingOnboardingInvitesBulkAction(toolId, pendingIds)
                setBulkResendLoading(false)
                if (res.succeeded > 0) {
                  toast.success(`Reinvio: ${res.succeeded}/${res.processed} completati.`)
                }
                if (res.failed > 0) {
                  toast.error(res.error ?? 'Alcuni reinvii non sono riusciti.', {
                    description: res.errors.slice(0, 8).join('\n'),
                  })
                }
                if (res.succeeded > 0) {
                  setSelectionResetKey((k) => k + 1)
                  router.refresh()
                }
              }}
            >
              {bulkResendLoading ? 'Reinvio…' : 'Reinvia link (pending)'}
            </Button>
          </div>
        )}

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
        <div className="flex flex-wrap justify-end gap-2">
          {selectedSpeciesIds.length > 0 && (
            <div className="mr-auto flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">{selectedSpeciesIds.length} selezionati</span>
              <Select
                value={bulkSpeciesMode}
                onValueChange={(v) => {
                  if (isBulkSpeciesMode(v)) setBulkSpeciesMode(v)
                }}
              >
                <SelectTrigger className="h-8 w-[160px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Imposta CITES</SelectItem>
                  <SelectItem value="clear">Svuota CITES</SelectItem>
                </SelectContent>
              </Select>
              {bulkSpeciesMode === 'set' && (
                <Input
                  className="h-8 w-[120px] bg-white"
                  inputMode="numeric"
                  value={bulkSpeciesCites}
                  onChange={(e) => setBulkSpeciesCites(e.target.value)}
                  placeholder="CITES"
                />
              )}
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={bulkSpeciesLoading}
                onClick={async () => {
                  setBulkSpeciesLoading(true)
                  const cites =
                    bulkSpeciesMode === 'clear'
                      ? null
                      : Number.parseInt(bulkSpeciesCites.trim(), 10)
                  const patch = bulkSpeciesMode === 'clear' ? { cites: null } : { cites }
                  const res = await updateSpeciesBulk(toolId, selectedSpeciesIds, patch)
                  setBulkSpeciesLoading(false)
                  if (res.success) {
                    toast.success('Aggiornamento massivo completato.')
                    setSelectionResetKey((k) => k + 1)
                    router.refresh()
                  } else toast.error(res.error ?? 'Aggiornamento massivo fallito.')
                }}
              >
                {bulkSpeciesLoading ? 'Applico…' : 'Applica'}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSelectionResetKey((k) => k + 1)}>
                Deseleziona
              </Button>
            </div>
          )}
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
          searchMode="server"
          search={{
            value: q,
            onChange: (next) => pushParams({ q: next, page: '1' }),
          }}
          sortConfig={{
            field: sort ?? 'scientific_name',
            dir,
            onSort: (field) => {
              const nextDir = sort === field ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
              pushParams({ sort: field, dir: nextDir, page: '1' })
            },
          }}
          selectable
          selectionResetKey={selectionResetKey}
          onSelectionChange={setSelectedSpeciesIds}
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
    const openViewNotif = (row: NotificationRow) => {
      setViewingNotif({
        id: row.id,
        title: row.title,
        message: row.message,
        created_at: row.created_at,
        expires_at: row.expires_at,
      })
      setViewNotifOpen(true)
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
          <button
            type="button"
            onClick={() => openViewNotif(row)}
            className="max-w-[280px] text-left text-slate-600 line-clamp-2 hover:text-amber-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-sm"
            title="Apri messaggio completo"
          >
            {row.message ?? '—'}
          </button>
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

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end gap-2">
          {selectedNotifIds.length > 0 && (
            <div className="mr-auto flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-700">{selectedNotifIds.length} selezionati</span>
              <Select
                value={bulkNotifField}
                onValueChange={(v) => {
                  if (isNotifBulkField(v)) setBulkNotifField(v)
                }}
              >
                <SelectTrigger className="h-8 w-[180px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is_active">Imposta “Attiva”</SelectItem>
                  <SelectItem value="expires_at">Svuota “Scadenza”</SelectItem>
                </SelectContent>
              </Select>
              {bulkNotifField === 'is_active' ? (
                <Select
                  value={bulkNotifBool}
                  onValueChange={(v) => {
                    if (isBoolString(v)) setBulkNotifBool(v)
                  }}
                >
                  <SelectTrigger className="h-8 w-[110px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Sì</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={bulkNotifExpiryMode}
                  onValueChange={(v) => {
                    if (isNotifExpiryMode(v)) setBulkNotifExpiryMode(v)
                  }}
                >
                  <SelectTrigger className="h-8 w-[140px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear">Svuota</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={bulkNotifLoading}
                onClick={async () => {
                  setBulkNotifLoading(true)
                  const patch =
                    bulkNotifField === 'is_active'
                      ? { is_active: bulkNotifBool === 'true' }
                      : { expires_at: null }
                  const res = await updateNotificationsBulk(toolId, selectedNotifIds, patch)
                  setBulkNotifLoading(false)
                  if (res.success) {
                    toast.success('Aggiornamento massivo completato.')
                    setSelectionResetKey((k) => k + 1)
                    router.refresh()
                  } else toast.error(res.error ?? 'Aggiornamento massivo fallito.')
                }}
              >
                {bulkNotifLoading ? 'Applico…' : 'Applica'}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setSelectionResetKey((k) => k + 1)}>
                Deseleziona
              </Button>
            </div>
          )}
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
          searchMode="server"
          search={{
            value: q,
            onChange: (next) => pushParams({ q: next, page: '1' }),
          }}
          sortConfig={{
            field: sort ?? 'created_at',
            dir,
            onSort: (field) => {
              const nextDir = sort === field ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
              pushParams({ sort: field, dir: nextDir, page: '1' })
            },
          }}
          selectable
          selectionResetKey={selectionResetKey}
          onSelectionChange={setSelectedNotifIds}
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
                onClick={() => openViewNotif(row)}
                title="Visualizza"
              >
                <Eye className="h-4 w-4" />
              </Button>
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
        <NotificationDetailDialog
          notification={viewingNotif}
          open={viewNotifOpen}
          onOpenChange={(open) => {
            setViewNotifOpen(open)
            if (!open) setViewingNotif(null)
          }}
        />
      </div>
    )
  }

  // section === 'countries'
  const data = countriesData ?? []
  const resetForm = () => {
    setEditingId(null)
    setCountryName('')
    setExtraEu(false)
    setConflicts(false)
    setSanction(false)
    setCorruptionCode('')
    setCountryRiskSel('none')
    setFaoStr('')
    setCpi23Str('')
    setCpi24Str('')
    setCpi25Str('')
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
    const validCorruption = ['AA', 'MA', 'MB', 'MM', 'TT'] as const
    const cc = row.corruption_code
    setCorruptionCode(
      cc && (validCorruption as readonly string[]).includes(cc) ? cc : ''
    )
    const r = row.country_risk
    setCountryRiskSel(r === 'RA' || r === 'RB' || r === 'RS' ? r : 'none')
    setFaoStr(row.fao != null ? String(row.fao) : '')
    setCpi23Str(row.cpi_23 != null ? String(row.cpi_23) : '')
    setCpi24Str(row.cpi_24 != null ? String(row.cpi_24) : '')
    setCpi25Str(row.cpi_25 != null ? String(row.cpi_25) : '')
    setDialogOpen(true)
  }
  const handleSubmit = async () => {
    const fao = parseOptionalCountryNumber(faoStr)
    const cpi23 = parseOptionalCountryNumber(cpi23Str)
    const cpi24 = parseOptionalCountryNumber(cpi24Str)
    const cpi25 = parseOptionalCountryNumber(cpi25Str)
    if (fao === false) {
      toast.error('Valore FAO non valido.')
      return
    }
    if (cpi23 === false) {
      toast.error('Valore CPI 2023 non valido.')
      return
    }
    if (cpi24 === false) {
      toast.error('Valore CPI 2024 non valido.')
      return
    }
    if (cpi25 === false) {
      toast.error('Valore CPI 2025 non valido.')
      return
    }
    const country_risk =
      countryRiskSel === 'none' ? null : countryRiskSel
    const corruptionPayload = corruptionCode.trim() || null
    if (editingId) {
      const res = await updateCountry(toolId, editingId, {
        country_name: countryName.trim() || null,
        extra_eu: extraEu,
        conflicts,
        sanction,
        corruption_code: corruptionPayload,
        country_risk,
        fao,
        cpi_23: cpi23,
        cpi_24: cpi24,
        cpi_25: cpi25,
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
        corruption_code: corruptionPayload,
        country_risk,
        fao,
        cpi_23: cpi23,
        cpi_24: cpi24,
        cpi_25: cpi25,
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
      id: 'country_risk',
      header: 'Rischio',
      sortKey: 'country_risk',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.country_risk ?? '—'}
        </span>
      ),
    },
    {
      id: 'fao',
      header: 'FAO',
      sortKey: 'fao',
      render: (row) => (
        <span className="text-slate-600 tabular-nums text-xs">
          {formatCountryNumber(row.fao)}
        </span>
      ),
    },
    {
      id: 'cpi_23',
      header: 'CPI 2023',
      sortKey: 'cpi_23',
      render: (row) => (
        <span className="text-slate-600 tabular-nums text-xs">
          {formatCountryNumber(row.cpi_23)}
        </span>
      ),
    },
    {
      id: 'cpi_24',
      header: 'CPI 2024',
      sortKey: 'cpi_24',
      render: (row) => (
        <span className="text-slate-600 tabular-nums text-xs">
          {formatCountryNumber(row.cpi_24)}
        </span>
      ),
    },
    {
      id: 'cpi_25',
      header: 'CPI 2025',
      sortKey: 'cpi_25',
      render: (row) => (
        <span className="text-slate-600 tabular-nums text-xs">
          {formatCountryNumber(row.cpi_25)}
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
      <div className="flex flex-wrap justify-end gap-2">
        {selectedCountryIds.length > 0 && (
          <div className="mr-auto flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-700">
              {selectedCountryIds.length} selezionati
            </span>
            <Select
              value={bulkField}
              onValueChange={(v) => {
                if (isCountryBulkField(v)) setBulkField(v)
              }}
            >
              <SelectTrigger className="h-8 w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conflicts">Imposta “Conflitti”</SelectItem>
                <SelectItem value="sanction">Imposta “Sanzioni”</SelectItem>
                <SelectItem value="extra_eu">Imposta “Extra UE”</SelectItem>
                <SelectItem value="corruption_code">Imposta “Cod. corruzione”</SelectItem>
                  <SelectItem value="cpi_multi">Imposta CPI (più anni)</SelectItem>
              </SelectContent>
            </Select>

            {bulkField === 'cpi_multi' ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={bulkCpi23Enabled}
                    onCheckedChange={(c) => setBulkCpi23Enabled(Boolean(c))}
                    id="bulk-cpi-23-enabled"
                  />
                  <Label htmlFor="bulk-cpi-23-enabled" className="text-xs text-slate-700">
                    CPI 2023
                  </Label>
                  <Input
                    className="h-8 w-[110px] bg-white"
                    inputMode="decimal"
                    value={bulkCpi23}
                    onChange={(e) => setBulkCpi23(e.target.value)}
                    placeholder={bulkCpi23Enabled ? 'valore / vuoto=svuota' : '—'}
                    disabled={!bulkCpi23Enabled}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={bulkCpi24Enabled}
                    onCheckedChange={(c) => setBulkCpi24Enabled(Boolean(c))}
                    id="bulk-cpi-24-enabled"
                  />
                  <Label htmlFor="bulk-cpi-24-enabled" className="text-xs text-slate-700">
                    CPI 2024
                  </Label>
                  <Input
                    className="h-8 w-[110px] bg-white"
                    inputMode="decimal"
                    value={bulkCpi24}
                    onChange={(e) => setBulkCpi24(e.target.value)}
                    placeholder={bulkCpi24Enabled ? 'valore / vuoto=svuota' : '—'}
                    disabled={!bulkCpi24Enabled}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={bulkCpi25Enabled}
                    onCheckedChange={(c) => setBulkCpi25Enabled(Boolean(c))}
                    id="bulk-cpi-25-enabled"
                  />
                  <Label htmlFor="bulk-cpi-25-enabled" className="text-xs text-slate-700">
                    CPI 2025
                  </Label>
                  <Input
                    className="h-8 w-[110px] bg-white"
                    inputMode="decimal"
                    value={bulkCpi25}
                    onChange={(e) => setBulkCpi25(e.target.value)}
                    placeholder={bulkCpi25Enabled ? 'valore / vuoto=svuota' : '—'}
                    disabled={!bulkCpi25Enabled}
                  />
                </div>
              </div>
            ) : bulkField === 'corruption_code' ? (
              <Select
                value={bulkCorruptionCode}
                onValueChange={(v) => {
                  if (isCorruptionCode(v)) setBulkCorruptionCode(v)
                }}
              >
                <SelectTrigger className="h-8 w-[120px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AA">AA</SelectItem>
                  <SelectItem value="MA">MA</SelectItem>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="MM">MM</SelectItem>
                  <SelectItem value="TT">TT</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={bulkBoolValue}
                onValueChange={(v) => {
                  if (isBoolString(v)) setBulkBoolValue(v)
                }}
              >
                <SelectTrigger className="h-8 w-[110px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sì</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={bulkLoading}
              onClick={async () => {
                  if (bulkField === 'cpi_multi') {
                    if (!bulkCpi23Enabled && !bulkCpi24Enabled && !bulkCpi25Enabled) return
                    const cpi23 = bulkCpi23Enabled ? parseOptionalCountryNumber(bulkCpi23) : undefined
                    const cpi24 = bulkCpi24Enabled ? parseOptionalCountryNumber(bulkCpi24) : undefined
                    const cpi25 = bulkCpi25Enabled ? parseOptionalCountryNumber(bulkCpi25) : undefined
                    if (cpi23 === false) {
                      toast.error('Valore CPI 2023 non valido.')
                      return
                    }
                    if (cpi24 === false) {
                      toast.error('Valore CPI 2024 non valido.')
                      return
                    }
                    if (cpi25 === false) {
                      toast.error('Valore CPI 2025 non valido.')
                      return
                    }
                    setBulkLoading(true)
                    const patch: Partial<Pick<CountryRow, 'cpi_23' | 'cpi_24' | 'cpi_25'>> = {}
                    if (bulkCpi23Enabled) patch.cpi_23 = cpi23 ?? null
                    if (bulkCpi24Enabled) patch.cpi_24 = cpi24 ?? null
                    if (bulkCpi25Enabled) patch.cpi_25 = cpi25 ?? null
                    const res = await updateCountriesBulk(toolId, selectedCountryIds, patch)
                    setBulkLoading(false)
                    if (res.success) {
                      toast.success('Aggiornamento massivo completato.')
                      setSelectionResetKey((k) => k + 1)
                      router.refresh()
                    } else {
                      toast.error(res.error ?? 'Aggiornamento massivo fallito.')
                    }
                    return
                  }
                setBulkLoading(true)
                const patch =
                  bulkField === 'corruption_code'
                    ? { corruption_code: bulkCorruptionCode }
                    : bulkField === 'conflicts'
                      ? { conflicts: bulkBoolValue === 'true' }
                      : bulkField === 'sanction'
                        ? { sanction: bulkBoolValue === 'true' }
                        : { extra_eu: bulkBoolValue === 'true' }
                const res = await updateCountriesBulk(toolId, selectedCountryIds, patch)
                setBulkLoading(false)
                if (res.success) {
                  toast.success('Aggiornamento massivo completato.')
                  setSelectionResetKey((k) => k + 1)
                  router.refresh()
                } else {
                  toast.error(res.error ?? 'Aggiornamento massivo fallito.')
                }
              }}
            >
              {bulkLoading ? 'Applico…' : 'Applica'}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setSelectionResetKey((k) => k + 1)}
            >
              Deseleziona
            </Button>
          </div>
        )}
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
        searchMode="server"
        search={{
          value: q,
          onChange: (next) => pushParams({ q: next, page: '1' }),
        }}
        sortConfig={{
          field: sort ?? 'country_name',
          dir,
          onSort: (field) => {
            const nextDir = sort === field ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'
            pushParams({ sort: field, dir: nextDir, page: '1' })
          },
        }}
        selectable
        selectionResetKey={selectionResetKey}
        onSelectionChange={setSelectedCountryIds}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
              <Label>Rischio paese</Label>
              <Select
                value={countryRiskSel}
                onValueChange={(v) =>
                  setCountryRiskSel(v as 'none' | 'RA' | 'RB' | 'RS')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  <SelectItem value="RA">RA</SelectItem>
                  <SelectItem value="RB">RB</SelectItem>
                  <SelectItem value="RS">RS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="country-fao">FAO</Label>
                <Input
                  id="country-fao"
                  inputMode="decimal"
                  value={faoStr}
                  onChange={(e) => setFaoStr(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country-cpi-23">CPI 2023</Label>
                <Input
                  id="country-cpi-23"
                  inputMode="decimal"
                  value={cpi23Str}
                  onChange={(e) => setCpi23Str(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country-cpi-24">CPI 2024</Label>
                <Input
                  id="country-cpi-24"
                  inputMode="decimal"
                  value={cpi24Str}
                  onChange={(e) => setCpi24Str(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="country-cpi-25">CPI 2025</Label>
                <Input
                  id="country-cpi-25"
                  inputMode="decimal"
                  value={cpi25Str}
                  onChange={(e) => setCpi25Str(e.target.value)}
                  placeholder="opzionale"
                />
              </div>
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
            <div className="grid gap-2">
              <Label>Codice corruzione</Label>
              <Select
                value={corruptionCode || 'none'}
                onValueChange={(v) =>
                  setCorruptionCode(v === 'none' ? '' : v)
                }
              >
                <SelectTrigger id="country-corruption">
                  <SelectValue placeholder="Nessuno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  <SelectItem value="AA">AA</SelectItem>
                  <SelectItem value="MA">MA</SelectItem>
                  <SelectItem value="MB">MB</SelectItem>
                  <SelectItem value="MM">MM</SelectItem>
                  <SelectItem value="TT">TT</SelectItem>
                </SelectContent>
              </Select>
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
