'use client'

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { QuestionItem } from "@/components/questions/questionItem"
import { mapResponses, checkSectionRules } from "@/lib/logic-engine"
import { Lock, AlertCircle, CheckCircle, Save, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { saveResponsesBulk, deleteResponsesBulk } from "@/actions/questions"

// 🛠️ IMPORT RIGOROSI: Niente interfacce clonate localmente
import { Tables } from "@/types/supabase"
import { QuestionWithConfig, SectionLogicRule } from "@/types/questions"
import { AnswerValue } from "./dynamicInput" // Aggiusta il percorso se necessario

// 🛠️ Usiamo i tipi delle tabelle per estendere le sezioni
type SectionWithQuestions = Tables<'sections'> & {
    questions: Tables<'questions'>[]
    default_open?: boolean
    default_mode?: 'edit' | 'view'
}

// 🛠️ Interfaccia rigorosa per il componente, con le Risposte native del DB
interface SectionListProps {
    sections: SectionWithQuestions[] | null
    userResponses: Tables<'user_responses'>[] | null // Usa Tables<'user_responses'>
    toolId: string
    sessionId: string
    defaultOpen?: boolean
    defaultMode?: 'edit' | 'view'
    // 🛠️ Tipo esatto per gestire il passaggio dell'eccezione al server
    onCompleteAction?: (
        sessionId: string, 
        exceptionData?: { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }
    ) => Promise<{ redirectUrl?: string, error?: string }>
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

    // Inizializzazione sicura dagli userResponses
    const initialAnswers = useMemo(() => mapResponses(userResponses), [userResponses]);
    const initialFiles = useMemo(() => {
        const files: Record<string, string | null> = {};
        userResponses?.forEach(r => { if (r.file_path) files[r.question_id] = r.file_path });
        return files;
    }, [userResponses]);

    const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>(() => initialAnswers);
    const [localFiles, setLocalFiles] = useState<Record<string, string | null>>(() => initialFiles);
    const [localExtraData, setLocalExtraData] = useState<Record<string, Record<string, unknown>>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        sections?.forEach(s => { initialState[s.id] = s.default_open ?? defaultOpen; });
        return initialState;
    });

    const [editModes] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        sections?.forEach(s => { initialState[s.id] = (s.default_mode ?? defaultMode) === 'edit'; });
        return initialState;
    });

    const toggleSection = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

    useEffect(() => { setLocalAnswers(mapResponses(userResponses)); }, [userResponses]);

    const handleAnswerChange = (questionId: string, value: unknown) => {
        setLocalAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleFileChange = (questionId: string, path: string | null) => {
        setLocalFiles(prev => ({ ...prev, [questionId]: path }));
    };

    const handleExtraDataChange = (questionId: string, extra: Record<string, unknown> | null) => {
        setLocalExtraData(prev => ({ ...prev, [questionId]: extra || {} }));
    };

    // 🛠️ Motore logico sicuro
    const processedForm = useMemo(() => {
        const visibleQs: Tables<'questions'>[] = [];
        const hiddenQs: Tables<'questions'>[] = [];
        const exceptions: Record<string, SectionLogicRule | null> = {};

        sections?.forEach((section) => {
            const allQuestions = section.questions || [];
            if (allQuestions.length === 0) return;

            // Facciamo il cast del JSONB di supabase alla nostra interfaccia rigorosa
            const rules = (section.logic_rules as unknown as SectionLogicRule[]) || [];

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
                        if (localExtraData[q.id]) extraDataSoFar[q.id] = localExtraData[q.id];
                        // checkSectionRules valuta se una regola "stop_section" si è avverata
                        const exceptionHere = checkSectionRules(rules, answersSoFar, extraDataSoFar);
                        if (exceptionHere) {
                            activeException = exceptionHere;
                            isBlocked = true;
                        }
                    } else {
                        isBlocked = true; // Si ferma alla prima domanda non risposta in mod sequenziale
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
        // payload per il salvataggio basato sui tipi corretti
        const payloadToSave: { questionId: string, value: unknown, inputType: 'text' | 'json' }[] = [];
        const idsToDelete: string[] = [];

        for (const q of processedForm.visibleQs) {
            if (!editModes[q.section_id]) continue;
            
            // Ignoriamo le domande facoltative se configurate (estrazione sicura dal JSON config)
            const configObj = q.config as Record<string, unknown> | null;
            const isOptional = configObj?.optional === true;

            const val = localAnswers[q.id];
            const fileVal = localFiles[q.id];
            const isAnswered = (val !== undefined && val !== null && val !== '') || (fileVal !== undefined && fileVal !== null);

            const initialVal = initialAnswers[q.id];
            const initialFileVal = initialFiles[q.id];
            const isValueChanged = JSON.stringify(val) !== JSON.stringify(initialVal);
            const isFileChanged = fileVal !== initialFileVal;

            if (!isAnswered) {
                if (!isOptional) {
                    hasUnanswered = true;
                    break;
                } else if (initialVal !== undefined || initialFileVal !== undefined) {
                    idsToDelete.push(q.id);
                }
            } else if (isValueChanged || isFileChanged || !userResponses?.some(r => r.question_id === q.id)) {
                const isJson = typeof val === 'object' && val !== null;
                payloadToSave.push({
                    questionId: q.id,
                    value: val,
                    inputType: isJson ? 'json' : 'text'
                });
            }
        }

        if (hasUnanswered) {
            toast.error("Per favore, completa tutte le domande obbligatorie visibili.");
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading("Salvataggio in corso...");

        try {
            if (idsToDelete.length > 0) await deleteResponsesBulk(toolId, sessionId, idsToDelete);
            if (payloadToSave.length > 0) await saveResponsesBulk(toolId, sessionId, payloadToSave);

            if (onCompleteAction) {
                // 🛠️ MODIFICA: Ricerca di un'eccezione attiva da passare al backend
                const activeException = Object.values(processedForm.exceptions).find(e => e !== null);
                
                // Formattiamo rigorosamente i dati per TypeScript
                const exceptionData = activeException ? {
                    isBlocked: true,
                    blockReason: activeException.message,
                    blockVariant: activeException.variant as 'success' | 'warning' | 'error'
                } : undefined;

                // Passiamo i dati dell'eccezione (se presente) al server
                const result = await onCompleteAction(sessionId, exceptionData);
                
                if (result.error) throw new Error(result.error);
                if (result.redirectUrl) {
                    toast.dismiss(toastId);
                    router.push(result.redirectUrl);
                    return;
                }
            }
            toast.success("Progressi salvati", { id: toastId });
            router.refresh();
        } catch (e) {
            toast.error("Errore nel salvataggio", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const getSectionProgress = (sectionId: string) => {
        const visibleQs = processedForm.visibleQs.filter(q => q.section_id === sectionId);
        const answeredCount = visibleQs.filter(q => {
            const val = localAnswers[q.id];
            const file = localFiles[q.id];
            return (val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0)) || (file !== undefined && file !== null);
        }).length;
        return { total: visibleQs.length, answered: answeredCount };
    };

    return (
        <div className="space-y-10 pb-20">
            {sections?.map((section) => {
                const sectionVisibleQs = processedForm.visibleQs.filter(q => q.section_id === section.id);
                if (sectionVisibleQs.length === 0 && !processedForm.exceptions[section.id]) return null;

                const isOpen = openSections[section.id];
                const activeException = processedForm.exceptions[section.id];
                const progress = getSectionProgress(section.id);
                const isComplete = progress.answered === progress.total && progress.total > 0;

                return (
                    <div
                        key={section.id}
                        className={cn(
                            "rounded-2xl border transition-all duration-300 bg-white shadow-sm overflow-hidden",
                            isOpen ? "border-[#967635]/30 ring-1 ring-[#967635]/5" : "border-slate-200"
                        )}
                    >
                        {/* HEADER SEZIONE */}
                        <div
                            className={cn(
                                "px-6 py-5 cursor-pointer flex items-center justify-between select-none",
                                isOpen ? "bg-[#fcfaf7]" : "hover:bg-slate-50"
                            )}
                            onClick={() => toggleSection(section.id)}
                        >
                            <div className="flex flex-col gap-1">
                                <h2 className="text-lg font-bold text-[#2e2416] tracking-tight">
                                    {section.title}
                                </h2>
                                {progress.total > 0 && (
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#967635]/70">
                                        Completamento: {progress.answered} / {progress.total}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                {isComplete && !isOpen && <CheckCircle className="w-5 h-5 text-[#4a7c2e]" />}
                                <div className="p-1.5 rounded-full bg-slate-100 text-slate-500">
                                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                            </div>
                        </div>

                        {/* BARRA PROGRESSO */}
                        {progress.total > 0 && (
                            <div className="w-full h-1 bg-slate-100">
                                <div
                                    className="h-full bg-[#967635] transition-all duration-500"
                                    style={{ width: `${(progress.answered / progress.total) * 100}%` }}
                                />
                            </div>
                        )}

                        {/* CORPO SEZIONE */}
                        {isOpen && (
                            <div className="px-6 py-8 space-y-10 animate-in fade-in duration-300">
                                <div className="space-y-12">
                                    {sectionVisibleQs.map((question) => {
                                        // 🛠️ CAST SICURO SENZA "any": 
                                        // Diciamo a TS che il record del DB corrisponde all'interfaccia QuestionWithConfig
                                        const questionWithConfig = {
                                            ...question,
                                            config: question.config
                                        } as unknown as QuestionWithConfig;
                                        
                                        return (
                                            <QuestionItem
                                                key={question.id}
                                                toolId={toolId}
                                                sessionId={sessionId}
                                                question={questionWithConfig} // 🛠️ Nessun errore qui ora
                                                value={(localAnswers[question.id] as AnswerValue) ?? null} // 🛠️ Cast sicuro della risposta
                                                filePath={localFiles[question.id] ?? null}
                                                onAnswerChange={(val) => handleAnswerChange(question.id, val)}
                                                onFileChange={(path) => handleFileChange(question.id, path)}
                                                onExtraChange={(extra) => handleExtraDataChange(question.id, extra)}
                                                readOnly={!editModes[section.id]}
                                            />
                                        )
                                    })}
                                </div>

                                {/* MESSAGGIO DI ECCEZIONE (BLOCCO) */}
                                {activeException && (
                                    <div className={cn(
                                        "p-5 rounded-xl border flex gap-4 bg-gradient-to-r",
                                        activeException.variant === 'warning'
                                            ? "from-amber-50 to-white border-amber-200 text-amber-900"
                                            : "from-emerald-50 to-white border-emerald-200 text-emerald-900"
                                    )}>
                                        <div className="mt-0.5">
                                            {activeException.variant === 'warning' ? <AlertCircle className="w-5 h-5 text-amber-600" /> : <CheckCircle className="w-5 h-5 text-emerald-600" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold leading-relaxed">{activeException.message}</p>
                                        </div>
                                    </div>
                                )}

                                {/* BLOCCO PADLOCK SEQUENZIALE */}
                                {section.render_mode === 'sequential' && !activeException && sectionVisibleQs.length < (section.questions?.length || 0) && (
                                    <div className="flex items-center justify-center gap-3 py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Lock className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-500 font-medium">Rispondi alle domande sopra per sbloccare i passaggi successivi</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* PULSANTE SALVA E CONTINUA */}
            <div className="pt-6 flex justify-start">
                <Button
                    onClick={handleSaveAll}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-[#967635] to-[#7a5f2a] hover:from-[#7a5f2a] hover:to-[#5c4720] text-white min-w-[220px] h-12 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                >
                    {isSaving ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Salvataggio...</>
                    ) : (
                        <><Save className="w-5 h-5 mr-2" /> Salva e Continua</>
                    )}
                </Button>
            </div>
        </div>
    )
}