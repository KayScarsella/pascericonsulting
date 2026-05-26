'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Folder, FileText, Download, Upload, Plus, ArrowLeft, Trash2, Loader2, Lock, Shield } from "lucide-react"
import type { ToolRole } from "@/lib/tool-auth"
import { canAccessMinRole, type DocumentMinRole } from "@/lib/tool-role-access"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FolderAccessDialog } from "@/components/documents/FolderAccessDialog"
import { PremiumFolderUpsell } from "@/components/documents/PremiumFolderUpsell"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import {
  abortDocumentUpload,
  deleteItem,
  finalizeDocumentUpload,
  getDownloadUrl,
  getDownloadUrls,
  prepareDocumentUpload,
} from "@/actions/documents"
import { uploadDocumentWithProgress } from "@/lib/documents-upload-client"
import { validateDocumentFileMetadata } from "@/lib/documents-upload"
import { Database } from "@/types/supabase"

// Tipo derivato direttamente dal DB
export type DocItem = Database['public']['Tables']['documents']['Row']

interface FileExplorerProps {
  items: DocItem[]
  currentFolderId: string | null
  parentFolderId: string | null
  isAdmin: boolean
  userRole: ToolRole
  toolId: string
  pathRevalidate: string
  /** Cartella corrente (parent dei nuovi elementi) è premium → i figli ereditano. */
  parentIsPremium?: boolean
  /** Prefetch server-side (batch signed URLs, TTL 5 min). */
  downloadUrls?: Record<string, string>
}

