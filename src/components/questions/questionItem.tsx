'use client'

import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { QuestionWithConfig, QuestionType } from "@/types/questions"
// 🛠️ Importiamo i tipi esatti da dynamicInput per evitare any e unknown
import { DynamicInput, AnswerValue, RepeaterConfig } from "./dynamicInput"
import { ResponseUploader } from "./FileUploader"

const NOTE_QUESTION_ID = "c8d9e0f1-a2b3-4c4d-9e5f-6a7b8c9d0e92"

interface QuestionItemProps {
  question: QuestionWithConfig
  value: AnswerValue
  filePath: string | null
  toolId: string
  sessionId: string
  onAnswerChange: (value: AnswerValue) => void
  onFileChange: (path: string | null) => void
  onExtraChange?: (extraData: Record<string, unknown> | null) => void
  readOnly?: boolean
  /** Optional: lock just the input (keep upload active) */
  inputReadOnly?: boolean
  /** Optional: lock just the uploader */
  uploadReadOnly?: boolean
  /** Optional: render a static display instead of DynamicInput */
  staticDisplayText?: string | null
}

export function QuestionItem({
  question,
  value,
  filePath,
  toolId,
  sessionId,
  onAnswerChange,
  onFileChange,
  onExtraChange,
  readOnly = false
  ,
  inputReadOnly,
  uploadReadOnly,
  staticDisplayText = null
}: QuestionItemProps) {

  const effectiveInputReadOnly = inputReadOnly ?? readOnly
  const effectiveUploadReadOnly = uploadReadOnly ?? readOnly

  const isAnswered =
    (value !== null &&
      value !== undefined &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0)) ||
    filePath !== null
  
  // Cast sicuro al tipo RepeaterConfig che include le proprietà base di QuestionConfig
  const typedConfig = question.config as RepeaterConfig
  const noteText = null

  // ── REPEATER LAYOUT ──────────────────────────────────────
  if (question.type === 'repeater') {
    return (
      <div className={cn(
        "group flex flex-col gap-6 p-6 md:p-8 rounded-xl border-2 transition-all duration-300 question-card",
        isAnswered
          ? "bg-gradient-to-br from-white to-[#f8f5ef]/50 border-[#967635]/30 shadow-sm"
          : "bg-[#faf9f6] border-[#e8dcc8] hover:border-[#c9a55a]/50",
        readOnly && "opacity-85"
      )}>

        <div className="flex flex-col items-center justify-center text-center space-y-2 pb-6 border-b border-[#e8dcc8]/60">
          <div className="flex items-center gap-3">
            {isAnswered
              ? <CheckCircle2 className="w-6 h-6 text-[#4a7c2e]" />
              : <Circle className="w-6 h-6 text-[#c9a55a]/40" />
            }
            <h3 className="font-bold text-[#3d2b1a] text-lg md:text-xl">
              {question.text}
            </h3>
          </div>
          {typedConfig.placeholder && (
            <p className="text-sm text-[#7a5f2a]/60 max-w-xl">{typedConfig.placeholder}</p>
          )}
          {noteText && (
            <p className="text-sm text-slate-600 max-w-xl italic">{noteText}</p>
          )}
        </div>

        <div className="w-full">
          {staticDisplayText ? (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {staticDisplayText}
            </div>
          ) : (
            <DynamicInput
              type={question.type as QuestionType | "supplier_manager"}
              config={typedConfig}
              value={value}
              onChange={onAnswerChange}
              onExtraChange={onExtraChange}
              readOnly={effectiveInputReadOnly}
              toolId={toolId}
            />
          )}
        </div>

      </div>
    )
  }

  // ── SUPPLIER MANAGER LAYOUT (A TUTTA LARGHEZZA) ──────────
  if (question.type === 'supplier_manager') {
    return (
      <div className={cn(
        "group flex flex-col gap-5 p-5 md:p-6 rounded-xl border transition-all duration-300 question-card",
        isAnswered
          ? "bg-gradient-to-br from-white to-[#f8f5ef]/50 border-[#967635]/30 shadow-sm"
          : "bg-[#faf9f6] border-[#e8dcc8] hover:border-[#c9a55a]/50",
        readOnly && "opacity-85"
      )}>
        
        {/* Label in alto, a tutta larghezza */}
        <div className="flex flex-col gap-1 pb-4 border-b border-[#e8dcc8]/60">
          <div className="flex items-center gap-3">
            {isAnswered
              ? <CheckCircle2 className="w-6 h-6 text-[#4a7c2e]" />
              : <Circle className="w-6 h-6 text-[#c9a55a]/40" />
            }
            <h3 className="font-bold text-[#3d2b1a] text-lg">
              {question.text}
            </h3>
          </div>
          {typedConfig.placeholder && (
            <p className="text-sm text-[#7a5f2a]/60 ml-9">{typedConfig.placeholder}</p>
          )}
          {noteText && (
            <p className="text-sm text-slate-600 ml-9 italic">{noteText}</p>
          )}
        </div>

        {/* Input Manager Fornitore che ora può espandersi liberamente */}
        <div className="w-full pt-2">
          <DynamicInput
            type={question.type as QuestionType | 'supplier_manager'}
            config={typedConfig}
            value={value}
            onChange={onAnswerChange}
            onExtraChange={onExtraChange}
            readOnly={readOnly}
            toolId={toolId}
          />
        </div>

        {/* File upload (se abilitato per questa domanda) */}
        {typedConfig.file_upload_enabled !== false && !staticDisplayText && (
          <div className="flex justify-end border-t border-[#e8dcc8]/50 pt-4 mt-2">
            <div className="w-full md:w-1/3">
              <ResponseUploader
                currentPath={filePath}
                toolId={toolId}
                sessionId={sessionId}
                questionId={question.id}
                onUploadComplete={onFileChange}
                readOnly={effectiveUploadReadOnly}
              />
            </div>
          </div>
        )}

      </div>
    )
  }

  // ── STANDARD QUESTION LAYOUT (A DUE COLONNE) ─────────────
  return (
    <div className={cn(
      "group grid grid-cols-1 md:grid-cols-12 gap-4 p-4 md:p-5 rounded-xl border transition-all duration-300 question-card",
      isAnswered
        ? "bg-gradient-to-r from-white to-[#f8f5ef]/40 border-[#967635]/25 shadow-sm"
        : "bg-[#faf9f6] border-[#e8dcc8] hover:border-[#c9a55a]/50 hover:bg-white/80",
      readOnly && "opacity-85"
    )}>

      {/* Label (Colonna di sinistra) */}
      <div className="md:col-span-5 flex gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {isAnswered
            ? <CheckCircle2 className="w-5 h-5 text-[#4a7c2e]" />
            : <Circle className="w-5 h-5 text-[#c9a55a]/40" />
          }
        </div>
        <div>
          <p className="font-medium text-[#3d2b1a] text-sm leading-relaxed">
            {question.text}
          </p>
          {typedConfig.placeholder && (
            <p className="text-xs text-[#7a5f2a]/50 mt-1">{typedConfig.placeholder}</p>
          )}
          {noteText && (
            <p className="text-xs text-slate-600 mt-2 italic">{noteText}</p>
          )}
        </div>
      </div>

      {/* Input (Colonna centrale/destra) */}
      <div className="md:col-span-5 flex items-start flex-col justify-center relative">
        {staticDisplayText ? (
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {staticDisplayText}
          </div>
        ) : (
          <DynamicInput
            type={question.type as QuestionType | "supplier_manager"}
            config={typedConfig}
            value={value}
            onChange={onAnswerChange}
            onExtraChange={onExtraChange}
            readOnly={effectiveInputReadOnly}
            toolId={toolId}
          />
        )}
      </div>

      {/* File upload (Colonna più a destra) */}
      <div className="md:col-span-2 flex items-center justify-end md:justify-center border-t md:border-t-0 md:border-l border-[#e8dcc8]/50 pt-4 md:pt-0 pl-0 md:pl-4">
        {typedConfig.file_upload_enabled !== false && !staticDisplayText && (
          <ResponseUploader
            currentPath={filePath}
            toolId={toolId}
            sessionId={sessionId}
            questionId={question.id}
            onUploadComplete={onFileChange}
            readOnly={effectiveUploadReadOnly}
          />
        )}
      </div>

    </div>
  )
}