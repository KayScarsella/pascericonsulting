// src/lib/constants.ts

/** Archivio analisi WordPress (selezione prodotto EUDR / Timber Regulation). */
export const WP_ANALYSIS_ARCHIVE_URL = "https://www.pascericonsulting.it/wp-content/";

export const TIMBER_TOOL_ID = "e963a607-477c-4afe-bf43-7c9f512771e9";
export const EUDR_TOOL_ID = "69d3d115-acc1-49f3-8d39-a003df7145be";
export const CLOUD_FSC_TOOL_ID = "50cd9969-0300-4d41-b807-1a88088d07e1";

/**
 * Validità del link “porta” nelle email di invito (/auth/onboarding-entry).
 * Riutilizzabile fino a scadenza o completamento onboarding; il magic link Supabase
 * monouso viene generato solo al click su «Continua».
 */
export const ONBOARDING_PORTAL_TICKET_TTL_DAYS = 7;

/** Admin hint: portal ticket TTL vs magic link after «Continua e accedi». */
export const AUTH_EMAIL_OTP_EXPIRATION_HINT =
  `Due scadenze distinte: (1) link porta in email Resend → /auth/onboarding-entry, valido ${ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni e riapribile; (2) magic link Supabase generato solo al click «Continua e accedi», monouso, scadenza da Authentication → Email → Email OTP expiration (spesso 24 ore). Se il magic link scade, l’utente può ripremere «Continua» sulla stessa pagina porta finché non è scaduto il ticket. Reinvio admin solo se il ticket è scaduto o assente.`;

/** Testo guida per la pagina Master → Supervisione email inviti. */
export const ONBOARDING_INVITE_SUPERVISION_GUIDE =
  `Il link nell’email (porta) resta utilizzabile per ${ONBOARDING_PORTAL_TICKET_TTL_DAYS} giorni. La colonna «Stato invito» indica se serve un reinvio. «Email Resend» mostra consegna/apertura della mail; «Link porta» le visite alla pagina invito; «Continua e accedi» i tentativi di accesso reale.`;

/** Messaggio se manca Resend per inviti tool. */
export const INVITE_REQUIRES_RESEND_HINT =
  "Configura RESEND_API_KEY e FROM_EMAIL sul server: tutti gli inviti onboarding passano da email Resend (non dalla mail Supabase).";

/** Limite reinvii onboarding in un’unica azione bulk (allineato a `resendPendingOnboardingInvitesBulkAction`). */
export const PENDING_INVITE_BULK_RESEND_MAX = 20;
