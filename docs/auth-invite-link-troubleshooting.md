# Troubleshooting link invito / reinvio

## Durata link

Configurata in **Supabase → Authentication → Email → Email OTP expiration** (secondi). Vale per `invite`, `magiclink` e recovery. Vedi anche `AUTH_EMAIL_OTP_EXPIRATION_HINT` in `src/lib/constants.ts`.

I link `https://<project>.supabase.co/auth/v1/verify?token=...` sono **monouosi**: un secondo accesso (o un prefetch email) restituisce `One-time token not found`.

## Link “porta” multiuso (sempre Resend)

Tutti gli inviti onboarding (nuovi utenti, pending, reinvio) usano **solo Resend**. Non si invia più la mail di invito nativa Supabase (`inviteUserByEmail`).

Richiesto sul server: `RESEND_API_KEY`, `FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Le email puntano a:

`/auth/onboarding-entry?t=<ticket>`

- Il ticket è **riutilizzabile** per `ONBOARDING_PORTAL_TICKET_TTL_DAYS` (default 7 giorni) finché l’onboarding non è completato.
- Gli scanner email possono aprire questa pagina senza consumare la sessione.
- L’utente deve premere **«Continua e accedi»**: solo allora il server genera un magic link Supabase monouso.

Tabella: `public.onboarding_invite_tickets` (solo service role).

| Colonna | Significato |
|---------|-------------|
| `user_id` | Utente invitato |
| `tool_id` | Tool dell’invito |
| `token_hash` | Associa il link in email (non salviamo il token in chiaro) |
| `portal_views_count` | Aperture pagina porta (multiuso; può includere scanner) |
| `magiclink_mints_count` | Click «Continua e accedi» (magic link monouso generato) |
| `expires_at` | Scadenza ticket (default 7 giorni) |

Se `portal_views_count` è molto maggiore di `magiclink_mints_count`, è probabile prefetch email.

Senza Resend configurato, l’azione «Invita utente» **fallisce** con messaggio esplicito (nessun fallback Supabase).

Usare **solo l’ultima mail** ricevuta.

## Log Supabase Auth (esempio)

Pattern tipico su `/verify`:

1. Richiesta con esito `303` (redirect verso app)
2. Subito dopo: `One-time token not found` / `403: Email link is invalid or has expired`
3. A volte `405` (es. probe HEAD da scanner)

IP non italiani / AWS / Google spesso indicano **scanner email**, non l’utente.

## Redirect URL

`redirect_to` deve essere allowlistato, es. `https://pascericonsulting.vercel.app/auth/callback`.

## Callback app

- [`src/app/(auth)/auth/callback/page.tsx`](../src/app/(auth)/auth/callback/page.tsx): `code` (PKCE), hash tokens, `verifyOtp` per `invite` / `magiclink` / `signup` / `email`
- [`src/app/(auth)/callback/route.ts`](../src/app/(auth)/callback/route.ts): scambio PKCE server-side

In caso di errore, la pagina [`/auth/invito-non-valido`](../src/app/(auth)/auth/invito-non-valido/page.tsx) mostra un riepilogo tecnico dell’ultimo tentativo (sessionStorage, senza segreti).

## Mitigazioni per utenti

- Copiare il link dalla mail più recente invece del pulsante (Gmail Safe Redirect).
- Cliccare entro pochi minuti dalla ricezione.
- Chiedere un nuovo reinvio dall’admin se necessario.
