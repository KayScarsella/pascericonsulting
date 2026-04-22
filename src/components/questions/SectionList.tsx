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
import { EUDR_TOOL_ID, TIMBER_TOOL_ID } from "@/lib/constants"
import {
    EUDR_Q_CITES,
    EUDR_Q_FLEGT,
    EUDR_SECTION_G,
    isYesLikeAnswer,
} from "@/lib/eudr-question-ids"
import { EmbeddedDueDiligenceBlock } from "@/features/eudr-due-diligence/EmbeddedDueDiligenceBlock"

/** Sezione E — Paese di raccolta: dopo "Rischio paese" mostra blocco AOI inline */
const SECTION_E_PAES_EMBED_AFTER = "8e3c8459-5a9b-4ecf-8a4e-9f9da2b53cc1"
const QUESTION_RISCHIO_PAESE_ID = "e8f9a0b1-c2d3-4e4f-8a9b-0c1d2e3f4a65"

const RELIABILITY_OPTIONS_SIGNATURE = [
    { label: "Affidabilità alta", value: "1" },
    { label: "Affidabilità medio alta", value: "2" },
    { label: "Affidabilità media", value: "3" },
    { label: "Affidabilità medio bassa", value: "4" },
    { label: "Affidabilità bassa", value: "44" },
] as const

