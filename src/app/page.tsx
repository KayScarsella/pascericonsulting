import { createClient } from "@/src/lib/supabase/server";
import { createTool, deleteTool } from "@/src/services/tools-actions"; // Importiamo le nostre nuove azioni!

export default async function Home() {
  const supabase = await createClient();

  // 1. Leggiamo i Tools esistenti
  const { data: tools } = await supabase.from('tools').select('*');

  return (
    <main className="min-h-screen bg-gray-50 p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* TITOLO */}
        <h1 className="text-3xl font-bold text-gray-900">
          Amministrazione Tools 🛠️
        </h1>

        {/* FORM DI INSERIMENTO (Collega il Frontend al Backend!) */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Aggiungi Nuovo Tool</h2>
          
          {/* L'attributo 'action' qui chiama direttamente la funzione server! */}
          <form action={createTool} className="flex gap-4">
            <input 
              name="title" 
              placeholder="Nome del Tool (es. Analisi Acqua)" 
              className="border p-2 rounded flex-1"
              required 
            />
            <input 
              name="description" 
              placeholder="Descrizione breve..." 
              className="border p-2 rounded flex-1"
              required 
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
            >
              Crea +
            </button>
          </form>
        </div>

        {/* LISTA DEI TOOLS */}
        <div className="grid grid-cols-1 gap-4">
          {tools?.map((tool) => (
            <div key={tool.id} className="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-blue-900">{tool.title}</h3>
                <p className="text-gray-600">{tool.description}</p>
              </div>
              
              {/* FORM PER ELIMINARE (Un bottone che è un form nascosto) */}
              <form action={deleteTool.bind(null, tool.id)}>
                <button className="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-sm">
                  Elimina 🗑️
                </button>
              </form>
            </div>
          ))}
          
          {tools?.length === 0 && (
            <p className="text-center text-gray-500 py-10">Nessun tool presente. Creane uno sopra!</p>
          )}
        </div>

      </div>
    </main>
  );
}