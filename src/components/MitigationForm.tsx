'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Loader2, Save, ChevronDown, ChevronUp, ArrowRight, Clock, AlertTriangle, Upload, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  saveMitigation,
  uploadMitigationFile,
  saveEudrMitigation,
  uploadEudrMitigationFile,
} from "@/actions/workflows"

interface FailingQuestion {
    questionId: string
    label: string
    shortLabel: string
    currentAnswer: string | null
    currentAnswerLabel: string
    riskIndex: number
    options: { value: string; label: string; riskIndex: number }[]
    inputType: 'select' | 'toggle'
    requiresFile?: boolean
}

interface HistoryEntry {
    id: string
    question_id: string
    previous_answer: string | null
    new_answer: string
    mitigated_at: string
    previous_label?: string
    new_label?: string
    comment?: string | null
    file_path?: string | null
}

interface MitigationFormProps {
    sessionId: string
    failingQuestions: FailingQuestion[]
    history: HistoryEntry[]
    /** default timber – use 'eudr' for EUDR analisi finale */
    variant?: "timber" | "eudr"
}

export function MitigationForm({
    sessionId,
    failingQuestions,
    history,
    variant = "timber",
}: MitigationFormProps) {
    const router = useRouter()
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [comments, setComments] = useState<Record<string, string>>({})
    const [files, setFiles] = useState<Record<string, string | null>>({})
    const [fileUploading, setFileUploading] = useState<Record<string, boolean>>({})
    const [isSaving, setIsSaving] = useState(false)
    const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})

    // Group history by question (sorted by mitigated_at desc for modification-date order)
    const historyByQuestion: Record<string, HistoryEntry[]> = {}
    const sortedHistory = [...history].sort((a, b) => new Date(b.mitigated_at).getTime() - new Date(a.mitigated_at).getTime())
    for (const entry of sortedHistory) {
        if (!historyByQuestion[entry.question_id]) historyByQuestion[entry.question_id] = []
        historyByQuestion[entry.question_id].push(entry)
    }

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }))
    }

    const handleFileUpload = async (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileUploading(prev => ({ ...prev, [questionId]: true }))
        const formData = new FormData()
        formData.append('file', file)
        try {
            const res =
                variant === "eudr"
                    ? await uploadEudrMitigationFile(formData, sessionId, questionId)
                    : await uploadMitigationFile(formData, sessionId, questionId)
            if (res.path) setFiles(prev => ({ ...prev, [questionId]: res.path! }))
            else toast.error(res.error || "Errore upload")
        } finally {
            setFileUploading(prev => ({ ...prev, [questionId]: false }))
            e.target.value = ''
        }
    }

    const handleSave = async () => {
        const mitigations = failingQuestions
            .filter(q => answers[q.questionId] && answers[q.questionId] !== (q.currentAnswer || ''))
            .map(q => ({
                questionId: q.questionId,
                newAnswer: answers[q.questionId],
                comment: (comments[q.questionId] || '').trim() || null,
                filePath: q.requiresFile ? (files[q.questionId] ?? null) : null,
            }))

        if (mitigations.length === 0) {
            toast.warning("Modifica almeno una risposta per procedere con la mitigazione.")
            return
        }

        const missingComment = mitigations.some(m => !m.comment)
        if (missingComment) {
            toast.warning("Inserisci un commento che spiega il motivo della mitigazione per ogni risposta modificata.")
            return
        }

        const missingFile = mitigations.some(m => {
            const q = failingQuestions.find(f => f.questionId === m.questionId)
            return q?.requiresFile && !m.filePath
        })
        if (missingFile) {
            toast.warning("Allega il file richiesto per le domande che lo prevedono.")
            return
        }

        setIsSaving(true)
        const toastId = toast.loading("Salvataggio mitigazione...")

        try {
            const result =
                variant === "eudr"
                    ? await saveEudrMitigation(sessionId, mitigations)
                    : await saveMitigation(sessionId, mitigations)
            if (result.error) throw new Error(result.error)
            toast.success("Mitigazione salvata con successo!", { id: toastId })
            if (result.redirectUrl) {
                router.push(result.redirectUrl)
            }
        } catch (e) {
            toast.error("Errore nel salvataggio: " + (e instanceof Error ? e.message : "Errore sconosciuto"), { id: toastId })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            {failingQuestions.map((q) => {
                const qHistory = historyByQuestion[q.questionId] || []
                const isHistoryExpanded = expandedHistory[q.questionId] ?? false
                const selectedAnswer = answers[q.questionId] ?? ''
                const selectedRisk = selectedAnswer
                    ? q.options.find(o => o.value === selectedAnswer)?.riskIndex ?? null
                    : null

                return (
                    <div
                        key={q.questionId}
                        className="rounded-2xl border border-red-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md"
                    >
                        {/* Card header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-red-50/60 to-white border-b border-red-100/50">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <h3 className="text-base font-bold text-slate-900">{q.shortLabel}</h3>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">{q.label}</p>
                                </div>
                                <span className="inline-flex px-3 py-1.5 rounded-lg text-xs font-black bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
                                    {q.riskIndex.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Current answer (read-only) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Risposta attuale
                                </label>
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
                                    <span className="text-sm font-medium text-slate-700">{q.currentAnswerLabel}</span>
                                    <span className={`ml-auto text-xs px-2 py-0.5 rounded font-bold ${q.riskIndex <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        Rischio: {q.riskIndex.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* New answer input */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Nuova risposta
                                </label>
                                {q.inputType === 'toggle' ? (
                                    <div className="flex gap-3">
                                        {q.options.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleAnswerChange(q.questionId, opt.value)}
                                                className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${selectedAnswer === opt.value
                                                    ? 'border-[#967635] bg-[#967635]/5 text-[#967635] shadow-md'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                <span className="block">{opt.label}</span>
                                                <span className={`block mt-1 text-[10px] font-bold ${opt.riskIndex <= 0.30 ? 'text-green-600' : 'text-red-500'}`}>
                                                    Rischio: {opt.riskIndex.toFixed(2)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <select
                                        value={selectedAnswer}
                                        onChange={e => handleAnswerChange(q.questionId, e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#967635]/30 focus:border-[#967635] transition-all duration-200"
                                    >
                                        <option value="">Seleziona nuova risposta...</option>
                                        {q.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label} (Rischio: {opt.riskIndex.toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {/* Preview new risk */}
                                {selectedRisk !== null && selectedAnswer !== (q.currentAnswer || '') && (
                                    <div className="mt-2 flex items-center gap-2 text-xs animate-in fade-in duration-200">
                                        <span className="text-slate-400">Impatto:</span>
                                        <span className={`px-2 py-0.5 rounded font-bold ${q.riskIndex <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {q.riskIndex.toFixed(2)}
                                        </span>
                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                        <span className={`px-2 py-0.5 rounded font-bold ${selectedRisk <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {selectedRisk.toFixed(2)}
                                        </span>
                                        {selectedRisk < q.riskIndex && (
                                            <span className="text-green-600 font-semibold">↓ Miglioramento</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Comment (required when answer changed) */}
                            {selectedAnswer && selectedAnswer !== (q.currentAnswer || '') && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Motivo della mitigazione <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={comments[q.questionId] ?? ''}
                                        onChange={e => setComments(prev => ({ ...prev, [q.questionId]: e.target.value }))}
                                        placeholder="Spiega il motivo della modifica della risposta..."
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#967635]/30 focus:border-[#967635] transition-all duration-200 resize-none"
                                    />
                                </div>
                            )}

                            {/* File upload (when question requires it) */}
                            {q.requiresFile && selectedAnswer && selectedAnswer !== (q.currentAnswer || '') && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        File allegato <span className="text-red-500">*</span>
                                    </label>
                                    {files[q.questionId] ? (
                                        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                            <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                            <span className="truncate flex-1 text-slate-700 text-xs">
                                                {files[q.questionId]?.split('/').pop()?.replace(/^\d+_/, '')}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-slate-400 hover:text-red-600"
                                                onClick={() => setFiles(prev => ({ ...prev, [q.questionId]: null }))}
                                            >
                                                Rimuovi
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                onChange={e => handleFileUpload(q.questionId, e)}
                                                disabled={fileUploading[q.questionId]}
                                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-full gap-2 border-slate-200 text-slate-600"
                                                disabled={fileUploading[q.questionId]}
                                            >
                                                {fileUploading[q.questionId] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                {fileUploading[q.questionId] ? 'Caricamento...' : 'Allega file'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* History collapsible */}
                            {qHistory.length > 0 && (
                                <div className="pt-2">
                                    <button
                                        onClick={() => setExpandedHistory(prev => ({ ...prev, [q.questionId]: !prev[q.questionId] }))}
                                        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#967635] transition-colors"
                                    >
                                        <Clock className="w-3.5 h-3.5" />
                                        Storico ({qHistory.length} {qHistory.length === 1 ? 'modifica precedente' : 'modifiche precedenti'})
                                        {isHistoryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>

                                    {isHistoryExpanded && (
                                        <div className="mt-3 ml-2 pl-3 border-l-2 border-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {qHistory.map((entry, idx) => (
                                                <div key={entry.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                                                            V{qHistory.length - idx}
                                                        </span>
                                                        <span className="text-slate-400">
                                                            {new Date(entry.mitigated_at).toLocaleDateString('it-IT', {
                                                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-600">
                                                        <span>{entry.previous_label || entry.previous_answer || '—'}</span>
                                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                                        <span className="font-medium text-slate-800">{entry.new_label || entry.new_answer}</span>
                                                    </div>
                                                    {entry.comment && (
                                                        <p className="mt-1.5 text-slate-500 italic border-t border-slate-100 pt-1.5">
                                                            {entry.comment}
                                                        </p>
                                                    )}
                                                    {entry.file_path && (
                                                        <p className="mt-1 text-slate-500 flex items-center gap-1">
                                                            <FileText className="w-3 h-3" /> File allegato
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}

            {/* Save button */}
            <div className="pt-4 flex justify-start">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white min-w-[250px] h-12 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
                >
                    {isSaving ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Salvataggio...</>
                    ) : (
                        <><Save className="w-5 h-5 mr-2" /> Salva Mitigazione</>
                    )}
                </Button>
            </div>
        </div>
    )
}