function hasReliabilitySelectConfig(q: Tables<'questions'>): boolean {
    if (q.type !== "select") return false
    const cfg = q.config as Record<string, unknown> | null
    if (!cfg || typeof cfg !== "object") return false
    if (cfg.file_upload_enabled !== true) return false
    const opts = cfg.options as unknown
    if (!Array.isArray(opts) || opts.length !== RELIABILITY_OPTIONS_SIGNATURE.length) return false
    for (let i = 0; i < RELIABILITY_OPTIONS_SIGNATURE.length; i++) {
        const o = opts[i] as Record<string, unknown> | null
        if (!o) return false
        if (String(o.label ?? "") !== RELIABILITY_OPTIONS_SIGNATURE[i].label) return false
        if (String(o.value ?? "") !== RELIABILITY_OPTIONS_SIGNATURE[i].value) return false
    }
    return true
}

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

    const sectionsForRender = useMemo(() => {
        if (!sections) return null;
        if (toolId !== TIMBER_TOOL_ID) return sections;

        const hasTimberFlegtOrCitesYes = sections.some((section) =>
            (section.questions || []).some((question) => {
                const text = String(question.text ?? '').toLowerCase();
                const isFlegtOrCitesQuestion = text.includes('flegt') || text.includes('cites');
                if (!isFlegtOrCitesQuestion) return false;
                return isYesLikeAnswer(localAnswers[question.id]);
            })
        );

        if (!hasTimberFlegtOrCitesYes) return sections;

        // Regola solo visuale lato client: nasconde la sezione C dopo B.
        return sections.filter((section) => !/^\s*(sezione\s*)?c\b/i.test(String(section.title ?? '')));
    }, [sections, toolId, localAnswers]);

    // 🛠️ Motore logico sicuro
    const processedForm = useMemo(() => {
        const visibleQs: Tables<'questions'>[] = [];
        const hiddenQs: Tables<'questions'>[] = [];
        const exceptions: Record<string, SectionLogicRule | null> = {};

        sectionsForRender?.forEach((section) => {
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
    }, [sectionsForRender, localAnswers, localFiles, localExtraData]);

    const handleSaveAll = async () => {
        let hasUnanswered = false;
        // payload per il salvataggio basato sui tipi corretti
        const payloadToSave: { questionId: string, value: unknown, inputType: 'text' | 'json' }[] = [];
        const idsToDelete: string[] = [];

        const triggerGeoOnly =
            toolId === EUDR_TOOL_ID &&
            (isYesLikeAnswer(localAnswers[EUDR_Q_FLEGT]) || isYesLikeAnswer(localAnswers[EUDR_Q_CITES]))

        for (const q of processedForm.visibleQs) {
            if (!editModes[q.section_id]) continue;

            // EUDR Section G override: when triggered, we only require geolocation uploads.
            // - reliability select questions: prefilled to value "2" but still require file upload
            // - all other questions in Section G: treated as N/A (ignored for save/required)
            const isEudrSectionG = toolId === EUDR_TOOL_ID && q.section_id === EUDR_SECTION_G
            const isReliabilitySelect = isEudrSectionG && triggerGeoOnly && hasReliabilitySelectConfig(q)
            const isNaInSectionG = isEudrSectionG && triggerGeoOnly && !isReliabilitySelect
            
            // Ignoriamo le domande facoltative se configurate (estrazione sicura dal JSON config)
            const configObj = q.config as Record<string, unknown> | null;
            const isOptional = configObj?.optional === true;

            const val = localAnswers[q.id];
            const fileVal = localFiles[q.id];
            if (isNaInSectionG) continue;

            // If Section G is not editable (view mode) we must never block saving on it.
            // When trigger is active, we also don't require uploads on the prefilled reliability selects;
            // geolocation evidence is handled by the dedicated AOI flow / other questions.
            const isAnswered = isReliabilitySelect
                ? true
                : (val !== undefined && val !== null && val !== '') || (fileVal !== undefined && fileVal !== null);

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
                // For reliability selects in Section G: allow persisting the derived "2" value so it can be stored in DB.
                // Only upsert when missing/empty to avoid overwriting real data.
                if (isReliabilitySelect) {
                    const existing = (userResponses || []).find((r) => r.question_id === q.id)
                    const existingText = existing?.answer_text?.trim() ?? ""
                    if (!existingText) {
                        payloadToSave.push({ questionId: q.id, value: "2", inputType: "text" })
                    }
                    continue;
                }
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
                const activeException = Object.values(processedForm.exceptions).find(
                    (e) => e !== null && e.variant !== 'silent'
                );
                
                // Formattiamo rigorosamente i dati per TypeScript
                const exceptionData = activeException ? {
                    isBlocked: true,
                    blockReason: activeException.message || '',
                    blockVariant: (activeException.variant === 'success' || activeException.variant === 'warning')
                        ? activeException.variant
                        : 'warning'
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
            const message = e instanceof Error && e.message.trim() !== '' ? e.message : "Errore nel salvataggio";
            toast.error(message, { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const getSectionProgress = (sectionId: string) => {
        const visibleQs = processedForm.visibleQs.filter(q => q.section_id === sectionId);
        const answeredCount = visibleQs.filter(q => {
            const val = localAnswers[q.id];
            const file = localFiles[q.id];
            const triggerGeoOnly =
                toolId === EUDR_TOOL_ID &&
                (isYesLikeAnswer(localAnswers[EUDR_Q_FLEGT]) || isYesLikeAnswer(localAnswers[EUDR_Q_CITES]))
            const isEudrSectionG = toolId === EUDR_TOOL_ID && q.section_id === EUDR_SECTION_G
            const isReliabilitySelect = isEudrSectionG && triggerGeoOnly && hasReliabilitySelectConfig(q)
            const isNaInSectionG = isEudrSectionG && triggerGeoOnly && !isReliabilitySelect
            if (isNaInSectionG) return true
            if (isReliabilitySelect) return true
            return (val !== undefined && val !== null && val !== '' && (!Array.isArray(val) || val.length > 0)) || (file !== undefined && file !== null);
        }).length;
        return { total: visibleQs.length, answered: answeredCount };
    };

    return (
        <div className="space-y-10 pb-20">
            {sectionsForRender?.map((section) => {
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

                                        const triggerGeoOnly =
                                            toolId === EUDR_TOOL_ID &&
                                            (isYesLikeAnswer(localAnswers[EUDR_Q_FLEGT]) || isYesLikeAnswer(localAnswers[EUDR_Q_CITES]))
                                        const isEudrSectionG =
                                            toolId === EUDR_TOOL_ID &&
                                            section.id === EUDR_SECTION_G
                                        const isReliabilitySelect =
                                            isEudrSectionG && triggerGeoOnly && hasReliabilitySelectConfig(question)
                                        const isNaInSectionG = isEudrSectionG && triggerGeoOnly && !isReliabilitySelect

                                        const derivedValue = isReliabilitySelect ? ("2" as unknown as AnswerValue) : null
                                        const effectiveValue = isReliabilitySelect
                                            ? ((localAnswers[question.id] as AnswerValue) ?? derivedValue)
                                            : ((localAnswers[question.id] as AnswerValue) ?? null)
                                        
                                        return (
                                            <div key={question.id} className="space-y-0">
                                                <QuestionItem
                                                    toolId={toolId}
                                                    sessionId={sessionId}
                                                    question={questionWithConfig}
                                                    value={isNaInSectionG ? null : effectiveValue}
                                                    filePath={localFiles[question.id] ?? null}
                                                    onAnswerChange={(val) => {
                                                        if (isReliabilitySelect || isNaInSectionG) return
                                                        handleAnswerChange(question.id, val)
                                                    }}
                                                    onFileChange={(path) => handleFileChange(question.id, path)}
                                                    onExtraChange={(extra) => handleExtraDataChange(question.id, extra)}
                                                    readOnly={!editModes[section.id]}
                                                    inputReadOnly={isReliabilitySelect || isNaInSectionG || !editModes[section.id]}
                                                    uploadReadOnly={isNaInSectionG || !editModes[section.id]}
                                                    staticDisplayText={
                                                        isNaInSectionG
                                                            ? "Non applicabile (FLEGT/CITES: geolocalizzazione sufficiente)"
                                                            : null
                                                    }
                                                />
                                                {toolId === EUDR_TOOL_ID &&
                                                    section.id === SECTION_E_PAES_EMBED_AFTER &&
                                                    question.id === QUESTION_RISCHIO_PAESE_ID &&
                                                    editModes[section.id] && (
                                                        <EmbeddedDueDiligenceBlock sessionId={sessionId} />
                                                    )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* MESSAGGIO DI ECCEZIONE (BLOCCO) */}
                                {activeException && activeException.variant !== 'silent' && (activeException.message?.trim() ?? '') !== '' && (
                                    <div className={cn(
                                        "p-5 rounded-xl border flex gap-4 bg-gradient-to-r",
                                        activeException.variant === 'warning'
                                            ? "from-amber-50 to-white border-amber-200 text-amber-900"
                                            : activeException.variant === 'info'
                                                ? "from-sky-50 to-white border-sky-200 text-sky-900"
                                                : "from-emerald-50 to-white border-emerald-200 text-emerald-900"
                                    )}>
                                        <div className="mt-0.5">
                                            {activeException.variant === 'warning' ? (
                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                            ) : activeException.variant === 'info' ? (
                                                <AlertCircle className="w-5 h-5 text-sky-600" />
                                            ) : (
                                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                            )}
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
                    type="button"
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