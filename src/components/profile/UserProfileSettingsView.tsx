'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  changeMyPassword,
  updateMyProfile,
  type MyProfile,
  type MyProfileInput,
} from '@/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ProfileSection = 'profile' | 'business' | 'contacts' | 'address' | 'security'

type UserProfileSettingsViewProps = {
  profile: MyProfile
}

const SECTIONS: {
  id: ProfileSection
  label: string
  description: string
  icon: typeof User
}[] = [
  {
    id: 'profile',
    label: 'Profilo',
    description: 'Nome e username',
    icon: User,
  },
  {
    id: 'business',
    label: 'Dati azienda',
    description: 'Ragione sociale e attività',
    icon: Building2,
  },
  {
    id: 'contacts',
    label: 'Contatti',
    description: 'Telefono e sito web',
    icon: Mail,
  },
  {
    id: 'address',
    label: 'Indirizzo',
    description: 'Sede e località',
    icon: MapPin,
  },
  {
    id: 'security',
    label: 'Sicurezza',
    description: 'Cambio password',
    icon: KeyRound,
  },
]

function profileToForm(profile: MyProfile): MyProfileInput {
  return {
    full_name: profile.full_name ?? '',
    username: profile.username,
    ragione_sociale: profile.ragione_sociale,
    cf_partita_iva: profile.cf_partita_iva,
    indirizzo: profile.indirizzo,
    cap: profile.cap,
    citta: profile.citta,
    provincia: profile.provincia,
    recapito_telefonico: profile.recapito_telefonico,
    sito_internet: profile.sito_internet,
    settore_merceologico: profile.settore_merceologico,
    attivita: profile.attivita,
  }
}

function formEquals(a: MyProfileInput, b: MyProfileInput): boolean {
  const keys = Object.keys(a) as (keyof MyProfileInput)[]
  return keys.every((k) => (a[k] ?? '') === (b[k] ?? ''))
}

export function UserProfileSettingsView({ profile }: UserProfileSettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [mobileShowContent, setMobileShowContent] = useState(false)

  const savedForm = useMemo(() => profileToForm(profile), [profile])
  const [form, setForm] = useState<MyProfileInput>(savedForm)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordPending, setPasswordPending] = useState(false)

  useEffect(() => {
    setForm(savedForm)
  }, [savedForm])

  const sectionParam = searchParams.get('section')
  const activeSection: ProfileSection = SECTIONS.some((s) => s.id === sectionParam)
    ? (sectionParam as ProfileSection)
    : 'profile'

  const isDirty = activeSection !== 'security' && !formEquals(form, savedForm)

  const setSection = (section: ProfileSection) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', section)
    router.replace(`?${params.toString()}`, { scroll: false })
    setMobileShowContent(true)
  }

  const updateField = (field: keyof MyProfileInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value || null }))
  }

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateMyProfile(form)
      if (!res.success) {
        toast.error(res.error ?? 'Salvataggio fallito')
        return
      }
      toast.success('Profilo aggiornato')
      router.refresh()
    })
  }

  const handleDiscard = () => {
    setForm(savedForm)
  }

  const handlePasswordChange = () => {
    setPasswordPending(true)
    void changeMyPassword({ password, confirmPassword }).then((res) => {
      setPasswordPending(false)
      if (!res.success) {
        toast.error(res.error ?? 'Aggiornamento password fallito')
        return
      }
      toast.success('Password aggiornata')
      setPassword('')
      setConfirmPassword('')
    })
  }

  const activeMeta = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0]

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profilo</CardTitle>
              <CardDescription>Informazioni personali del tuo account.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  disabled={pending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username ?? ''}
                  onChange={(e) => updateField('username', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email ?? ''} disabled className="bg-slate-50" />
                <p className="text-xs text-slate-500">
                  L&apos;email è gestita dall&apos;amministratore e non può essere modificata qui.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      case 'business':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Dati azienda</CardTitle>
              <CardDescription>Informazioni utili per documenti e report del tool.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="ragione_sociale">Ragione sociale</Label>
                <Input
                  id="ragione_sociale"
                  value={form.ragione_sociale ?? ''}
                  onChange={(e) => updateField('ragione_sociale', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cf_partita_iva">CF / Partita IVA</Label>
                <Input
                  id="cf_partita_iva"
                  value={form.cf_partita_iva ?? ''}
                  onChange={(e) => updateField('cf_partita_iva', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settore_merceologico">Settore merceologico</Label>
                <Input
                  id="settore_merceologico"
                  value={form.settore_merceologico ?? ''}
                  onChange={(e) => updateField('settore_merceologico', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attivita">Attività</Label>
                <Input
                  id="attivita"
                  value={form.attivita ?? ''}
                  onChange={(e) => updateField('attivita', e.target.value)}
                  disabled={pending}
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
              <CardDescription>Recapiti per comunicazioni e riferimenti.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="recapito_telefonico">Telefono</Label>
                <Input
                  id="recapito_telefonico"
                  value={form.recapito_telefonico ?? ''}
                  onChange={(e) => updateField('recapito_telefonico', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sito_internet">Sito web</Label>
                <Input
                  id="sito_internet"
                  value={form.sito_internet ?? ''}
                  onChange={(e) => updateField('sito_internet', e.target.value)}
                  placeholder="https://"
                  disabled={pending}
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
              <CardDescription>Sede e dati di localizzazione.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="indirizzo">Indirizzo</Label>
                <Input
                  id="indirizzo"
                  value={form.indirizzo ?? ''}
                  onChange={(e) => updateField('indirizzo', e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cap">CAP</Label>
                  <Input
                    id="cap"
                    value={form.cap ?? ''}
                    onChange={(e) => updateField('cap', e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="citta">Città</Label>
                  <Input
                    id="citta"
                    value={form.citta ?? ''}
                    onChange={(e) => updateField('citta', e.target.value)}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    value={form.provincia ?? ''}
                    onChange={(e) => updateField('provincia', e.target.value)}
                    disabled={pending}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      case 'security':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Sicurezza</CardTitle>
              <CardDescription>Aggiorna la password del tuo account.</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nuova password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  disabled={passwordPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  disabled={passwordPending}
                />
              </div>
              <Button
                type="button"
                onClick={handlePasswordChange}
                disabled={passwordPending || password.length < 8 || password !== confirmPassword}
              >
                {passwordPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aggiornamento...
                  </>
                ) : (
                  'Aggiorna password'
                )}
              </Button>
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
          className={cn('lg:w-56 lg:shrink-0', mobileShowContent ? 'hidden lg:block' : 'block')}
        >
          <p className="mb-3 hidden text-xs font-medium uppercase tracking-wide text-slate-400 lg:block">
            Sezioni
          </p>
          <ul className="space-y-1">
            {SECTIONS.map((section) => {
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

        <div className={cn('min-w-0 flex-1', !mobileShowContent ? 'hidden lg:block' : 'block')}>
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
    </div>
  )
}
