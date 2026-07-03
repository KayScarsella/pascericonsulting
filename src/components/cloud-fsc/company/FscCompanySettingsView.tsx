'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  addExistingUserToFscCompany,
  listFscCompanyMembers,
  lookupFscInviteEmail,
  removeFscCompanyMember,
  updateFscCompanyMember,
  type FscCompanyMemberRow,
  type FscInviteLookupResult,
} from '@/actions/fsc/members'
import { updateFscCompany, type FscCompanyInput } from '@/actions/fsc/company'
import type { FscCompany, FscCompanyMember, FscMemberType } from '@/types/fsc'
import { fscMemberTypeLabel } from '@/lib/fsc/constants'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SettingsSection = 'profile' | 'contacts' | 'address' | 'team'

type FscCompanySettingsViewProps = {
  company: FscCompany
  membership: FscCompanyMember
  initialMembers: FscCompanyMemberRow[]
  isAdmin: boolean
}

const SECTIONS: {
  id: SettingsSection
  label: string
  description: string
  icon: typeof Building2
  ownerOnly?: boolean
}[] = [
  {
    id: 'profile',
    label: 'Profilo impresa',
    description: 'Ragione sociale e dati fiscali',
    icon: Building2,
  },
  {
    id: 'contacts',
    label: 'Contatti',
    description: 'Email, telefono e sito web',
    icon: Mail,
  },
  {
    id: 'address',
    label: 'Indirizzo',
    description: 'Sede legale e località',
    icon: MapPin,
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Membri e permessi',
    icon: Users,
    ownerOnly: true,
  },
]

function lookupBadgeClass(status: FscInviteLookupResult['status']): string {
  switch (status) {
    case 'eligible':
      return 'bg-green-100 text-green-800'
    case 'already_member':
      return 'bg-slate-100 text-slate-700'
    case 'pending_onboarding':
      return 'bg-amber-100 text-amber-800'
    case 'no_tool_access':
    case 'not_found':
    default:
      return 'bg-red-100 text-red-800'
  }
}

