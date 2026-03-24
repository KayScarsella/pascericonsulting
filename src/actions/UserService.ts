import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

type AppRole = Database['public']['Enums']['app_role'];

export class UserService {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  // =================================================================
  // 🔒 PRIVATE HELPERS (SICUREZZA)
  // =================================================================

  /**
   * 1. Ottiene l'ID dell'utente autenticato dalla sessione corrente.
   * Questo è il metodo sicuro: non accettiamo ID dall'esterno.
   */
  private async getAuthenticatedUserId(): Promise<string> {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    
    if (error || !user) {
      throw new Error('Utente non autenticato.');
    }
    return user.id;
  }

  /**
   * 2. Verifica che l'utente corrente sia ADMIN del tool specificato.
   * Se passa, non ritorna nulla. Se fallisce, lancia errore.
   */
  private async verifyToolAdmin(toolId: string): Promise<void> {
    const userId = await this.getAuthenticatedUserId();

    // Query diretta alla tabella di relazione
    const { data, error } = await this.supabase
      .from('tool_access')
      .select('role')
      .eq('user_id', userId) // Controllo su chi sta chiamando
      .eq('tool_id', toolId) // Controllo sul tool target
      .single();

    if (error || !data) {
      // Non diamo troppi dettagli per sicurezza, ma sappiamo che non ha accesso
      throw new Error('Permessi insufficienti o tool non trovato.');
    }

    if (data.role !== 'admin') {
      throw new Error('Accesso negato: Solo gli amministratori del tool possono eseguire questa azione.');
    }
  }

  // =================================================================
  // 🛠 PUBLIC METHODS (GESTIONALE ADMIN)
  // =================================================================

  /**
   * GET USERS (Per la Dashboard):
   * Restituisce la lista di tutti gli utenti di un tool e il loro ruolo.
   * Include i dati del profilo (nome, avatar) tramite join.
   */
  async getToolUsers(toolId: string) {
    // 1. Sicurezza: Verifico che chi chiama sia admin di QUESTO tool
    await this.verifyToolAdmin(toolId);

    // 2. Fetch dati
    const { data, error } = await this.supabase
      .from('tool_access')
      .select(`
        user_id,
        role,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url,
          email,
          ragione_sociale,
          cf_partita_iva,
          recapito_telefonico,
          indirizzo,
          citta,
          provincia,
          cap,
          settore_merceologico,
          attivita,
          sito_internet,
          username,
          onboarding_completed,
          invited_at,
          onboarding_completed_at
        )
      `)
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Errore caricamento utenti: ${error.message}`);
    return data;
  }

  /**
   * GET USERS PAGINATED:
   * Come getToolUsers ma con paginazione per ridurre carico DB e trasferimento.
   */
  async getToolUsersPaginated(
    toolId: string,
    page: number,
    limit: number
  ): Promise<{ data: Awaited<ReturnType<UserService["getToolUsers"]>>; totalCount: number }> {
    await this.verifyToolAdmin(toolId);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('tool_access')
      .select(
        `
        user_id,
        role,
        created_at,
        profiles (
          id,
          full_name,
          avatar_url,
          email,
          ragione_sociale,
          cf_partita_iva,
          recapito_telefonico,
          indirizzo,
          citta,
          provincia,
          cap,
          settore_merceologico,
          attivita,
          sito_internet,
          username,
          onboarding_completed,
          invited_at,
          onboarding_completed_at
        )
      `,
        { count: 'exact' }
      )
      .eq('tool_id', toolId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Errore caricamento utenti: ${error.message}`);
    return { data: data ?? [], totalCount: count ?? 0 };
  }

  /**
   * UPDATE ROLE:
   * L'admin modifica il ruolo di un altro utente nello stesso tool.
   */
  async updateUserRole(targetUserId: string, toolId: string, newRole: AppRole) {
    // 1. Sicurezza: Chi chiama è admin?
    await this.verifyToolAdmin(toolId);

    // 2. Impediamo all'admin di degradarsi da solo (opzionale ma consigliato)
    const currentUserId = await this.getAuthenticatedUserId();
    if (targetUserId === currentUserId && newRole !== 'admin') {
        throw new Error("Non puoi rimuovere i tuoi privilegi di admin. Chiedi a un altro admin.");
    }

    // 3. Update
    const { data, error } = await this.supabase
      .from('tool_access')
      .update({ role: newRole })
      .eq('user_id', targetUserId)
      .eq('tool_id', toolId)
      .select()
      .single();

    if (error) throw new Error(`Errore aggiornamento ruolo: ${error.message}`);
    return data;
  }

  /**
   * REMOVE USER:
   * Rimuove l'accesso di un utente al tool.
   */
  async removeUserFromTool(targetUserId: string, toolId: string) {
    // 1. Sicurezza
    await this.verifyToolAdmin(toolId);

    // 2. Cancellazione
    const { error } = await this.supabase
      .from('tool_access')
      .delete()
      .eq('user_id', targetUserId)
      .eq('tool_id', toolId);

    if (error) throw new Error(`Errore rimozione utente: ${error.message}`);
    return true;
  }
}