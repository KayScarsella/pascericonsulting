"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Lock, Users, Wrench } from "lucide-react"
import { toast } from "sonner"

import { createFolder, updateFolderAllowedRoles } from "@/actions/documents"
import {
  DEFAULT_ALLOWED_ROLES,
  DOCUMENT_ACCESS_ROLES,
  normalizeAllowedRoles,
  type DocumentAccessRole,
} from "@/lib/tool-role-access"
import type { ToolRole } from "@/lib/tool-auth"
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
  /** Allowlist della cartella padre: i figli non possono ampliare. */
  parentAllowedRoles?: ToolRole[] | null
  folderId?: string
  initialName?: string
  initialAllowedRoles?: ToolRole[]
}

const ROLE_OPTIONS: {
  role: DocumentAccessRole
  icon: ReactNode
  title: string
  description: string
}[] = [
  {
    role: "standard",
    icon: <Users className="h-5 w-5 text-slate-600" />,
    title: "Standard",
    description: "Utenti con ruolo standard.",
  },
  {
    role: "tool",
    icon: <Wrench className="h-5 w-5 text-slate-600" />,
    title: "Tool",
    description: "Utenti con ruolo tool (accesso completo al tool, cartelle selezionate).",
  },
  {
    role: "premium",
    icon: <Lock className="h-5 w-5 text-amber-700" />,
    title: "Premium",
    description: "Utenti Premium (Admin ha sempre accesso).",
  },
]

export function FolderAccessDialog({
  open,
  onOpenChange,
  mode,
  toolId,
  pathRevalidate,
  parentFolderId,
  parentAllowedRoles = null,
  folderId,
  initialName = "",
  initialAllowedRoles = DEFAULT_ALLOWED_ROLES,
}: FolderAccessDialogProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [selected, setSelected] = useState<Set<DocumentAccessRole>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const parentSet =
    parentAllowedRoles && parentAllowedRoles.length > 0
      ? new Set(parentAllowedRoles.filter((r) => r !== "admin") as DocumentAccessRole[])
      : null

  useEffect(() => {
    if (!open) return
    setName(mode === "edit" ? initialName : "")
    const base = normalizeAllowedRoles(initialAllowedRoles).filter(
      (r): r is DocumentAccessRole => DOCUMENT_ACCESS_ROLES.includes(r as DocumentAccessRole)
    )
    const next = new Set(base)
    if (parentSet) {
      for (const r of DOCUMENT_ACCESS_ROLES) {
        if (!parentSet.has(r)) next.delete(r)
      }
    }
    setSelected(next.size ? next : new Set(parentSet ? [...parentSet] : ["premium"]))
  }, [open, mode, initialName, initialAllowedRoles, parentAllowedRoles])

  const toggle = (role: DocumentAccessRole) => {
    if (parentSet && !parentSet.has(role)) return
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(role)) n.delete(role)
      else n.add(role)
      return n
    })
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (mode === "create" && !trimmed) {
      toast.error("Inserisci un nome per la cartella")
      return
    }
    if (selected.size === 0) {
      toast.error("Seleziona almeno un ruolo (oltre ad Admin, sempre incluso)")
      return
    }

    const allowedRoles = normalizeAllowedRoles([...selected, "admin"]) as ToolRole[]

    setIsSaving(true)
    try {
      if (mode === "create") {
        const result = await createFolder(
          toolId,
          parentFolderId,
          trimmed,
          pathRevalidate,
          allowedRoles
        )
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Cartella creata")
      } else {
        if (!folderId) return
        const result = await updateFolderAllowedRoles(
          folderId,
          toolId,
          allowedRoles,
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
              ? "Scegli nome e quali ruoli possono vedere questa cartella e i suoi contenuti. Admin ha sempre accesso."
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
            {parentSet && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                La cartella padre limita i ruoli disponibili: non puoi ampliare l&apos;accesso oltre
                il padre.
              </p>
            )}
            <div className="grid gap-2">
              {ROLE_OPTIONS.map((opt) => {
                const disabled = !!(parentSet && !parentSet.has(opt.role))
                const checked = selected.has(opt.role)
                return (
                  <AccessOption
                    key={opt.role}
                    selected={checked}
                    disabled={disabled}
                    icon={opt.icon}
                    title={opt.title}
                    description={opt.description}
                    onClick={() => toggle(opt.role)}
                  />
                )
              })}
            </div>
            <p className="text-xs text-slate-500">Admin del tool ha sempre accesso.</p>
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
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          selected ? "border-[#967635] bg-[#967635]" : "border-slate-300"
        )}
      >
        {selected && (
          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M2.5 6.5L5 9l4.5-5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
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
