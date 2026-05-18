'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateSessionNome, type SessionNomeField } from '@/actions/session-metadata'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface EditableSessionNameProps {
  toolId: string
  sessionId: string
  field: SessionNomeField
  value?: string | null
  fallback?: string
  className?: string
}

export function EditableSessionName({
  toolId,
  sessionId,
  field,
  value,
  fallback = 'Operazione senza nome',
  className,
}: EditableSessionNameProps) {
  const router = useRouter()
  const display = (value && value.trim()) || fallback
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(display)
  const [saving, setSaving] = useState(false)

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(display === fallback ? '' : display)
    setEditing(true)
  }

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(display)
    setEditing(false)
  }

  const save = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const trimmed = draft.trim()
    if (!trimmed) {
      toast.error('Il nome non può essere vuoto')
      return
    }
    if (trimmed === display) {
      setEditing(false)
      return
    }

    setSaving(true)
    const res = await updateSessionNome(toolId, sessionId, field, trimmed)
    setSaving(false)

    if (!res.success) {
      toast.error(res.error ?? 'Impossibile salvare il nome')
      return
    }

    toast.success('Nome aggiornato')
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div
        className={cn('flex min-w-0 flex-col gap-1.5', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          className="h-auto min-h-9 py-1.5 text-sm font-medium text-slate-900"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save(e as unknown as React.MouseEvent)
            if (e.key === 'Escape') cancel(e as unknown as React.MouseEvent)
          }}
        />
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
            disabled={saving}
            onClick={save}
            aria-label="Salva nome"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-500 hover:bg-slate-100"
            disabled={saving}
            onClick={cancel}
            aria-label="Annulla"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('group flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-0.5', className)}
    >
      <span className="min-w-0 break-words font-medium text-slate-900">{display}</span>
      <button
        type="button"
        className="mt-0.5 inline-flex shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
        onClick={startEdit}
        aria-label="Modifica nome"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
