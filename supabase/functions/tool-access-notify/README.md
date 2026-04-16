## tool-access-notify (Edge Function)

Invia un’email transazionale (via **Resend**) quando un utente **già in onboarding completato** riceve accesso a un tool aggiuntivo o un aggiornamento di ruolo.

**Nota:** l’app Next.js prova prima l’invio **diretto** con `RESEND_API_KEY` e `FROM_EMAIL` sul server (Vercel / `.env.local`). Se sono impostate, **non serve** deployare questa funzione. La Edge Function resta utile se Resend è configurato solo su Supabase.

### Secrets richiesti (Supabase → Project Settings → Edge Functions → Secrets)

- `RESEND_API_KEY`
- `FROM_EMAIL` (es. `noreply@tuodominio.it`)

Supabase fornisce già:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Deploy

```bash
supabase functions deploy tool-access-notify
```

### Payload (POST JSON)

| Campo | Obbligo | Note |
|-------|---------|------|
| `email` | sì | Destinatario (minuscolo) |
| `userId` | sì | UUID profilo / auth |
| `toolId` | sì | UUID tool |
| `appPublicUrl` | sì | URL pubblico app senza slash finale (es. da `NEXT_PUBLIC_SITE_URL`) |
| `kind` | no | `access_granted` (default) o `role_updated` |
| `role` | no | `standard` / `premium` / `admin` (etichetta IT nel corpo email) |

### Autorizzazione

Chiamare con header `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (stesso schema di `expiry-reminders` da [`src/actions/email-reminders.ts`](../../../src/actions/email-reminders.ts)).
