# Database Schema Reference

Questo file documenta funzioni, trigger e regole del database Supabase per aiutare gli agenti AI e gli sviluppatori.

## Trigger

### `delete_orphaned_parent_session` (AFTER DELETE su `assessment_sessions`)

Quando si elimina una riga figlia (`parent_session_id IS NOT NULL`):

1. Verifica se il padre è un nodo radice (`parent_session_id IS NULL`)
2. Conta i figli rimanenti del padre
3. Se `count = 0`, elimina anche il padre

**Implicazione:** Eliminando l'unica analisi_finale (figlio), il trigger elimina automaticamente la verifica (padre). Il codice applicativo deve pre-pulpare i file storage del padre prima della delete.

## Automazioni (Edge Functions + schedule)

### Reminder email scadenza (`expiry-reminders`)

Invia email automatiche quando una sessione completata ha `assessment_sessions.metadata.expiry_date` uguale a **\(current_date + 7\)** (formato `YYYY-MM-DD`).

- **Outbox/log**: `public.email_reminders`
  - **Idempotenza**: vincolo unico su `(user_id, session_id, reminder_type, target_date)` per evitare doppi invii anche se la schedule gira più volte.
  - **Campi principali**: `sent_at`, `provider_id`, `error`.

File funzione: `supabase/functions/expiry-reminders/index.ts` (usa Resend via API HTTP).

## Tabelle principali

- `assessment_sessions`: sessioni di valutazione (verifica → analisi_finale)
- `user_responses`: risposte alle domande; `file_path` punta a `user-uploads` bucket
- `mitigation_history`: storico mitigazioni; `file_path` per allegati mitigazione

## Cascade / FK

- `user_responses.session_id` → `assessment_sessions.id` (ON DELETE CASCADE)
- `mitigation_history.session_id` → `assessment_sessions.id` (ON DELETE CASCADE)
- Storage: **nessun cascade** — i file vanno rimossi esplicitamente prima della delete

## Come aggiornare questo file

| conname                            | conrelid            | confrelid           | pg_get_constraintdef                                                                 |
| ---------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| user_responses_session_id_fkey     | user_responses      | assessment_sessions | FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE        |
| assessment_sessions_parent_fk      | assessment_sessions | assessment_sessions | FOREIGN KEY (parent_session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE |
| mitigation_history_session_id_fkey | mitigation_history  | assessment_sessions | FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE        |