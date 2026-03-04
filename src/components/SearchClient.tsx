'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Edit, ChevronLeft, ChevronRight, FileArchive, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { deleteRecords } from "@/actions/actions" 

// 🛠️ NUOVI TIPI AGGIUNTI PER EVITARE "ANY"
export type SessionMetadata = {
  nome_operazione?: string;
  operation_name?: string;
  [key: string]: unknown; // Permette altri campi extra salvati nel JSONB
}

export interface AssessmentSessionRow {
  id: string;
  created_at: string;
  status: string;
  parent_session_id: string | null;
  final_outcome: string | null;
  metadata: SessionMetadata | null;
}

interface SearchClientProps {
  data: AssessmentSessionRow[] // 🛠️ Sostituito any[] con il tipo esatto
  page: number
  totalPages: number
  isAdmin: boolean
}

export function SearchClient({ data, page, totalPages, isAdmin }: SearchClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Navigazione Paginazione
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    router.push(`/search?page=${newPage}`);
  };

  // Gestione Selezione Checkbox
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const toggleAll = () => {
    if (selectedIds.length === data.length) setSelectedIds([]);
    else setSelectedIds(data.map(item => item.id));
  };

  // Azioni Server (Eliminazione Sessioni)
  const handleDelete = async () => {
    if (selectedIds.length === 0) return toast.warning("Nessuna analisi selezionata");
    if (!confirm("Eliminare le analisi selezionate? L'azione è irreversibile e rimuoverà anche file e risposte associate.")) return;

    setIsProcessing(true);
    const res = await deleteRecords(selectedIds);
    setIsProcessing(false);

    if (res.success) {
      toast.success("Analisi eliminate con successo!");
      setSelectedIds([]);
    } else {
      toast.error("Errore durante l'eliminazione: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Barra di Ricerca Visiva */}
      <div className="flex gap-2 mb-8">
        <Input placeholder="Cerca nello storico analisi..." className="h-12 text-lg shadow-sm" />
        <Button className="h-12 px-8 bg-[#967635] hover:bg-[#856625] text-white">
          <Search className="w-5 h-5" />
        </Button>
      </div>

      {/* Intestazione e Azioni di Massa */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-800">Archivio Analisi</h2>
            {isAdmin && (
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-200">
                    Vista Admin
                </span>
            )}
        </div>
        
        {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-sm text-slate-500 mr-2">{selectedIds.length} selezionate</span>
                <Button variant="destructive" onClick={handleDelete} disabled={isProcessing} className="gap-2">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4" />}
                    Elimina Selezionate
                </Button>
            </div>
        )}
      </div>

      {/* Tabella Dati */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-600 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                <th className="p-4 w-12">
                    <Checkbox 
                        checked={data.length > 0 && selectedIds.length === data.length} 
                        onCheckedChange={toggleAll} 
                    />
                </th>
                <th className="px-4 py-3" title="ID della Verifica originale">ID Verifica Base</th>
                <th className="px-4 py-3">Data Analisi</th>
                <th className="px-4 py-3">Nome Operazione</th>
                <th className="px-4 py-3 text-center">Esito / Rischio</th>
                <th className="px-4 py-3 text-right">Azioni</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {data.length === 0 && (
                    <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500">
                            Nessuna analisi trovata in archivio.
                        </td>
                    </tr>
                )}
                {data.map((row) => {
                    const metadata = row.metadata || {};
                    const nomeOperazione = metadata.nome_operazione || metadata.operation_name || 'Operazione senza nome';
                    const displayId = row.parent_session_id || row.id;

                    return (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                                <Checkbox 
                                    checked={selectedIds.includes(row.id)} 
                                    onCheckedChange={() => toggleSelection(row.id)} 
                                />
                            </td>
                            
                            <td className="px-4 py-3 font-medium text-slate-700">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono border border-slate-200">
                                    {row.parent_session_id 
                                        ? `VAL-${String(row.evaluation_code).padStart(5, '0')} (Figlia)` 
                                        : `VAL-${String(row.evaluation_code).padStart(5, '0')}`}
                                </span>
                            </td>
                            
                            <td className="px-4 py-3 text-slate-500">
                                {new Date(row.created_at).toLocaleDateString('it-IT')}
                            </td>
                            
                            <td className="px-4 py-3 font-medium text-slate-900">
                                {nomeOperazione}
                            </td>
                            
                            <td className="px-4 py-3 text-center">
                                {row.final_outcome ? (
                                    <span className={cn(
                                        "inline-flex px-2 py-1 rounded text-xs font-medium border", 
                                        row.final_outcome.toLowerCase().includes("accettabile") 
                                            ? "bg-green-50 text-green-700 border-green-200" 
                                            : "bg-red-50 text-red-700 border-red-200"
                                    )}>
                                        {row.final_outcome}
                                    </span>
                                ) : (
                                    <span className="text-slate-400 italic text-xs">In corso...</span>
                                )}
                            </td>

                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {row.status === 'completed' || row.final_outcome ? (
                                        <Button variant="ghost" size="icon" className="text-emerald-600 hover:bg-emerald-50" onClick={() => router.push(`/analisi?session_id=${row.id}`)} title="Vedi Analisi Archiviata">
                                            <FileArchive className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="text-amber-600 hover:bg-amber-50" onClick={() => router.push(`/valutazione-finale?session_id=${row.id}`)} title="Continua o Modifica Analisi">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
            </table>
        </div>
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center border-t border-slate-200 pt-4">
            <span className="text-sm text-slate-500">Pagina {page} di {totalPages}</span>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Precedente
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                    Successivo <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </div>
        </div>
      )}

    </div>
  )
}