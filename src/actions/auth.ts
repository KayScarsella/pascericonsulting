// auth.ts
'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { siteUrlForAuth } from "@/lib/site-url-for-auth"
import { createServiceRoleClient } from "@/utils/supabase/admin"

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

function isSamePasswordUpdateError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("different from the old password") ||
    m.includes("different from your old password") ||
    (m.includes("should be different") && m.includes("old password")) ||
    m.includes("same as your current password") ||
    m.includes("same as the current password")
  )
}

async function setMustResetPasswordByEmail(email: string, mustReset: boolean) {
  try {
    const adminClient = createServiceRoleClient()
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (profileError || !profile?.id) return

    await adminClient
      .from("profiles")
      .update({
        must_reset_password: mustReset,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)
  } catch {
    // Do not fail password-reset flow if service role is unavailable.
  }
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) return { error: "Campi obbligatori" }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // CORREZIONE: Restituisci solo la stringa message, non l'oggetto error intero
    return { error: error.message }
  }

  const userId = data.user?.id
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("must_reset_password")
      .eq("id", userId)
      .maybeSingle()

    if (profile?.must_reset_password) {
      await supabase.auth.signOut()
      return {
        error:
          "Per motivi di sicurezza devi prima completare il reset password dal link ricevuto via email.",
      }
    }
  }

  // Se arrivi qui, il cookie è impostato. Ora reindirizziamo.
  redirect("/")
}

export async function signupAction() {
  // Registrazione solo su invito: usa invite dal pannello admin + SUPABASE_SERVICE_ROLE_KEY,
  // e in Supabase Dashboard disattiva "Allow new users to sign up".
  return {
    error:
      "La registrazione libera non è attiva. Ricevi un invito da un amministratore del tool e usa il link nell’email.",
  }
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return { error: "Inserisci un'email valida." }
  }

  const site = siteUrlForAuth()
  if (!site) {
    return { error: "Configura NEXT_PUBLIC_SITE_URL per abilitare il recupero password." }
  }

  const supabase = await createSupabaseServerClient()
  await setMustResetPasswordByEmail(email, true)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Dedicated route so PKCE `code` flow always continues to reset-password (not onboarding).
    redirectTo: `${site}/auth/recovery-callback`,
  })

  // Anti-enumeration: do not reveal whether the email exists.
  if (error) {
    console.warn("resetPasswordForEmail warning:", error.message)
  }

  return {
    success: true,
    message: "Se l'email e' registrata, riceverai un link per impostare una nuova password.",
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

export async function completeOnboardingAction(formData: FormData) {
  const fullName = String(formData.get("fullName") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")
  const username = String(formData.get("username") ?? "").trim()
  const ragioneSociale = String(formData.get("ragioneSociale") ?? "").trim()
  const cfPartitaIva = String(formData.get("cfPartitaIva") ?? "").trim()
  const indirizzo = String(formData.get("indirizzo") ?? "").trim()
  const cap = String(formData.get("cap") ?? "").trim()
  const citta = String(formData.get("citta") ?? "").trim()
  const provincia = String(formData.get("provincia") ?? "").trim()
  const recapitoTelefonico = String(formData.get("recapitoTelefonico") ?? "").trim()
  const sitoInternet = String(formData.get("sitoInternet") ?? "").trim()
  const settoreMerceologico = String(formData.get("settoreMerceologico") ?? "").trim()
  const attivita = String(formData.get("attivita") ?? "").trim()

  if (!fullName) return { error: "Inserisci il nome." }
  if (fullName.length > 120) return { error: "Il nome e' troppo lungo." }
  if (password.length < 8) return { error: "La password deve essere di almeno 8 caratteri." }
  if (password !== confirmPassword) return { error: "Le password non coincidono." }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: "Sessione non valida. Effettua di nuovo l'accesso dal link invito." }
  }

  const { error: updateUserError } = await supabase.auth.updateUser({ password })
  if (updateUserError) {
    const isSamePassword = updateUserError.message
      .toLowerCase()
      .includes("different from the old password")
    if (!isSamePassword) {
      return { error: updateUserError.message }
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      email: user.email ?? null,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      username: username || null,
      ragione_sociale: ragioneSociale || null,
      cf_partita_iva: cfPartitaIva || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      citta: citta || null,
      provincia: provincia || null,
      recapito_telefonico: recapitoTelefonico || null,
      sito_internet: sitoInternet || null,
      settore_merceologico: settoreMerceologico || null,
      attivita: attivita || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )

  if (profileError) {
    return { error: profileError.message }
  }

  redirect("/landingPage")
}

export async function completePasswordResetAction(formData: FormData) {
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password.length < 8) {
    return { error: "La password deve essere di almeno 8 caratteri." }
  }
  if (password !== confirmPassword) {
    return { error: "Le password non coincidono." }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    await supabase.auth.signOut()
    return { error: "Sessione reset non valida o scaduta. Richiedi una nuova email." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_reset_password")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.must_reset_password) {
    await supabase.auth.signOut()
    return {
      error: "Questa sessione di reset non e' valida. Richiedi un nuovo link di recupero password.",
    }
  }

  const { error: updateUserError } = await supabase.auth.updateUser({ password })
  if (updateUserError) {
    if (isSamePasswordUpdateError(updateUserError.message)) {
      return {
        error:
          "La nuova password deve essere diversa dalla precedente. Scegli un'altra password e riprova.",
      }
    }
    await supabase.auth.signOut()
    return { error: "Impossibile completare il reset. Richiedi un nuovo link e riprova." }
  }

  await supabase
    .from("profiles")
    .update({
      must_reset_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  // Security: after password reset, clear the temporary recovery session so
  // the user must authenticate again with the new password.
  await supabase.auth.signOut()
  redirect("/login?reset=success")
}