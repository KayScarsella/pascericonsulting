'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { DataManagementTable, type DataManagementColumn } from '@/components/admin/DataManagementTable'
import type { EmailSupervisionRow } from '@/actions/email-supervision'
import { resendPendingOnboardingInviteAction } from '@/actions/invite'
import {
  INVITE_REQUIRES_RESEND_HINT,
  ONBOARDING_INVITE_SUPERVISION_GUIDE,
  ONBOARDING_PORTAL_TICKET_TTL_DAYS,
} from '@/lib/constants'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Mail, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function formatDt(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function resendBadgeVariant(
  event: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!event) return 'outline'
  if (event === 'delivered' || event === 'opened' || event === 'clicked') return 'default'
  if (event === 'bounced' || event === 'failed' || event === 'complained') return 'destructive'
  return 'secondary'
}

function inviteStatusBadgeVariant(
  row: EmailSupervisionRow
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (row.needsInviteResend) return 'destructive'
  if (row.inviteAccessStatus === 'onboarding_completed') return 'secondary'
  if (
    row.inviteAccessStatus === 'portal_opened_awaiting_login' ||
    row.inviteAccessStatus === 'login_attempted_pending'
  ) {
    return 'outline'
  }
  return 'default'
}

export function EmailSupervisionSection({
  data,
  page,
  totalPages,
  basePath,
  resendConfigured,
  toolId,
  needsResendTotalCount,
  totalUserCount,
}: {
  data: EmailSupervisionRow[]
  page: number
  totalPages: number
  basePath: string
  resendConfigured: boolean
  toolId: string
  /** Utenti che richiedono reinvio su tutto il tool (o sui risultati di ricerca). */
  needsResendTotalCount: number
  totalUserCount: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const searchValue = searchParams.get('q') ?? ''
  const searchActive = Boolean(searchValue.trim())
  const needsResendOnPage = data.filter((r) => r.needsInviteResend).length
  const setSearch = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.trim()) params.set('q', next.trim())
      else params.delete('q')
      params.delete('page')
      router.push(`${basePath}?${params.toString()}`)
    },
    [basePath, router, searchParams]
  )

  const onRefresh = () => {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleResend = async (row: EmailSupervisionRow) => {
    if (row.onboardingCompleted) {
      toast.error('Onboarding già completato: non serve reinvio.')
      return
    }
    setResendingId(row.userId)
    const res = await resendPendingOnboardingInviteAction(toolId, row.userId)
    setResendingId(null)
    if (!res.success) {
      toast.error(res.error ?? 'Reinvio non riuscito')
      return
    }
    toast.success(res.message ?? 'Nuovo invito inviato.', {
      description:
        'L’utente deve usare l’ultima email ricevuta e premere «Continua e accedi». I link delle email precedenti non funzionano più.',
    })
    router.refresh()
  }

  const columns: DataManagementColumn<EmailSupervisionRow>[] = [
    {
      id: 'user',
      header: 'Utente',
      render: (row) => (
        <div className="min-w-[140px]">
          <div className="font-medium text-slate-900">{row.fullName || '—'}</div>
          <div className="text-xs text-slate-500">{row.email || '—'}</div>
        </div>
      ),
    },
    {
      id: 'invite-status',
      header: 'Stato invito',
      render: (row) => (
        <div className="max-w-[220px] space-y-1 text-sm">
          <Badge variant={inviteStatusBadgeVariant(row)}>{row.inviteAccessLabel}</Badge>
          <p className="text-xs leading-snug text-slate-600" title={row.inviteAccessHint}>
            {row.inviteAccessHint}
          </p>
        </div>
      ),
    },
    {
      id: 'onboarding',
      header: 'Onboarding',
      render: (row) =>
        row.onboardingCompleted ? (
          <Badge variant="secondary">Completato</Badge>
        ) : (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
            In sospeso
          </Badge>
        ),
    },
    {
      id: 'resend',
      header: 'Email Resend',
      render: (row) => (
        <div className="space-y-1 text-sm">
          <Badge variant={resendBadgeVariant(row.resendLastEvent)}>{row.resendLastEventLabel}</Badge>
          <div className="text-xs text-slate-500">{formatDt(row.resendSentAt)}</div>
        </div>
      ),
    },
    {
      id: 'portal',
      header: 'Link porta',
      render: (row) => (
        <div className="text-sm">
          <span className="font-semibold tabular-nums">{row.portalViewsCount}</span>
          <span className="text-slate-500"> aperture</span>
          <div className="text-xs text-slate-500">ultima: {formatDt(row.lastPortalViewAt)}</div>
        </div>
      ),
    },
    {
      id: 'magic',
      header: '«Continua e accedi»',
      render: (row) => (
        <div className="text-sm">
          <span className="font-semibold tabular-nums">{row.magiclinkMintsCount}</span>
          <span className="text-slate-500"> click</span>
          <div className="text-xs text-slate-500">ultimo: {formatDt(row.lastMagiclinkMintAt)}</div>
        </div>
      ),
    },
    {
      id: 'ticket',
      header: 'Scadenza ticket',
      render: (row) =>
        row.ticketId ? (
          <div className="text-xs text-slate-600">
            <div>creato {formatDt(row.ticketCreatedAt)}</div>
            <div>scade {formatDt(row.ticketExpiresAt)}</div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Mail className="h-5 w-5 text-[#967635]" aria-hidden />
            Supervisione email inviti
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{ONBOARDING_INVITE_SUPERVISION_GUIDE}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
          Aggiorna
        </Button>
      </div>

      {!resendConfigured && (
        <Alert variant="destructive">
          <AlertTitle>Resend non configurato</AlertTitle>
          <AlertDescription>{INVITE_REQUIRES_RESEND_HINT}</AlertDescription>
        </Alert>
      )}

      {needsResendTotalCount > 0 && (
        <Alert variant="destructive">
          <AlertTitle>
            {needsResendTotalCount === 1
              ? '1 utente richiede un nuovo invito'
              : `${needsResendTotalCount} utenti richiedono un nuovo invito`}
            {totalUserCount > 0 && (
              <span className="font-normal text-rose-800/90">
                {' '}
                (su {totalUserCount}{' '}
                {searchActive ? 'risultati di ricerca' : 'utenti con accesso al tool'})
              </span>
            )}
          </AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>
              Conteggio su{' '}
              {searchActive ? 'tutti i risultati della ricerca' : 'tutti gli utenti del tool'}, non solo
              questa pagina della tabella.
              {needsResendOnPage > 0 && needsResendOnPage < needsResendTotalCount && (
                <>
                  {' '}
                  In questa pagina: {needsResendOnPage}.
                </>
              )}
            </p>
            <p>
              Link porta scaduto (oltre {ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni), assente o email non
              consegnata. Usa «Reinvia» sulla riga o Gestione utenti. Il magic link Supabase (~24 h) si
              rigenera con «Continua e accedi» finché il ticket porta è valido.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertTitle>Perché 7 giorni e non 24 ore?</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            <strong>Link in email (porta)</strong>: valido{' '}
            <strong>{ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni</strong>, configurato in codice (
            <code className="text-xs">ONBOARDING_PORTAL_TICKET_TTL_DAYS</code>). Riapribile; apre solo la
            pagina invito, non fa ancora login.
          </p>
          <p>
            <strong>Magic link Supabase</strong>: creato solo al click «Continua e accedi», monouso, scade
            secondo <em>Authentication → Email → Email OTP expiration</em> in Supabase (spesso{' '}
            <strong>24 ore</strong>). Se scade, l’utente torna alla stessa pagina porta e ripreme il pulsante
            — non serve un reinvio admin se il ticket non è scaduto.
          </p>
          <p>
            <strong>Email Resend</strong>: stato consegna/apertura della mail (pixel «aperta» può essere
            l’antivirus).
          </p>
          <p>
            <strong>Link porta</strong>: caricamenti di{' '}
            <code className="text-xs">/auth/onboarding-entry</code> (anche scanner).
          </p>
          <p>
            <strong>Continua e accedi</strong>: tentativi di accesso reale (magic link generato).
          </p>
        </AlertDescription>
      </Alert>

      <DataManagementTable
        title="Utenti e inviti"
        data={data}
        columns={columns}
        getRowId={(row) => row.userId}
        searchPlaceholder="Cerca per email o nome..."
        search={{ value: searchValue, onChange: setSearch }}
        searchMode="server"
        emptyMessage="Nessun utente trovato per questo tool."
        pagination={{
          page,
          totalPages,
          onPageChange: (p) => {
            const params = new URLSearchParams(searchParams.toString())
            if (p > 1) params.set('page', String(p))
            else params.delete('page')
            router.push(`${basePath}?${params.toString()}`)
          },
        }}
        renderRowActions={(row) =>
          !row.onboardingCompleted ? (
            <Button
              type="button"
              variant={row.needsInviteResend ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              disabled={resendingId === row.userId || !resendConfigured}
              title={
                row.needsInviteResend
                  ? 'Invia nuovo link: i precedenti non funzionano più'
                  : 'Reinvia solo se l’utente non trova la mail o serve un link aggiornato'
              }
              onClick={() => void handleResend(row)}
            >
              {resendingId === row.userId ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mail className="h-4 w-4" aria-hidden />
              )}
              <span className="ml-1.5 hidden sm:inline">Reinvia</span>
            </Button>
          ) : null
        }
      />
    </div>
  )
}
