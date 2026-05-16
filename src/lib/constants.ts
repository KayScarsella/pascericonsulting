// src/lib/constants.ts

/** Archivio analisi WordPress (selezione prodotto EUDR / Timber Regulation). */
export const WP_ANALYSIS_ARCHIVE_URL = "https://www.pascericonsulting.it/wp-content/";

export const TIMBER_TOOL_ID = "e963a607-477c-4afe-bf43-7c9f512771e9";
export const EUDR_TOOL_ID = "69d3d115-acc1-49f3-8d39-a003df7145be";
export const CLOUD_FSC_TOOL_ID = "50cd9969-0300-4d41-b807-1a88088d07e1";

/** Admin hint: invite/recovery link TTL is configured in Supabase (Authentication → Email → Email OTP expiration). */
export const AUTH_EMAIL_OTP_EXPIRATION_HINT =
  "La validità del link nelle email di invito e recupero password è impostata nel progetto Supabase (Authentication → Email → Email OTP expiration; es. 3600 s = 1 ora, 86400 s = 24 ore). Se gli utenti aprono tardi la mail, usa «Reinvia link onboarding» o aumenta quella scadenza consapevolmente dei rischi.";

/** Limite reinvii onboarding in un’unica azione bulk (allineato a `resendPendingOnboardingInvitesBulkAction`). */
export const PENDING_INVITE_BULK_RESEND_MAX = 20;