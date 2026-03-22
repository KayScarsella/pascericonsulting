// auth.ts
'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// ... (tua funzione createSupabaseServerClient esistente va bene) ...
async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { }
        },
      },
    }
  )
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) return { error: "Campi obbligatori" }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // CORREZIONE: Restituisci solo la stringa message, non l'oggetto error intero
    return { error: error.message }
  }

  // Se arrivi qui, il cookie è impostato. Ora reindirizziamo.
  redirect("/")
}

export async function signupAction(_formData: FormData) {
  // Registrazione solo su invito: usa invite dal pannello admin + SUPABASE_SERVICE_ROLE_KEY,
  // e in Supabase Dashboard disattiva "Allow new users to sign up".
  return {
    error:
      "La registrazione libera non è attiva. Ricevi un invito da un amministratore del tool e usa il link nell’email.",
  }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()

  // 1. Cancella la sessione lato Supabase
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Errore durante il logout:", error)
  }

  // 2. Reindirizza alla pagina di login
  redirect("/login")
}