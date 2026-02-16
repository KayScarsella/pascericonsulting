import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation"; // 1. Importiamo redirect

export default async function Home() {
  // Creiamo il client
  const supabase = await createClient();

  // Controlliamo l'utente
  const { data: { user } } = await supabase.auth.getUser();

  // 2. SE L'UTENTE ESISTE -> Reindirizza subito alla Dashboard
  if (user) {
    redirect("/landingPage");
  }

  // 3. SE SIAMO QUI, L'UTENTE NON È LOGGATO
  // Mostriamo solo la schermata di benvenuto con Login/Registrati
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Pasceri Consulting</h1>
        <p className="text-muted-foreground">Portale Gestionale</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* Messaggio informativo opzionale */}
        {/* <div className="p-4 bg-slate-100 text-slate-800 rounded border border-slate-200">
             👋 Benvenuto, accedi per continuare.
        </div> */}

        <div className="flex gap-4">
          <Button asChild variant="default" size="lg">
            <Link href="/login">Accedi</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">Registrati</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}