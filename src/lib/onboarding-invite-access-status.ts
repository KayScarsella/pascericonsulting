import { ONBOARDING_PORTAL_TICKET_TTL_DAYS } from '@/lib/constants'

export type InviteAccessStatusKey =
  | 'onboarding_completed'
  | 'resend_required_no_ticket'
  | 'resend_required_expired'
  | 'resend_required_email_failed'
  | 'portal_usable_not_opened'
  | 'portal_opened_awaiting_login'
  | 'login_attempted_pending'

export type InviteAccessStatus = {
  key: InviteAccessStatusKey
  label: string
  adminHint: string
  needsResend: boolean
}

const FAILED_RESEND_EVENTS = new Set(['bounced', 'failed', 'complained', 'suppressed'])

function isTicketExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() < Date.now()
}

/**
 * Stato operativo per admin: se l’utente può ancora usare l’invito corrente o serve un reinvio.
 * Il link porta in email dura ONBOARDING_PORTAL_TICKET_TTL_DAYS; il magic link Supabase
 * (dopo «Continua e accedi») segue Email OTP expiration in dashboard (spesso 24 ore).
 */
export function deriveOnboardingInviteAccessStatus(input: {
  onboardingCompleted: boolean
  ticketId: string | null
  ticketExpiresAt: string | null
  portalViewsCount: number
  magiclinkMintsCount: number
  resendLastEvent: string | null
}): InviteAccessStatus {
  if (input.onboardingCompleted) {
    return {
      key: 'onboarding_completed',
      label: 'Registrazione completata',
      adminHint: 'Nessun invito necessario.',
      needsResend: false,
    }
  }

  if (input.resendLastEvent && FAILED_RESEND_EVENTS.has(input.resendLastEvent)) {
    return {
      key: 'resend_required_email_failed',
      label: 'Email non recapitata',
      adminHint:
        'L’ultima email di invito non è stata consegnata (rimbalzo o errore). Verifica l’indirizzo e reinvia dall’icona email in Gestione utenti.',
      needsResend: true,
    }
  }

  if (!input.ticketId) {
    return {
      key: 'resend_required_no_ticket',
      label: 'Nessun link attivo',
      adminHint:
        'Non c’è un ticket invito valido per questo tool. Usa «Reinvia link» in Gestione utenti o invita di nuovo.',
      needsResend: true,
    }
  }

  if (isTicketExpired(input.ticketExpiresAt)) {
    return {
      key: 'resend_required_expired',
      label: 'Link porta scaduto',
      adminHint: `Il link /auth/onboarding-entry nell’email non è più valido (oltre ${ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni). Reinvia un nuovo invito: i link precedenti smettono di funzionare.`,
      needsResend: true,
    }
  }

  if (input.magiclinkMintsCount > 0) {
    return {
      key: 'login_attempted_pending',
      label: 'Accesso avviato, onboarding aperto',
      adminHint:
        'L’utente ha premuto «Continua e accedi» almeno una volta. Se non completa la registrazione, può riprovare dalla stessa email finché il link porta non scade; in caso di errore sul magic link (scadenza OTP Supabase, di solito ~24 h dal click) deve ripremere «Continua» dalla pagina porta, non serve un reinvio se il ticket è ancora valido.',
      needsResend: false,
    }
  }

  if (input.portalViewsCount > 0) {
    return {
      key: 'portal_opened_awaiting_login',
      label: 'Ha aperto il link, non ha ancora acceduto',
      adminHint:
        'La pagina invito è stata caricata (può essere anche un antivirus). L’utente deve premere «Continua e accedi» nell’ultima email. Reinvia solo se dice che il link non si apre o è scaduto.',
      needsResend: false,
    }
  }

  return {
    key: 'portal_usable_not_opened',
    label: 'Invito attivo, link non ancora aperto',
    adminHint: `Email con link porta valido per ${ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni. Se l’utente non trova la mail, controlla spam o reinvia.`,
    needsResend: false,
  }
}
