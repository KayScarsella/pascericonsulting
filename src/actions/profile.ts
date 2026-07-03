'use server'

import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/supabase'

export type MyProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  | 'id'
  | 'full_name'
  | 'username'
  | 'email'
  | 'ragione_sociale'
  | 'cf_partita_iva'
  | 'indirizzo'
  | 'cap'
  | 'citta'
  | 'provincia'
  | 'recapito_telefonico'
  | 'sito_internet'
  | 'settore_merceologico'
  | 'attivita'
>

export type MyProfileInput = Omit<MyProfile, 'id' | 'email'>

export async function getMyProfile(): Promise<{
  success: boolean
  data?: MyProfile
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, username, email, ragione_sociale, cf_partita_iva, indirizzo, cap, citta, provincia, recapito_telefonico, sito_internet, settore_merceologico, attivita'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Profilo non trovato' }

  return { success: true, data: data as MyProfile }
}

export async function updateMyProfile(
  input: MyProfileInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  const fullName = input.full_name?.trim() ?? ''
  if (!fullName) {
    return { success: false, error: 'Il nome è obbligatorio' }
  }
  if (fullName.length > 120) {
    return { success: false, error: 'Il nome è troppo lungo' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      username: input.username?.trim() || null,
      ragione_sociale: input.ragione_sociale?.trim() || null,
      cf_partita_iva: input.cf_partita_iva?.trim() || null,
      indirizzo: input.indirizzo?.trim() || null,
      cap: input.cap?.trim() || null,
      citta: input.citta?.trim() || null,
      provincia: input.provincia?.trim() || null,
      recapito_telefonico: input.recapito_telefonico?.trim() || null,
      sito_internet: input.sito_internet?.trim() || null,
      settore_merceologico: input.settore_merceologico?.trim() || null,
      attivita: input.attivita?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function changeMyPassword(input: {
  password: string
  confirmPassword: string
}): Promise<{ success: boolean; error?: string }> {
  const password = input.password.trim()
  const confirmPassword = input.confirmPassword.trim()

  if (password.length < 8) {
    return { success: false, error: 'La password deve essere di almeno 8 caratteri' }
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'Le password non coincidono' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { success: false, error: 'Utente non autenticato' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('same') || msg.includes('different')) {
      return {
        success: false,
        error: 'La nuova password deve essere diversa dalla precedente',
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}
