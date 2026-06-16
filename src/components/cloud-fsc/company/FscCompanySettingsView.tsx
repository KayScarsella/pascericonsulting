'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { Loader2, Trash2, UserPlus } from 'lucide-react'

type FscCompanySettingsViewProps = {
  company: FscCompany
  membership: FscCompanyMember
  initialMembers: FscCompanyMemberRow[]
  isAdmin: boolean
}

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

export function FscCompanySettingsView({
  company,
  membership,
  initialMembers,
  isAdmin,
}: FscCompanySettingsViewProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [members, setMembers] = useState(initialMembers)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMemberType, setInviteMemberType] = useState<'employee' | 'consultant'>('employee')
  const [inviteCanEdit, setInviteCanEdit] = useState(true)
  const [lookup, setLookup] = useState<FscInviteLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const isOwner = membership.member_type === 'owner' || isAdmin
  const canEditCompany = membership.can_edit || isAdmin

  const refreshMembers = useCallback(async () => {
    const res = await listFscCompanyMembers(company.id)
    if (res.data) setMembers(res.data)
  }, [company.id])

  const handleCompanySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input: FscCompanyInput = {
      ragione_sociale: String(fd.get('ragione_sociale') ?? '').trim(),
      cf_partita_iva: String(fd.get('cf_partita_iva') ?? '').trim() || null,
      indirizzo: String(fd.get('indirizzo') ?? '').trim() || null,
      cap: String(fd.get('cap') ?? '').trim() || null,
      citta: String(fd.get('citta') ?? '').trim() || null,
      provincia: String(fd.get('provincia') ?? '').trim() || null,
      recapito_telefonico: String(fd.get('recapito_telefonico') ?? '').trim() || null,
      sito_internet: String(fd.get('sito_internet') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
    }

    startTransition(async () => {
      const res = await updateFscCompany(company.id, input)
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito.')
        return
      }
      toast.success('Dati impresa aggiornati.')
      router.refresh()
    })
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

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Dati impresa</h2>
        <form onSubmit={handleCompanySubmit} className="max-w-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ragione_sociale">Ragione sociale</Label>
            <Input
              id="ragione_sociale"
              name="ragione_sociale"
              defaultValue={company.ragione_sociale}
              required
              disabled={!canEditCompany || pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cf_partita_iva">CF / Partita IVA</Label>
            <Input
              id="cf_partita_iva"
              name="cf_partita_iva"
              defaultValue={company.cf_partita_iva ?? ''}
              disabled={!canEditCompany || pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={company.email ?? ''}
              disabled={!canEditCompany || pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="indirizzo">Indirizzo</Label>
            <Input
              id="indirizzo"
              name="indirizzo"
              defaultValue={company.indirizzo ?? ''}
              disabled={!canEditCompany || pending}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cap">CAP</Label>
              <Input id="cap" name="cap" defaultValue={company.cap ?? ''} disabled={!canEditCompany || pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="citta">Città</Label>
              <Input id="citta" name="citta" defaultValue={company.citta ?? ''} disabled={!canEditCompany || pending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input
                id="provincia"
                name="provincia"
                defaultValue={company.provincia ?? ''}
                disabled={!canEditCompany || pending}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recapito_telefonico">Telefono</Label>
              <Input
                id="recapito_telefonico"
                name="recapito_telefonico"
                defaultValue={company.recapito_telefonico ?? ''}
                disabled={!canEditCompany || pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sito_internet">Sito web</Label>
              <Input
                id="sito_internet"
                name="sito_internet"
                defaultValue={company.sito_internet ?? ''}
                disabled={!canEditCompany || pending}
              />
            </div>
          </div>
          {canEditCompany ? (
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvataggio...' : 'Salva modifiche'}
            </Button>
          ) : (
            <p className="text-sm text-slate-500">Sola lettura: non hai permesso di modifica su questa impresa.</p>
          )}
        </form>
      </section>

      {isOwner ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Team</h2>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Aggiungi membro
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Puoi aggiungere solo utenti già registrati con accesso a CLOUD FSC. Per nuovi utenti esterni,
            contatta l&apos;amministratore.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Ruolo</th>
                  <th className="px-4 py-3 font-medium">Modifica</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{m.profiles?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">{m.profiles?.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      {m.member_type === 'owner' ? (
                        <span>{fscMemberTypeLabel(m.member_type)}</span>
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
                        'Sì'
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
        </section>
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
            <Button
              onClick={handleInvite}
              disabled={pending || lookup?.status !== 'eligible'}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aggiungi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
