// types/questions.ts
import { Database } from "./supabase";

// Alias veloci per le righe del DB
export type QuestionRow = Database['public']['Tables']['questions']['Row'];
export type UserResponseRow = Database['public']['Tables']['user_responses']['Row'];

export type AnswerValue =
  | string
  | number
  | null
  | Record<string, unknown>[]
  | Record<string, unknown>;

// Tipi di risposta supportati
export type QuestionType =
  | 'text'
  | 'number'
  | 'select'
  | 'async_select'
  | 'repeater'
  | 'supplier_manager'
  | 'date_range'
  | 'year_values';

// Interfaccia per il JSON "config"
export interface QuestionConfig {
  placeholder?: string;
  // Per select semplice o multi (is_multi)
  options?: { label: string; value: string }[];
  is_multi?: boolean;
  multiline?: boolean;
  export_key?: string;
  // Per async_select (caricamento da DB)
  source_table?: keyof Database['public']['Tables']; // Limita alle tabelle esistenti
  source_label_col?: string;
  source_value_col?: string;
  source_extra_cols?: string[];
  // Configurazione file
  file_upload_enabled?: boolean;
  optional?: boolean; // Indica se la domanda è facoltativa
}

/** Config JSON for `year_values` questions (`config.fields` in DB) */
export type YearValuesQuestionConfig = QuestionConfig & {
  fields?: { key: string; label: string }[];
};

// Tipo esteso che forza "config" ad essere QuestionConfig invece di Json
export interface QuestionWithConfig extends Omit<QuestionRow, 'config'> {
  config: QuestionConfig;
}

export type LogicCondition = {
  question_id: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'is_not_empty'; // uguale, diverso, maggiore, minore, presente
  value?: string | number | boolean; // optional for is_not_empty
  extra_field?: string;
}

export type SectionLogicRule = {
  conditions: LogicCondition[]; // Array di condizioni (TUTTE devono essere vere)
  action: 'stop_section';       // Per ora gestiamo solo lo stop
  message?: string;             // Testo dell'Alert (opzionale: per variant "silent")
  variant?: 'info' | 'warning' | 'success' | 'silent'; // "silent" = blocca senza mostrare banner
}