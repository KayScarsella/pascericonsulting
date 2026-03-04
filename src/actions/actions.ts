'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { revalidatePath } from "next/cache"

export async function deleteRecords(ids: string[]) {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  try {
    const { error } = await supabase
      .from('assessment_sessions')
      .delete()
      .in('id', ids);

    if (error) throw error;

    revalidatePath('/search');
    return { success: true };
  } catch (error: unknown) { // 🛠️ Sostituito any con unknown
    const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante l'eliminazione";
    return { success: false, error: errorMessage };
  }
}