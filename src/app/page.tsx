import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import LogoutButton from "@/components/logout-button";

// Assicurati che ci sia "export default" e che sia "async"
export default async function Home() {
  // Avvolgiamo in try/catch per evitare che un errore di DB rompa la pagina
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("Errore Supabase:", error);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Pasceri Consulting</h1>
        <p className="text-muted-foreground">Portale Gestionale</p>
      </div>

      {user ? (
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-green-100 text-green-800 rounded border border-green-200">
            ✅ Connesso come: <strong>{user.email}</strong>
          </div>
          <Button asChild>
            <Link href="/dashboard">Vai alla Dashboard</Link>
          </Button>
          <LogoutButton />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="p-4 bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
            ⚠️ Nessun utente loggato
          </div>
          <div className="flex gap-4">
            <Button asChild variant="default" size="lg">
              <Link href="/login">Accedi</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/signup">Registrati</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}