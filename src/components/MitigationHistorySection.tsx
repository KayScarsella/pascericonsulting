'use client'

import { useState } from "react"
import { ChevronDown, ChevronUp, Clock, ArrowRight, FileText, Download, Loader2 } from "lucide-react"
import type { RiskDetail } from "@/lib/risk-calculator"
import { getMitigationFileDownloadUrl } from "@/actions/workflows"

interface MitigationHistoryEntry {
    id: string
    question_id: string
    previous_answer: string | null
    new_answer: string
    mitigated_at: string
    comment?: string | null
    file_path?: string | null
}

interface QuestionMeta {
    label: string
    shortLabel: string
    lookup: Record<string, number>
    labels: Record<string, string>
}

interface MitigationHistorySectionProps {
    sessionId: string
    history: MitigationHistoryEntry[]
    questionLabelsMap: Record<string, QuestionMeta>
    currentDetails: RiskDetail[]
}

export function MitigationHistorySection({
    sessionId,
    history,
    questionLabelsMap,
    currentDetails,
}: MitigationHistorySectionProps) {
    const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({})
    const [downloadingPath, setDownloadingPath] = useState<string | null>(null)

    const handleDownload = async (filePath: string) => {
        setDownloadingPath(filePath)
        try {
            const res = await getMitigationFileDownloadUrl(sessionId, filePath)
            if (res.signedUrl) window.open(res.signedUrl, '_blank')
            else console.error(res.error)
        } finally {
            setDownloadingPath(null)
        }
    }

    // Group history by question_id
    const groupedHistory: Record<string, MitigationHistoryEntry[]> = {}
    for (const entry of history) {
        if (!groupedHistory[entry.question_id]) groupedHistory[entry.question_id] = []
        groupedHistory[entry.question_id].push(entry)
    }

    // Sort each group by date descending (newest first)
    for (const qId of Object.keys(groupedHistory)) {
        groupedHistory[qId].sort((a, b) => new Date(b.mitigated_at).getTime() - new Date(a.mitigated_at).getTime())
    }

    const questionIds = Object.keys(groupedHistory)
    const mitigationCount = history.length
    const lastMitigationDate = history.length > 0
        ? new Date(Math.max(...history.map(h => new Date(h.mitigated_at).getTime()))).toLocaleDateString('it-IT', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
        : ''

    const toggleQuestion = (qId: string) => {
        setExpandedQuestions(prev => ({ ...prev, [qId]: !prev[qId] }))
    }

    const getAnswerLabel = (qId: string, rawAnswer: string | null): string => {
        if (!rawAnswer) return '—'
        const meta = questionLabelsMap[qId]
        if (!meta) return rawAnswer
        const n = rawAnswer.trim().toLowerCase()
        if (!n) return '—'
        const key = Object.keys(meta.labels).find((k) => k.toLowerCase() === n)
        return key ? meta.labels[key] : rawAnswer
    }

    const getRiskIndex = (qId: string, rawAnswer: string | null): number => {
        if (!rawAnswer) return 0
        const meta = questionLabelsMap[qId]
        if (!meta) return 0
        const n = rawAnswer.trim().toLowerCase()
        if (!n) return 0
        const key = Object.keys(meta.lookup).find((k) => k.toLowerCase() === n)
        return key != null ? (meta.lookup[key] ?? 0) : 0
    }

    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-10">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 to-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Clock className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#3d2b1a]">Storico Mitigazioni</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Mitigazione eseguita {mitigationCount} {mitigationCount === 1 ? 'volta' : 'volte'} • Ultima: {lastMitigationDate}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card per ogni domanda mitigata */}
            <div className="divide-y divide-slate-100">
                {questionIds.map(qId => {
                    const entries = groupedHistory[qId]
                    const meta = questionLabelsMap[qId]
                    const currentDetail = currentDetails.find(d => d.questionId === qId)
                    const isExpanded = expandedQuestions[qId] ?? false

                    return (
                        <div key={qId} className="px-6 py-4">
                            {/* Question header - clickable */}
                            <button
                                onClick={() => toggleQuestion(qId)}
                                className="w-full flex items-center justify-between text-left group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 group-hover:text-[#967635] transition-colors">
                                        {meta?.shortLabel || currentDetail?.shortLabel || 'Domanda'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                        {meta?.label || currentDetail?.label || qId}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                    {/* Current answer badge */}
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-200">
                                        Attuale: {currentDetail?.answerLabel || getAnswerLabel(qId, entries[0]?.new_answer)}
                                    </span>
                                    <span className="text-xs text-slate-400">{entries.length} {entries.length === 1 ? 'modifica' : 'modifiche'}</span>
                                    <div className="p-1 rounded-full bg-slate-100 text-slate-500">
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                </div>
                            </button>

                            {/* Timeline */}
                            {isExpanded && (
                                <div className="mt-4 ml-2 pl-4 border-l-2 border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {/* Current (attuale) */}
                                    <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                                        <div className="p-3 rounded-lg bg-green-50/50 border border-green-100">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Attuale</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-medium text-slate-700">{currentDetail?.answerLabel || '—'}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${(currentDetail?.riskIndex ?? 0) <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {currentDetail?.riskIndex.toFixed(2) ?? '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Historical entries */}
                                    {entries.map((entry, idx) => {
                                        const version = `V${entries.length - idx}`
                                        const prevLabel = getAnswerLabel(qId, entry.previous_answer)
                                        const newLabel = getAnswerLabel(qId, entry.new_answer)
                                        const prevRisk = getRiskIndex(qId, entry.previous_answer)
                                        const newRisk = getRiskIndex(qId, entry.new_answer)

                                        return (
                                            <div key={entry.id} className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">{version}</span>
                                                        <span className="text-[11px] text-slate-400">
                                                            {new Date(entry.mitigated_at).toLocaleDateString('it-IT', {
                                                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="text-slate-500">{prevLabel}</span>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${prevRisk <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {prevRisk.toFixed(2)}
                                                        </span>
                                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                                        <span className="font-medium text-slate-700">{newLabel}</span>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${newRisk <= 0.30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {newRisk.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {entry.comment && (
                                                        <p className="mt-2 text-xs text-slate-600 italic border-t border-slate-100 pt-2">
                                                            {entry.comment}
                                                        </p>
                                                    )}
                                                    {entry.file_path && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownload(entry.file_path!)}
                                                            disabled={downloadingPath === entry.file_path}
                                                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-medium"
                                                        >
                                                            {downloadingPath === entry.file_path ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                                            <FileText className="w-3 h-3" />
                                                            Scarica file allegato
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