export function FileExplorer({
  items,
  currentFolderId,
  parentFolderId,
  isAdmin,
  userRole,
  toolId,
  pathRevalidate,
  parentIsPremium = false,
  downloadUrls = {},
}: FileExplorerProps) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editFolder, setEditFolder] = useState<{
    id: string
    name: string
    minRole: DocumentMinRole
  } | null>(null)
  const [premiumUpsellFolder, setPremiumUpsellFolder] = useState<{
    id: string
    name: string
  } | null>(null)

  const isPremiumFolderLocked = (item: DocItem) =>
    item.type === "folder" &&
    (item.min_role ?? "standard") === "premium" &&
    !canAccessMinRole(userRole, "premium")

  // --- DOWNLOAD ---
  const triggerDownload = (signedUrl: string, filename: string) => {
    const link = document.createElement("a")
    link.href = signedUrl
    link.setAttribute("download", filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleDownload = async (path: string | null, filename: string) => {
    if (!path) return
    const prefetched = downloadUrls[path]
    if (prefetched) {
      triggerDownload(prefetched, filename)
      return
    }

    setIsDownloading(path)
    try {
      const { signedUrl, error } = await getDownloadUrl(path, toolId)
      if (error) {
        alert("Errore download: " + error)
        return
      }
      if (signedUrl) triggerDownload(signedUrl, filename)
    } catch (e) {
      console.error(e)
      alert("Errore imprevisto")
    } finally {
      setIsDownloading(null)
    }
  }

  const handleDownloadAll = async () => {
    const files = items.filter((i) => i.type === "file" && i.storage_path)
    if (files.length === 0) return

    setIsDownloading("__all__")
    try {
      const paths = files.map((f) => f.storage_path as string)
      const missing = paths.filter((p) => !downloadUrls[p])
      let urlMap = { ...downloadUrls }

      if (missing.length > 0) {
        const { urls, error } = await getDownloadUrls(missing, toolId)
        if (error) {
          alert("Errore download: " + error)
          return
        }
        urlMap = { ...urlMap, ...urls }
      }

      for (const file of files) {
        const url = urlMap[file.storage_path as string]
        if (url) triggerDownload(url, file.name)
      }
    } catch (e) {
      console.error(e)
      alert("Errore imprevisto")
    } finally {
      setIsDownloading(null)
    }
  }

  // --- DELETE ---
  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo elemento?")) return
    setIsDeleting(id)
    
    // Passiamo toolId e pathRevalidate
    const result = await deleteItem(id, toolId, pathRevalidate)
    
    setIsDeleting(null)
    if (result?.error) alert("Errore: " + result.error)
  }

  // --- UPLOAD (client → Supabase Storage, server actions solo per auth + DB) ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const clientError = validateDocumentFileMetadata({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
    if (clientError) {
      toast.error(clientError)
      e.target.value = ""
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    const toastId = toast.loading(`Preparazione upload: ${file.name}`)

    let storagePath: string | null = null

    try {
      const prepared = await prepareDocumentUpload(toolId, file.name, file.size, file.type)
      if (prepared.error || !prepared.storagePath) {
        toast.error(prepared.error ?? "Preparazione upload fallita", { id: toastId })
        return
      }
      storagePath = prepared.storagePath

      toast.loading(`Caricamento ${file.name}… 0%`, { id: toastId })
      const uploadResult = await uploadDocumentWithProgress(storagePath, file, (percent) => {
        setUploadProgress(percent)
        toast.loading(`Caricamento ${file.name}… ${percent}%`, { id: toastId })
      })

      if (uploadResult.error) {
        await abortDocumentUpload(toolId, storagePath)
        toast.error(uploadResult.error, { id: toastId })
        return
      }

      toast.loading("Registrazione documento…", { id: toastId })
      const finalized = await finalizeDocumentUpload(
        toolId,
        currentFolderId,
        storagePath,
        file.name,
        file.type,
        file.size,
        pathRevalidate
      )

      if (finalized.error) {
        toast.error(finalized.error, { id: toastId })
        return
      }

      toast.success(`${file.name} caricato con successo`, { id: toastId })
      router.refresh()
    } catch (err) {
      console.error(err)
      if (storagePath) {
        await abortDocumentUpload(toolId, storagePath).catch(() => undefined)
      }
      toast.error("Errore imprevisto durante l'upload", { id: toastId })
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
      e.target.value = ""
    }
  }

  // --- NAVIGAZIONE ---
  const handleNavigate = (folderId: string | null) => {
    const url = folderId ? `${pathRevalidate}?folderId=${folderId}` : pathRevalidate
    router.push(url)
  }

  const handleFolderClick = (item: DocItem) => {
    if (item.type !== "folder") return
    if (isPremiumFolderLocked(item)) {
      setPremiumUpsellFolder({ id: item.id, name: item.name })
      return
    }
    handleNavigate(item.id)
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
           {currentFolderId ? (
             <Button variant="ghost" size="sm" onClick={() => handleNavigate(parentFolderId)}>
               <ArrowLeft className="w-4 h-4 mr-1" /> Indietro
             </Button>
           ) : (
             <span className="text-slate-500 font-medium px-2">Documenti /</span>
           )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.some((i) => i.type === "file") && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={isDownloading === "__all__"}
            >
              {isDownloading === "__all__" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Scarica tutti
            </Button>
          )}

          {isAdmin && (
            <>
            <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nuova Cartella
            </Button>
            
            <div className="relative">
                <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    onChange={handleUpload}
                    disabled={isUploading}
                />
                <Button size="sm" className="bg-[#967635] hover:bg-[#856625]" disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {isUploading ? 'Caricamento...' : 'Carica File'}
                </Button>
            </div>
            </>
          )}
        </div>
      </div>

      {isUploading && uploadProgress !== null && (
        <div className="border-b border-slate-100 bg-white px-4 py-2">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Upload in corso</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#967635] transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* LISTA OGGETTI */}
      <ul className="divide-y divide-slate-100 flex-1">
        {items.length === 0 && (
            <li className="p-12 text-center text-slate-400 flex flex-col items-center gap-2 justify-center h-full">
                <Folder className="w-12 h-12 text-slate-200" />
                <p>Cartella vuota</p>
            </li>
        )}

        {items.map((item) => {
          const lockedPremium = isPremiumFolderLocked(item)
          return (
          <li
            key={item.id}
            className={`p-4 flex items-center justify-between transition-colors group ${
              lockedPremium ? "bg-slate-50/80 hover:bg-amber-50/40" : "hover:bg-slate-50"
            }`}
          >
            <div
              className={`flex items-center gap-3 flex-1 select-none ${
                item.type === "folder" ? "cursor-pointer" : ""
              }`}
              onClick={() => item.type === "folder" && handleFolderClick(item)}
            >
              <div
                className={`p-2 rounded ${
                  lockedPremium
                    ? "bg-slate-100 text-slate-400"
                    : item.type === "folder"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-blue-50 text-blue-600"
                }`}
              >
                {item.type === "folder" ? (
                  lockedPremium ? <Lock className="w-5 h-5" /> : <Folder className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`font-medium ${
                      lockedPremium ? "text-slate-600" : "text-slate-900"
                    }`}
                  >
                    {item.name}
                  </p>
                  {item.type === "folder" && item.min_role === "premium" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <Lock className="h-3 w-3" />
                      Premium
                    </span>
                  )}
                </div>
                {lockedPremium && (
                  <p className="text-xs text-amber-700/90 mt-0.5">
                    Disponibile con account Premium — clicca per saperne di più
                  </p>
                )}
                {item.type === "file" && item.size && (
                  <p className="text-xs text-slate-500">{(item.size / 1024 / 1024).toFixed(2)} MB</p>
                )}
              </div>
            </div>

            {/* Azioni */}
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {item.type === 'file' && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Scarica" 
                    onClick={(e) => { e.stopPropagation(); handleDownload(item.storage_path, item.name); }}
                    disabled={isDownloading === item.storage_path}
                >
                    {isDownloading === item.storage_path ? (
                    <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : (
                    <Download className="w-4 h-4 text-slate-400 hover:text-[#967635]" />
                    )}
                </Button>
                )}

              {isAdmin && item.type === "folder" && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Visibilità cartella"
                  className="hover:bg-amber-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditFolder({
                      id: item.id,
                      name: item.name,
                      minRole: (item.min_role ?? "standard") as DocumentMinRole,
                    })
                  }}
                >
                  <Shield className="w-4 h-4 text-slate-400 hover:text-amber-700" />
                </Button>
              )}

              {isAdmin && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Elimina"
                    className="hover:bg-red-50"
                    disabled={isDeleting === item.id}
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                >
                  {isDeleting === item.id ? (
                      <Loader2 className="w-4 h-4 text-red-600 animate-spin" />
                  ) : (
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                  )}
                </Button>
              )}
            </div>
          </li>
        )})}
      </ul>

      <FolderAccessDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        toolId={toolId}
        pathRevalidate={pathRevalidate}
        parentFolderId={currentFolderId}
        parentIsPremium={parentIsPremium}
      />

      <Dialog
        open={!!premiumUpsellFolder}
        onOpenChange={(open) => !open && setPremiumUpsellFolder(null)}
      >
        <DialogContent className="sm:max-w-md">
          {premiumUpsellFolder && (
            <PremiumFolderUpsell
              folderName={premiumUpsellFolder.name}
              archivePath={pathRevalidate}
              variant="dialog"
            />
          )}
        </DialogContent>
      </Dialog>

      {editFolder && (
        <FolderAccessDialog
          open={!!editFolder}
          onOpenChange={(open) => !open && setEditFolder(null)}
          mode="edit"
          toolId={toolId}
          pathRevalidate={pathRevalidate}
          parentFolderId={currentFolderId}
          parentIsPremium={parentIsPremium}
          folderId={editFolder.id}
          initialName={editFolder.name}
          initialMinRole={editFolder.minRole}
        />
      )}
    </div>
  )
}