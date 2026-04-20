// types/session.ts

export type SessionMetadata = {
    // ── DATI COMUNI ──
    nome_operazione?: string;
    
    // ── SPECIFICI PER "VERIFICA" (Sessione Base) ──
    nome_commerciale?: string;
    is_blocked?: boolean;       // True se un'eccezione (es. no EU) ha interrotto l'analisi
    block_reason?: string;      // Il messaggio dell'eccezione
    block_variant?: 'success' | 'warning' | 'error';
    step1_completed_at?: string;
    step1_signature?: string;
    step2_saved_at?: string;
    resume_step?: 'risk-analysis' | 'evaluation' | 'valutazione-finale';
    
    // ── SPECIFICI PER "ANALISI FINALE" (Sessioni Figlie) ──
    country?: string;           // ID del paese di raccolta
    specie?: string;            // ID della specie
    risk_score?: number;        // Punteggio massimo calcolato (es. 0.30)
    expiry_date?: string;       // Data di scadenza ISO (+12 mesi se accettabile)

    // ── PREFILL EUDR (materializzazione server-side) ──
    eudr_prefill_version?: number;
    eudr_prefill_materialized_at?: string;
    eudr_prefill_source_parent_session_id?: string;
    eudr_prefill_rows_written?: number;
    eudr_prefill_reason?: string;
}