function memberRoleBadgeClass(type: FscMemberType): string {
  switch (type) {
    case 'owner':
      return 'bg-[#967635]/15 text-[#7d6230]'
    case 'consultant':
      return 'bg-blue-100 text-blue-800'
    case 'employee':
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function companyToForm(company: FscCompany): FscCompanyInput {
  return {
    ragione_sociale: company.ragione_sociale,
    cf_partita_iva: company.cf_partita_iva,
    indirizzo: company.indirizzo,
    cap: company.cap,
    citta: company.citta,
    provincia: company.provincia,
    recapito_telefonico: company.recapito_telefonico,
    sito_internet: company.sito_internet,
    email: company.email,
  }
}

function formEquals(a: FscCompanyInput, b: FscCompanyInput): boolean {
  const keys: (keyof FscCompanyInput)[] = [
    'ragione_sociale',
    'cf_partita_iva',
    'indirizzo',
    'cap',
    'citta',
    'provincia',
    'recapito_telefonico',
    'sito_internet',
    'email',
  ]
  return keys.every((k) => (a[k] ?? '') === (b[k] ?? ''))
}

export function FscCompanySettingsView({
  company,
  membership,
  initialMembers,
  isAdmin,
}: FscCompanySettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [members, setMembers] = useState(initialMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMemberType, setInviteMemberType] = useState<'employee' | 'consultant'>('employee')
  const [inviteCanEdit, setInviteCanEdit] = useState(true)
  const [lookup, setLookup] = useState<FscInviteLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [mobileShowContent, setMobileShowContent] = useState(false)

  const savedForm = useMemo(() => companyToForm(company), [company])
  const [form, setForm] = useState<FscCompanyInput>(savedForm)

  useEffect(() => {
    setForm(savedForm)
  }, [savedForm])

  const isOwner = membership.member_type === 'owner' || isAdmin
  const canEditCompany = membership.can_edit || isAdmin
  const isDirty = canEditCompany && !formEquals(form, savedForm)

  const visibleSections = SECTIONS.filter((s) => !s.ownerOnly || isOwner)

  const sectionParam = searchParams.get('section')
  const activeSection: SettingsSection = visibleSections.some((s) => s.id === sectionParam)
    ? (sectionParam as SettingsSection)
    : 'profile'

  const setSection = (section: SettingsSection) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', section)
    router.replace(`?${params.toString()}`, { scroll: false })
    setMobileShowContent(true)
  }

  const updateField = (field: keyof FscCompanyInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }))
  }

  const refreshMembers = useCallback(async () => {
    const res = await listFscCompanyMembers(company.id)
    if (res.data) setMembers(res.data)
  }, [company.id])

  const handleSave = () => {
    if (!form.ragione_sociale.trim()) {
      toast.error('La ragione sociale è obbligatoria.')
      return
    }

    startTransition(async () => {
      const res = await updateFscCompany(company.id, {
        ...form,
        ragione_sociale: form.ragione_sociale.trim(),
      })
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito.')
        return
      }
      toast.success('Dati impresa aggiornati.')
      router.refresh()
    })
  }

  const handleDiscard = () => {
    setForm(savedForm)
  }

  const runLookup = async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setLookup(null)
      return
    }
    setLookupLoading(true)
    const result = await lookupFscInviteEmail(company.id, trimmed)
    setLookup(result)
    setLookupLoading(false)
  }

  const handleInvite = () => {
    startTransition(async () => {
      const res = await addExistingUserToFscCompany({
        companyId: company.id,
        email: inviteEmail,
        memberType: inviteMemberType,
        canEdit: inviteCanEdit,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Invito fallito.')
        return
      }
      if (res.warning) toast.warning(res.warning)
      else toast.success('Membro aggiunto al team.')
      setInviteOpen(false)
      setInviteEmail('')
      setLookup(null)
      await refreshMembers()
      router.refresh()
    })
  }

  const handleRemoveMember = (userId: string) => {
    startTransition(async () => {
      const res = await removeFscCompanyMember({ companyId: company.id, userId })
      if (!res.success) {
        toast.error(res.error ?? 'Rimozione fallita.')
        return
      }
      toast.success('Membro rimosso.')
      await refreshMembers()
      router.refresh()
    })
  }

  const handleUpdateMember = (userId: string, memberType: FscMemberType, canEdit: boolean) => {
    startTransition(async () => {
      const res = await updateFscCompanyMember({
        companyId: company.id,
        userId,
        memberType,
        canEdit,
      })
      if (!res.success) {
        toast.error(res.error ?? 'Aggiornamento fallito.')
        return
      }
      toast.success('Ruolo aggiornato.')
      await refreshMembers()
    })
  }

  const activeMeta = visibleSections.find((s) => s.id === activeSection) ?? visibleSections[0]

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profilo impresa</CardTitle>
              <CardDescription>Identità legale e dati fiscali dell&apos;azienda certificata.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="ragione_sociale">Ragione sociale</Label>
                <Input
                  id="ragione_sociale"
                  value={form.ragione_sociale}
                  onChange={(e) => updateField('ragione_sociale', e.target.value)}
                  required
                  disabled={!canEditCompany || pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf_partita_iva">CF / Partita IVA</Label>
                <Input
                  id="cf_partita_iva"
                  value={form.cf_partita_iva ?? ''}
                  onChange={(e) => updateField('cf_partita_iva', e.target.value)}
                  disabled={!canEditCompany || pending}
                />
              </div>
            </CardContent>
          </Card>
        )
      case 'contacts':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Contatti</CardTitle>
              <CardDescription>Recapiti utilizzati per comunicazioni e riferimenti nel tool.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  disabled={!canEditCompany || pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recapito_telefonico">Telefono</Label>
                <Input
                  id="recapito_telefonico"
                  value={form.recapito_telefonico ?? ''}
                  onChange={(e) => updateField('recapito_telefonico', e.target.value)}
                  disabled={!canEditCompany || pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sito_internet">Sito web</Label>
                <Input
                  id="sito_internet"
                  value={form.sito_internet ?? ''}
                  onChange={(e) => updateField('sito_internet', e.target.value)}
                  placeholder="https://"
                  disabled={!canEditCompany || pending}
                />
              </div>
            </CardContent>
          </Card>
        )
      case 'address':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Indirizzo</CardTitle>
              <CardDescription>Sede legale e dati di localizzazione.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="indirizzo">Indirizzo</Label>
                <Input
                  id="indirizzo"
                  value={form.indirizzo ?? ''}
                  onChange={(e) => updateField('indirizzo', e.target.value)}
                  disabled={!canEditCompany || pending}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cap">CAP</Label>
                  <Input
                    id="cap"
                    value={form.cap ?? ''}
                    onChange={(e) => updateField('cap', e.target.value)}
                    disabled={!canEditCompany || pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citta">Città</Label>
                  <Input
                    id="citta"
                    value={form.citta ?? ''}
                    onChange={(e) => updateField('citta', e.target.value)}
                    disabled={!canEditCompany || pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    value={form.provincia ?? ''}
                    onChange={(e) => updateField('provincia', e.target.value)}
                    disabled={!canEditCompany || pending}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      case 'team':
        return (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Team</CardTitle>
                <CardDescription>
                  Gestisci chi può accedere all&apos;impresa e con quali permessi di modifica.
                </CardDescription>
              </div>
              <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Aggiungi
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                Puoi aggiungere solo utenti già registrati con accesso a CLOUD FSC. Per nuovi utenti
                esterni, contatta l&apos;amministratore.
              </p>
              {members.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Nessun membro nel team</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Invita colleghi o consulenti per collaborare sui moduli FSC.
                  </p>
                  <Button type="button" className="mt-4" size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Aggiungi il primo membro
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-medium">Membro</th>
                        <th className="px-4 py-3 font-medium">Ruolo</th>
                        <th className="px-4 py-3 font-medium">Modifica</th>
                        <th className="px-4 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.user_id} className="border-t border-slate-100 bg-white">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {m.profiles?.full_name ?? '—'}
                            </div>
                            <div className="text-xs text-slate-500">{m.profiles?.email ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3">
                            {m.member_type === 'owner' ? (
                              <Badge className={memberRoleBadgeClass(m.member_type)}>
                                {fscMemberTypeLabel(m.member_type)}
                              </Badge>
                            ) : (
                              <Select
                                value={m.member_type}
                                onValueChange={(v) =>
                                  handleUpdateMember(m.user_id, v as FscMemberType, m.can_edit)
                                }
                                disabled={pending}
                              >
                                <SelectTrigger className="h-8 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Dipendente</SelectItem>
                                  <SelectItem value="consultant">Consulente</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {m.member_type === 'owner' ? (
                              <span className="text-slate-600">Sì</span>
                            ) : (
                              <Checkbox
                                checked={m.can_edit}
                                disabled={pending}
                                onCheckedChange={(checked) =>
                                  handleUpdateMember(m.user_id, m.member_type, Boolean(checked))
                                }
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {m.member_type !== 'owner' ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={pending}
                                onClick={() => handleRemoveMember(m.user_id)}
                                aria-label="Rimuovi membro"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <div className="relative pb-20">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <nav
          className={cn(
            'lg:w-56 lg:shrink-0',
            mobileShowContent ? 'hidden lg:block' : 'block'
          )}
        >
          <p className="mb-3 hidden text-xs font-medium uppercase tracking-wide text-slate-400 lg:block">
            Sezioni
          </p>
          <ul className="space-y-1">
            {visibleSections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => setSection(section.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-[#967635]/10 font-medium text-[#7d6230]'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      <span className="block">{section.label}</span>
                      <span className="hidden text-xs font-normal text-slate-500 lg:block">
                        {section.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 lg:hidden" />
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div
          className={cn(
            'min-w-0 flex-1',
            !mobileShowContent ? 'hidden lg:block' : 'block'
          )}
        >
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-2"
              onClick={() => setMobileShowContent(false)}
            >
              <ArrowLeft className="h-4 w-4" />
              Sezioni
            </Button>
            <span className="text-sm font-medium text-slate-700">{activeMeta.label}</span>
          </div>
          {renderSectionContent()}
          {!canEditCompany && activeSection !== 'team' ? (
            <p className="mt-4 text-sm text-slate-500">
              Sola lettura: non hai permesso di modifica su questa impresa.
            </p>
          ) : null}
        </div>
      </div>

      {isDirty ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p className="text-sm text-slate-600">Hai modifiche non salvate</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDiscard} disabled={pending}>
                Annulla
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={pending}>
                {pending ? 'Salvataggio...' : 'Salva modifiche'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi membro al team</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="member-email">Email utente</Label>
              <Input
                id="member-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  void runLookup(e.target.value)
                }}
                placeholder="nome@azienda.it"
              />
              {lookupLoading ? (
                <p className="text-xs text-slate-500">Verifica in corso...</p>
              ) : lookup ? (
                <Badge className={lookupBadgeClass(lookup.status)}>{lookup.message}</Badge>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Ruolo in impresa</Label>
              <Select
                value={inviteMemberType}
                onValueChange={(v) => setInviteMemberType(v as 'employee' | 'consultant')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Dipendente</SelectItem>
                  <SelectItem value="consultant">Consulente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="can-edit"
                checked={inviteCanEdit}
                onCheckedChange={(c) => setInviteCanEdit(Boolean(c))}
              />
              <Label htmlFor="can-edit">Può modificare i dati</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleInvite} disabled={pending || lookup?.status !== 'eligible'}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aggiungi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
