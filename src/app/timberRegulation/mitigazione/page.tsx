import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert, ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"

import { calculateRisk, RISK_THRESHOLD, SCORED_QUESTIONS, getLabelForRaw } from "@/lib/risk-calculator"
import { MitigationForm } from "@/components/MitigationForm"

export default async function MitigazionePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const sessionId = params.session_id as string | undefined

    const cookieStore = await cookies()
    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { role } = await getToolAccess(TIMBER_TOOL_ID)
    if (!role || role === 'standard') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="p-4 bg-amber-50 rounded-full">
                    <ShieldAlert className="w-12 h-12 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Accesso Limitato</h1>
                <p className="text-slate-600 max-w-md">La mitigazione è disponibile solo per utenti Premium o Admin.</p>
            </div>
        )
    }

    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
                <div className="p-4 bg-red-50 rounded-full">
                    <ShieldAlert className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Nessuna sessione selezionata</h2>
            </div>
        )
    }

    // 1. Fetch session
    const { data: session } = await supabase
        .from('assessment_sessions')
        .select('id, user_id, metadata, status')
        .eq('id', sessionId)
        .single()

    if (!session) return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
    // Solo il titolare può accedere alla pagina mitigazione (né admin né altri utenti)
    if (session.user_id !== user.id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 p-8">
                <Shield className="w-12 h-12 text-amber-600" />
                <h2 className="text-xl font-bold text-slate-800">Solo il titolare dell&apos;analisi può inserire le mitigazioni</h2>
                <p className="text-slate-600 max-w-md">Questa analisi è di un altro utente. Le mitigazioni possono essere salvate solo dal titolare.</p>
                <Link href={`/timberRegulation/risultato?session_id=${sessionId}`} className="text-blue-600 hover:underline">Torna al risultato</Link>
            </div>
        )
    }

    const metadata = session.metadata as Record<string, unknown> | null
    const nomeOperazione = (metadata?.nome_operazione as string) || 'Analisi Finale'

    // 2. Fetch responses
    const { data: responses } = await supabase
        .from('user_responses')
        .select('question_id, answer_text')
        .eq('session_id', sessionId)

    const answersMap: Record<string, string | null> = {}
    for (const r of (responses || [])) {
        answersMap[r.question_id] = r.answer_text
    }

    // 3. Calculate risk and find failing questions
    const result = calculateRisk(answersMap)
    const failingDetails = result.details.filter(d => d.riskIndex > RISK_THRESHOLD)

    if (failingDetails.length === 0) {
        redirect(`/timberRegulation/risultato?session_id=${sessionId}`)
    }

    // 4. Fetch question config for file_upload_enabled
    const questionIds = failingDetails.map(d => d.questionId)
    const { data: questionsData } = await supabase
        .from('questions')
        .select('id, config')
        .in('id', questionIds)

    const fileRequiredByQuestion = new Map<string, boolean>()
    for (const q of questionsData || []) {
        const config = q.config as { file_upload_enabled?: boolean } | null
        fileRequiredByQuestion.set(q.id, config?.file_upload_enabled !== false)
    }

    // 5. Build failing question data for the form
    const failingQuestions = failingDetails.map(d => {
        const scoredQ = SCORED_QUESTIONS.find(sq => sq.id === d.questionId)!
        const options = Object.entries(scoredQ.lookup).map(([value, riskIndex]) => ({
            value,
            label: scoredQ.labels[value] ?? value,
            riskIndex,
        }))

        // Determine input type: si/no questions → toggle, everything else → select
        const isBooleanType = Object.keys(scoredQ.lookup).every(k => ['si', 'no'].includes(k))

        return {
            questionId: d.questionId,
            label: d.label,
            shortLabel: d.shortLabel,
            currentAnswer: d.answerRaw,
            currentAnswerLabel: d.answerLabel,
            riskIndex: d.riskIndex,
            options,
            inputType: isBooleanType ? 'toggle' as const : 'select' as const,
            requiresFile: fileRequiredByQuestion.get(d.questionId) ?? false,
        }
    })

    // 6. Fetch mitigation history (with comment, file_path; sorted by mitigated_at desc)
    let mitigationHistory: { id: string; question_id: string; previous_answer: string | null; new_answer: string; mitigated_at: string; previous_label?: string; new_label?: string; comment?: string | null; file_path?: string | null }[] = []
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: historyData } = await (supabase as any)
            .from('mitigation_history')
            .select('id, question_id, previous_answer, new_answer, mitigated_at, comment, file_path')
            .eq('session_id', sessionId)
            .order('mitigated_at', { ascending: false }) as { data: { id: string; question_id: string; previous_answer: string | null; new_answer: string; mitigated_at: string; comment?: string | null; file_path?: string | null }[] | null }

        if (historyData) {
            mitigationHistory = historyData.map((h) => {
                const scoredQ = SCORED_QUESTIONS.find((sq) => sq.id === h.question_id)
                return {
                    ...h,
                    previous_label: scoredQ ? getLabelForRaw(scoredQ.labels, h.previous_answer) : (h.previous_answer ?? '—'),
                    new_label: scoredQ ? getLabelForRaw(scoredQ.labels, h.new_answer) : h.new_answer,
                    comment: h.comment ?? null,
                    file_path: h.file_path ?? null,
                }
            })
        }
    } catch {
        // Table might not exist yet
    }

    const mitigationCount = mitigationHistory.length > 0
        ? new Set(mitigationHistory.map(h => h.mitigated_at.split('T')[0])).size
        : 0

    return (
        <div className="max-w-4xl mx-auto px-4 pb-16">

            {/* Back link */}
            <Link
                href={`/timberRegulation/risultato?session_id=${sessionId}`}
                className="inline-flex items-center gap-1.5 text-sm text-[#967635] hover:text-[#7a5f2a] font-medium mt-6 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Torna ai risultati
            </Link>

            {/* Hero header */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-red-200/50 bg-gradient-to-br from-red-50/70 via-white to-orange-50/30 p-8 mb-10 shadow-sm">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-red-500/5 to-transparent rounded-bl-full" />

                <div className="relative flex items-start gap-5">
                    <div className="flex-shrink-0 p-3 bg-gradient-to-br from-red-500 to-red-700 rounded-xl shadow-md">
                        <Shield className="w-7 h-7 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">
                            Mitigazione Rischio
                        </p>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                            Azioni di Mitigazione
                        </h1>
                        {nomeOperazione && (
                            <p className="mt-1 text-[#967635] font-semibold text-sm md:text-base truncate">
                                {nomeOperazione}
                            </p>
                        )}
                        <p className="mt-2 text-slate-500 text-sm leading-relaxed max-w-2xl">
                            {failingQuestions.length} {failingQuestions.length === 1 ? 'criterio richiede' : 'criteri richiedono'} mitigazione.
                            Aggiorna le risposte per ridurre il livello di rischio sotto la soglia di {RISK_THRESHOLD.toFixed(2)}.
                        </p>

                        {mitigationCount > 0 && (
                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/60 text-amber-800 text-xs font-medium border border-amber-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {mitigationCount} {mitigationCount === 1 ? 'mitigazione precedente' : 'mitigazioni precedenti'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mitigation form */}
            <MitigationForm
                sessionId={sessionId}
                failingQuestions={failingQuestions}
                history={mitigationHistory}
            />

        </div>
    )
}
