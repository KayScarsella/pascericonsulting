'use client'

import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { QuestionWithConfig, QuestionType } from "@/types/questions" 
import { DynamicInput } from "./dynamicInput"
import { ResponseUploader } from "./FileUploader"

interface QuestionItemProps {
  question: QuestionWithConfig
  value: string | number | null | unknown 
  filePath: string | null
  toolId: string
  sessionId: string // 🛠️ NUOVO: Aggiunto sessionId
  onAnswerChange: (value: string | number | null | unknown) => void 
  onFileChange: (path: string | null) => void
  onExtraChange?: (extraData: Record<string, unknown> | null) => void 
  readOnly?: boolean
}

export function QuestionItem({ 
  question, 
  value, 
  filePath, 
  toolId, 
  sessionId, // 🛠️ RICEZIONE PROP
  onAnswerChange, 
  onFileChange,
  onExtraChange,
  readOnly = false 
}: QuestionItemProps) {
  
  const isAnswered = (value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) || filePath !== null

  if (question.type === 'repeater') {
    return (
      <div className={cn(
          "group flex flex-col gap-6 p-6 md:p-8 rounded-xl border transition-all duration-200",
          isAnswered ? "bg-white border-amber-200 shadow-sm" : "bg-slate-50 border-slate-200 hover:border-slate-300",
          readOnly && "opacity-90 bg-slate-50/50"
      )}>
        
        <div className="flex flex-col items-center justify-center text-center space-y-2 pb-6 border-b border-slate-200/60">
            <div className="flex items-center gap-3">
                {isAnswered ? <CheckCircle2 className="w-6 h-6 text-[#967635]" /> : <Circle className="w-6 h-6 text-slate-300" />}
                <h3 className="font-bold text-slate-900 text-lg md:text-xl">{question.text}</h3>
            </div>
            {question.config.placeholder && (
                <p className="text-sm text-slate-500 max-w-xl">{question.config.placeholder}</p>
            )}
        </div>

        <div className="w-full">
           <DynamicInput 
              type={question.type as QuestionType} 
              config={question.config} 
              value={value as string | number | null} 
              onChange={onAnswerChange}
              onExtraChange={onExtraChange} 
              readOnly={readOnly}
           />
        </div>

      </div>
    )
  }

  return (
    <div className={cn(
        "group grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-lg border transition-all duration-200",
        isAnswered ? "bg-white border-amber-200 shadow-sm" : "bg-slate-50 border-slate-200 hover:border-slate-300",
        readOnly && "opacity-90 bg-slate-50/50"
    )}>
      
      <div className="md:col-span-5 flex gap-3">
        <div className="mt-1 flex-shrink-0">
            {isAnswered ? <CheckCircle2 className="w-5 h-5 text-[#967635]" /> : <Circle className="w-5 h-5 text-slate-300" />}
        </div>
        <div>
            <p className="font-medium text-slate-900 text-sm">{question.text}</p>
            {question.config.placeholder && (
                <p className="text-xs text-slate-500 mt-1">{question.config.placeholder}</p>
            )}
        </div>
      </div>

      <div className="md:col-span-5 flex items-start flex-col justify-center relative">
         <DynamicInput 
            type={question.type as QuestionType} 
            config={question.config} 
            value={value as string | number | null} 
            onChange={onAnswerChange}
            onExtraChange={onExtraChange} 
            readOnly={readOnly}
         />
      </div>

      <div className="md:col-span-2 flex items-center justify-end md:justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 pl-0 md:pl-4">
        {question.config.file_upload_enabled !== false && (
             <ResponseUploader 
                currentPath={filePath}
                toolId={toolId}
                sessionId={sessionId} // 🛠️ PASSAGGIO DELLA PROP ALL'UPLOADER
                questionId={question.id}
                onUploadComplete={onFileChange}
                readOnly={readOnly} 
             />
        )}
      </div>

    </div>
  )
}