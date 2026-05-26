"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Lock, Users } from "lucide-react"
import { toast } from "sonner"

import { createFolder, updateFolderMinRole } from "@/actions/documents"
import type { DocumentMinRole } from "@/lib/tool-role-access"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type FolderAccessDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  toolId: string
  pathRevalidate: string
  parentFolderId: string | null
  /** Se la cartella corrente (parent) è premium, i figli non possono essere "tutti". */
  parentIsPremium?: boolean
  folderId?: string
  initialName?: string
  initialMinRole?: DocumentMinRole
}

export function FolderAccessDialog({
  open,
  onOpenChange,
  mode,
  toolId,
  pathRevalidate,
  parentFolderId,
  parentIsPremium = false,
  folderId,
  initialName = "",
  initialMinRole = "standard",
}: FolderAccessDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [minRole, setMinRole] = useState<DocumentMinRole>(initialMinRole)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(mode === "edit" ? initialName : "")
    setMinRole(parentIsPremium ? "premium" : initialMinRole)
  }, [open, mode, initialName, initialMinRole, parentIsPremium])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (mode === "create" && !trimmed) {
      toast.error("Inserisci un nome per la cartella")
      return
    }

    setIsSaving(true)
    try {
      if (mode === "create") {
        const result = await createFolder(
          toolId,
          parentFolderId,
          trimmed,
          pathRevalidate,
          minRole
        )
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Cartella creata")
      } else {
        if (!folderId) return
        const result = await updateFolderMinRole(
          folderId,
          toolId,
          minRole,
          pathRevalidate
        )
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Visibilità aggiornata")
      }

      onOpenChange(false)
      router.refresh()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuova cartella" : "Visibilità cartella"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Scegli nome e chi può vedere questa cartella e i suoi contenuti."
              : `Modifica chi può accedere a «${initialName}» e al contenuto al suo interno.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nome cartella</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Modelli DDS, Guide operative…"
                autoFocus
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Chi può visualizzare</Label>
            {parentIsPremium && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                La cartella padre è riservata ai Premium: anche questa cartella sarà
                visibile solo a Premium e Admin.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-1">
              <AccessOption
                selected={minRole === "standard"}
                disabled={parentIsPremium}
                icon={<Users className="h-5 w-5 text-slate-600" />}
                title="Tutti gli utenti"
                description="Standard, Premium e Admin possono aprire e scaricare i file."
                onClick={() => setMinRole("standard")}
              />
              <AccessOption
                selected={minRole === "premium"}
                icon={<Lock className="h-5 w-5 text-amber-700" />}
                title="Solo Premium"
                description="Visibile solo a utenti Premium e Admin del tool."
                onClick={() => setMinRole("premium")}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annulla
          </Button>
          <Button
            className="bg-[#967635] hover:bg-[#856625]"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Salvataggio…" : mode === "create" ? "Crea cartella" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccessOption({
  selected,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean
  disabled?: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-[#967635] bg-amber-50/80 ring-1 ring-[#967635]/30"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-[#967635] bg-[#967635]" : "border-slate-300"
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-slate-900">{title}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </button>
  )
}
