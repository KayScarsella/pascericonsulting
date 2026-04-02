'use client'

import { useState } from "react"
import { Upload, FileText, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { uploadQuestionAttachment, deleteQuestionAttachment } from "@/actions/questions"

interface ResponseUploaderProps {
  currentPath: string | null 
  toolId: string
  sessionId: string 
  questionId: string
  onUploadComplete: (path: string | null) => void
  readOnly?: boolean 
}

export function ResponseUploader({ 
  currentPath, 
  toolId, 
  sessionId, 
  questionId, 
  onUploadComplete, 
  readOnly 
}: ResponseUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 🛠️ BEST PRACTICE: Validazione Client-Side del File
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
        toast.error("Il file è troppo grande. Dimensione massima consentita: 10MB.");
        e.target.value = ''; // Reset input
        return;
    }

    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
    ];
    if (!allowedTypes.includes(file.type) && file.type !== '') {
        toast.warning("Formato file potenzialmente non supportato. Consigliati: PDF, Immagini, Word.");
    }

    setIsUploading(true)
    const toastId = toast.loading("Caricamento file...")

    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const result = await uploadQuestionAttachment(formData, toolId, sessionId, questionId)
      
      if (result.success && result.path) {
          onUploadComplete(result.path) 
          toast.success("File caricato con successo", { id: toastId })
      } else {
          toast.error("Errore: " + result.error, { id: toastId })
      }
    } catch (err) {
      toast.error("Errore di rete durante l'upload", { id: toastId })
    } finally {
      setIsUploading(false)
      e.target.value = '' 
    }
  }

  const handleDelete = async () => {
    if (!confirm("Vuoi davvero eliminare questo allegato?")) return

    setIsDeleting(true)
    const toastId = toast.loading("Eliminazione in corso...")

    try {
      const result = await deleteQuestionAttachment(toolId, sessionId, questionId)

      if (result.success) {
        onUploadComplete(null) 
        toast.success("File rimosso", { id: toastId })
      } else {
        toast.error("Errore eliminazione: " + result.error, { id: toastId })
      }
    } catch (err) {
      toast.error("Errore imprevisto", { id: toastId })
    } finally {
      setIsDeleting(false)
    }
  }

  if (currentPath) {
    return (
      <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md text-sm w-full group/file">
        <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="truncate flex-1 text-slate-700 text-xs font-medium" title={currentPath}>
          {currentPath.split('/').pop()?.replace(/^\d+_/, '')} 
        </span>
        
        {!readOnly && (
          <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50" 
              onClick={handleDelete}
              disabled={isDeleting}
          >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </Button>
        )}
      </div>
    )
  }

  if (readOnly) {
    return (
        <div className="w-full text-center py-2">
            <span className="text-xs text-slate-400 italic">Nessun file allegato</span>
        </div>
    )
  }

  return (
    <div className="relative w-full">
      <input 
        type="file" 
        className="absolute inset-0 opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
        onChange={handleUpload} 
        disabled={isUploading} 
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt" // 🛠️ Aggiunti hint di accettazione file
      />
      <Button 
        variant="outline" 
        size="sm" 
        className={cn(
            "w-full gap-2 text-xs border-slate-200 text-slate-600 hover:text-[#967635] hover:border-amber-200 hover:bg-amber-50", 
            isUploading && "opacity-70"
        )}
      >
        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        <span className="sr-only sm:not-sr-only">
            {isUploading ? 'Caricamento...' : 'Allega File'}
        </span>
      </Button>
    </div>
  )
}