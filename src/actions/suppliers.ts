'use server'

import { createClient } from '@/utils/supabase/server'
// Assicurati che il percorso di importazione corrisponda a dove hai salvato supabase.ts
import { Tables, TablesInsert } from '@/types/supabase' 

// Tipo per i dati provenienti dal form (escludiamo id, user_id, tool_id e date generate dal DB)
export type SupplierFormData = Omit<TablesInsert<'suppliers'>, 'id' | 'tool_id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getSuppliers(toolId: string): Promise<Tables<'suppliers'>[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('tool_id', toolId)
    .order('name', { ascending: true })

  if (error) {
    console.error("Errore recupero fornitori:", error)
    return []
  }
  
  return data
}

export async function createSupplier(
  supplierData: SupplierFormData, 
  toolId: string
): Promise<{ success: boolean; data?: Tables<'suppliers'>; error?: string }> {
  const supabase = await createClient()
  
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, error: "Utente non autenticato" }
  }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      ...supplierData,
      tool_id: toolId,
      user_id: userData.user.id
    })
    .select()
    .single()

  if (error) {
    console.error("Errore creazione fornitore:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}