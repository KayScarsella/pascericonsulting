// types/questions.ts
import { Database } from "./supabase";

// Alias veloci per le righe del DB
export type QuestionRow = Database['public']['Tables']['questions']['Row'];
export type UserResponseRow = Database['public']['Tables']['user_responses']['Row'];

// Tipi di risposta supportati
export type QuestionType = 'text' | 'number' | 'select' | 'async_select' | 'repeater';

// Interfaccia per il JSON "config"
export interface QuestionConfig {
  placeholder?: string;
  // Per select semplice
  options?: { label: string; value: string }[]; 
  // Per async_select (caricamento da DB)
  source_table?: keyof Database['public']['Tables']; // Limita alle tabelle esistenti
  source_label_col?: string;
  source_value_col?: string;
  // Configurazione file
  file_upload_enabled?: boolean;
}

// Tipo esteso che forza "config" ad essere QuestionConfig invece di Json
export interface QuestionWithConfig extends Omit<QuestionRow, 'config'> {
  config: QuestionConfig;
}

export type LogicCondition = {
  question_id: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt'; // uguale, diverso, maggiore, minore
  value: string | number | boolean;
  extra_field?: string;
}

export type SectionLogicRule = {
  conditions: LogicCondition[]; // Array di condizioni (TUTTE devono essere vere)
  action: 'stop_section';       // Per ora gestiamo solo lo stop
  message: string;              // Il testo dell'Alert personalizzato
  variant?: 'info' | 'warning' | 'success'; // Per colorare l'alert (opzionale)
}