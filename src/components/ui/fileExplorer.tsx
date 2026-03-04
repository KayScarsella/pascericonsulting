'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Folder, FileText, Download, Upload, Plus, ArrowLeft, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
// Importiamo le actions aggiornate
import { createFolder, uploadFile, deleteItem, getDownloadUrl } from "@/actions/documents"
import { Database } from "@/types/supabase"

// Tipo derivato direttamente dal DB
export type DocItem = Database['public']['Tables']['documents']['Row']

interface FileExplorerProps {
  items: DocItem[] 
  currentFolderId: string | null
  parentFolderId: string | null
  isAdmin: boolean
  toolId: string        // ID del tool corrente (es. TIMBER, ALTRO)
  pathRevalidate: string // L'URL corrente della pagina (per ricaricare i dati)
}

export function FileExplorer({ 
  items, 
  currentFolderId, 
  parentFolderId, 
  isAdmin, 
  toolId,
  pathRevalidate 
}: FileExplorerProps) {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)

  // --- DOWNLOAD ---
  const handleDownload = async (path: string | null, filename: string) => {
    if (!path) return
    setIsDownloading(path)
    try {
      const { signedUrl, error } = await getDownloadUrl(path)
      if (error) {
        alert("Errore download: " + error)
        return
      }
      if (signedUrl) {
        const link = document.createElement('a')
        link.href = signedUrl
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        link.remove()
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

  // --- CREATE FOLDER ---
  const handleCreateFolder = async () => {
    const name = prompt("Nome cartella:")
    if (!name) return
    const result = await createFolder(toolId, currentFolderId, name, pathRevalidate)
    if (result?.error) alert("Errore: " + result.error)
  }

  // --- UPLOAD ---
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    
    setIsUploading(true)
    const result = await uploadFile(formData, currentFolderId, toolId, pathRevalidate)
    setIsUploading(false)
    e.target.value = '' // Reset input

    if (result?.error) alert("Errore upload: " + result.error)
  }

  // --- NAVIGAZIONE ---
  const handleNavigate = (folderId: string | null) => {
    // Mantiene i parametri URL esistenti o pulisce
    const url = folderId ? `?folderId=${folderId}` : '?'
    router.push(url)
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

        {/* TOOLBAR ADMIN */}
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCreateFolder}>
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
          </div>
        )}
      </div>

      {/* LISTA OGGETTI */}
      <ul className="divide-y divide-slate-100 flex-1">
        {items.length === 0 && (
            <li className="p-12 text-center text-slate-400 flex flex-col items-center gap-2 justify-center h-full">
                <Folder className="w-12 h-12 text-slate-200" />
                <p>Cartella vuota</p>
            </li>
        )}

        {items.map((item) => (
          <li key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
            
            {/* Area Cliccabile */}
            <div 
                className="flex items-center gap-3 cursor-pointer flex-1 select-none"
                onClick={() => item.type === 'folder' && handleNavigate(item.id)}
            >
              <div className={`p-2 rounded ${item.type === 'folder' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {item.type === 'folder' ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-medium text-slate-900">{item.name}</p>
                {item.type === 'file' && item.size && (
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
        ))}
      </ul>
    </div>
  )
}