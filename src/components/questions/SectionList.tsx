'use client'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation" 
import { QuestionItem } from "@/components/questions/questionItem"
import { QuestionWithConfig, UserResponseRow, SectionLogicRule } from "@/types/questions"
import { Database } from "@/types/supabase"
import { mapResponses, checkSectionRules } from "@/lib/logic-engine"
import { Lock, AlertCircle, CheckCircle, Save, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { saveResponsesBulk, deleteResponsesBulk } from "@/actions/questions"

type SectionWithQuestions = Database['public']['Tables']['sections']['Row'] & {
  questions: Database['public']['Tables']['questions']['Row'][]
  default_open?: boolean
  default_mode?: 'edit' | 'view'
}

interface SectionListProps {
  sections: SectionWithQuestions[] | null
  userResponses: UserResponseRow[] | null
  toolId: string
  sessionId: string 
  defaultOpen?: boolean
  defaultMode?: 'edit' | 'view'
  onCompleteAction?: (sessionId: string) => Promise<{ redirectUrl?: string, error?: string }> 
}

export function SectionList({ 
  sections, 
  userResponses, 
  toolId, 
  sessionId,
  defaultOpen = true, 
  defaultMode = 'edit',
  onCompleteAction 
}: SectionListProps) {
  
  const router = useRouter(); 
  
  // 🛠️ BEST PRACTICE: Salviamo lo stato iniziale per poter fare il confronto
  const initialAnswers = useMemo(() => mapResponses(userResponses), [userResponses]);
  const initialFiles = useMemo(() => {
    const files: Record<string, string | null> = {};
    userResponses?.forEach(r => { if(r.file_path) files[r.question_id] = r.file_path });
    return files;
  }, [userResponses]);

  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>(() => initialAnswers);
  const [localFiles, setLocalFiles] = useState<Record<string, string | null>>(() => initialFiles);
  
  const [localExtraData, setLocalExtraData] = useState<Record<string, Record<string, unknown>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    sections?.forEach(s => {
      initialState[s.id] = s.default_open ?? defaultOpen; 
    });
    return initialState;
  });

  const [editModes] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    sections?.forEach(s => {
      const mode = s.default_mode ?? defaultMode;
      initialState[s.id] = mode === 'edit'; 
    });
    return initialState;
  });

  const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    setLocalAnswers(mapResponses(userResponses));
  }, [userResponses]);

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileChange = (questionId: string, path: string | null) => {
    setLocalFiles(prev => ({ ...prev, [questionId]: path }));
  };

  const handleExtraDataChange = (questionId: string, extra: Record<string, unknown> | null) => {
    setLocalExtraData(prev => ({ ...prev, [questionId]: extra || {} }));
  };

  const processedForm = useMemo(() => {
    const visibleQs: QuestionWithConfig[] = [];
    const hiddenQs: QuestionWithConfig[] = [];
    const exceptions: Record<string, SectionLogicRule | null> = {};

    sections?.forEach((section) => {
        const allQuestions = (section.questions || []).map(q => ({
            ...q,
            config: q.config as unknown 
        })) as QuestionWithConfig[];

        if (allQuestions.length === 0) return;

        const rules = section.logic_rules as unknown as SectionLogicRule[];
        
        if (section.render_mode === 'sequential') {
            let activeException: SectionLogicRule | null = null;
            const answersSoFar: Record<string, unknown> = {};
            const extraDataSoFar: Record<string, Record<string, unknown>> = {}; 
            let isBlocked = false; 

            for (const q of allQuestions) {
                if (isBlocked) {
                    hiddenQs.push(q);
                    continue;
                }

                visibleQs.push(q);

                const val = localAnswers[q.id];
                const fileVal = localFiles[q.id];
                const isAnswered = (val !== undefined && val !== null && val !== '') || (fileVal !== undefined && fileVal !== null);

                if (isAnswered) {
                    answersSoFar[q.id] = val;
                    if (localExtraData[q.id]) {
                        extraDataSoFar[q.id] = localExtraData[q.id];
                    }

                    const exceptionHere = checkSectionRules(rules, answersSoFar, extraDataSoFar);
                    if (exceptionHere) {
                        activeException = exceptionHere;
                        isBlocked = true; 
                    }
                } else {
                    isBlocked = true; 
                }
            }
            exceptions[section.id] = activeException;

        } else {
            visibleQs.push(...allQuestions);
            exceptions[section.id] = checkSectionRules(rules, localAnswers, localExtraData);
        }
    });

    return { visibleQs, hiddenQs, exceptions };
  }, [sections, localAnswers, localFiles, localExtraData]); 

  const handleSaveAll = async () => {
    let hasUnanswered = false;
    const payloadToSave: { questionId: string, value: unknown, inputType: 'text' | 'json' }[] = [];
    const idsToDelete: string[] = [];

    for (const q of processedForm.visibleQs) {
        if (!editModes[q.section_id]) continue;

        const val = localAnswers[q.id];
        const fileVal = localFiles[q.id];
        const isAnswered = (val !== undefined && val !== null && val !== '') || (fileVal !== undefined && fileVal !== null);

        // 🛠️ BEST PRACTICE: Dirty Checking - Evitiamo di mandare dati al server se non sono cambiati
        const initialVal = initialAnswers[q.id];
        const initialFileVal = initialFiles[q.id];
        
        const isValueChanged = JSON.stringify(val) !== JSON.stringify(initialVal);
        const isFileChanged = fileVal !== initialFileVal;

        if (!isAnswered) {
            hasUnanswered = true;
            break; 
        } else if (isValueChanged || isFileChanged || !userResponses?.some(r => r.question_id === q.id)) {
            // Aggiungiamo al payload solo se modificato o nuovo
            const isJson = typeof val === 'object' && val !== null;
            payloadToSave.push({ 
                questionId: q.id, 
                value: val, 
                inputType: isJson ? 'json' : 'text' 
            });
        }
    }

    if (hasUnanswered) {
        toast.error("Attenzione! Devi rispondere a tutte le domande delle sezioni in modifica prima di salvare.");
        return;
    }

    for (const hiddenQ of processedForm.hiddenQs) {
        if (!editModes[hiddenQ.section_id]) continue;

        const hasLocalData = localAnswers[hiddenQ.id] !== undefined && localAnswers[hiddenQ.id] !== '';
        const hasLocalFile = localFiles[hiddenQ.id] !== undefined && localFiles[hiddenQ.id] !== null;
        const wasInDb = userResponses?.some(r => r.question_id === hiddenQ.id);

        if (hasLocalData || hasLocalFile || wasInDb) {
            idsToDelete.push(hiddenQ.id);
        }
    }

    // Se non ci sono modifiche e non c'è una successiva operazione da eseguire
    if (payloadToSave.length === 0 && idsToDelete.length === 0 && !onCompleteAction) {
        toast.info("Nessuna modifica da salvare.");
        return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Salvataggio in corso...");

    try {
        if (idsToDelete.length > 0) {
            const deleteRes = await deleteResponsesBulk(toolId, sessionId, idsToDelete);
            if (deleteRes.error) throw new Error(deleteRes.error);
        }

        if (payloadToSave.length > 0) {
            const saveRes = await saveResponsesBulk(toolId, sessionId, payloadToSave);
            if (saveRes.error) throw new Error(saveRes.error);
        }
        
        // 🛠️ FIX BUG CARICAMENTO INFINITO: Disinnesco del toast prima dei cambi pagina
        if (onCompleteAction) {
            toast.loading("Generazione passaggi successivi in corso...", { id: toastId });
            const result = await onCompleteAction(sessionId);
            
            if (result.error) {
                toast.error(result.error, { id: toastId });
                return; // Ci fermiamo in caso di errore
            }
            
            if (result.redirectUrl) {
                toast.success("Generazione completata! Reindirizzamento...", { id: toastId });
                router.push(result.redirectUrl);
                return; // Evitiamo router.refresh() se stiamo cambiando pagina
            }

            toast.success("Operazione conclusa con successo.", { id: toastId });
        } else {
            toast.success("Risposte salvate con successo!", { id: toastId });
        }

        router.refresh();

    } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore imprevisto durante il salvataggio.", { id: toastId });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="space-y-12 pb-12">
      {sections?.map((section) => {
        const allQuestions = section.questions || [];
        if (allQuestions.length === 0) return null;

        const sectionVisibleQs = processedForm.visibleQs.filter(q => q.section_id === section.id);
        const activeException = processedForm.exceptions[section.id];
        
        const isOpen = openSections[section.id];
        const isEditMode = editModes[section.id];

        return (
          <section key={section.id} className="space-y-6">
            
            <div className="flex items-center justify-between sticky top-16 z-10 bg-slate-50/95 backdrop-blur py-4 border-b border-slate-200/50">
                <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-1 rounded-full", activeException ? "bg-green-500" : "bg-[#967635]")} />
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
                        {section.render_mode === 'sequential' && !activeException && (
                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full ml-2">Guidata</span>
                        )}
                        {!isEditMode && (
                             <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full ml-2 border border-blue-200">Sola lettura</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleSection(section.id)}
                        className="text-slate-500 hover:text-slate-800"
                        title={isOpen ? "Comprimi sezione" : "Espandi sezione"}
                    >
                        {isOpen ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </Button>
                </div>
            </div>

            {isOpen && (
                <div className="grid gap-6 pl-0 md:pl-4 transition-all">
                    
                    {sectionVisibleQs.map((question) => {
                        return (
                            <div key={question.id} className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <QuestionItem 
                                    toolId={toolId}
                                    sessionId={sessionId}
                                    question={question}
                                    value={localAnswers[question.id] ?? null} 
                                    filePath={localFiles[question.id] ?? null}
                                    onAnswerChange={(val) => handleAnswerChange(question.id, val)}
                                    onFileChange={(path) => handleFileChange(question.id, path)}
                                    onExtraChange={(extra) => handleExtraDataChange(question.id, extra)} 
                                    readOnly={!isEditMode}
                                />
                            </div>
                        )
                    })}

                    {activeException && (
                        <div className={cn(
                            "p-6 rounded-lg border flex gap-4 animate-in fade-in slide-in-from-top-4 shadow-sm mt-2",
                            activeException.variant === 'warning' ? "bg-amber-50 border-amber-200 text-amber-800" :
                            "bg-green-50 border-green-200 text-green-800"
                        )}>
                            <div className="shrink-0 mt-1">
                                {activeException.variant === 'warning' ? <AlertCircle className="w-6 h-6"/> : <CheckCircle className="w-6 h-6"/>}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Risultato</h3>
                                <p className="text-sm opacity-90 leading-relaxed font-medium">
                                    {activeException.message}
                                </p>
                            </div>
                        </div>
                    )}

                    {section.render_mode === 'sequential' && !activeException && sectionVisibleQs.length < allQuestions.length && (
                        <div className="p-6 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 gap-2 bg-slate-50/50 mt-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm">Rispondi alla domanda precedente per continuare</span>
                        </div>
                    )}

                </div>
            )}
          </section>
        )
      })}

      <div className="pt-8 flex justify-start pl-0 md:pl-4">
         <Button 
            onClick={handleSaveAll} 
            disabled={isSaving}
            className="bg-[#967635] hover:bg-[#7a5f2a] text-white min-w-[200px]"
            size="lg"
         >
            {isSaving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Elaborazione...</>
            ) : (
                <><Save className="w-5 h-5 mr-2" /> Salva e Continua</>
            )}
         </Button>
      </div>

    </div>
  )
}