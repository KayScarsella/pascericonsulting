// types/session.ts

export type SessionMetadata = {
    // ── DATI COMUNI ──
    nome_operazione?: string;
    
    // ── SPECIFICI PER "VERIFICA" (Sessione Base) ──
    nome_commerciale?: string;
    is_blocked?: boolean;       // True se un'eccezione (es. no EU) ha interrotto l'analisi
    block_reason?: string;      // Il messaggio dell'eccezione
    block_variant?: 'success' | 'warning' | 'error';
    
    // ── SPECIFICI PER "ANALISI FINALE" (Sessioni Figlie) ──
    country?: string;           // ID del paese di raccolta
    specie?: string;            // ID della specie
    risk_score?: number;        // Punteggio massimo calcolato (es. 0.30)
    expiry_date?: string;       // Data di scadenza ISO (+12 mesi se accettabile)
}