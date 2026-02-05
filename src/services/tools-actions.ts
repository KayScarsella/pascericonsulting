'use server' // 1. FONDAMENTALE: Dice a Next.js che questo codice gira SOLO sul server

import { createClient } from "@/src/lib/supabase/server"; // Importiamo la connessione che abbiamo appena creato
import { revalidatePath } from "next/cache";

/**
 * Funzione per creare un nuovo Tool nel database.
 * Questa funzione può essere chiamata direttamente da un <form> nel frontend!
 */
export async function createTool(formData: FormData) {
  // 2. Ci connettiamo al DB
  const supabase = await createClient();

  // 3. Estraiamo i dati dal form HTML
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  
  // Per ora mettiamo una config fissa, poi la renderemo dinamica
  const config = { type: "map", default_layer: "forest" }; 

  // 4. Scriviamo nel Database
  const { error } = await supabase
    .from("tools")
    .insert({ 
      title, 
      description, 
      config_schema: config 
    });

  if (error) {
    console.error("Errore salvataggio:", error);
    throw new Error("Impossibile creare il tool");
  }

  // 5. AGGIORNAMENTO MAGICO
  // Questa riga dice a Next.js: "I dati della home page sono cambiati,
  // rigenerala subito per tutti gli utenti!"
  revalidatePath("/");
}

/**
 * Funzione per eliminare un Tool
 */
export async function deleteTool(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tools")
    .delete()
    .eq("id", id);

  if (error) throw new Error("Errore eliminazione");

  revalidatePath("/");
}