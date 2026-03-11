'use client'

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2, Plus, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { getSuppliers, createSupplier, SupplierFormData } from "@/actions/suppliers"
import { Tables } from "@/types/supabase" // 🛠️ Importiamo la Row ufficiale di Supabase

interface SupplierManagerProps {
  value: string | null
  onChange: (val: string) => void
  toolId: string
  readOnly?: boolean
}

export function SupplierManager({ value, onChange, toolId, readOnly }: SupplierManagerProps) {
  const [open, setOpen] = useState(false)
  
  // 🛠️ Usiamo Tables<'suppliers'> invece del vecchio SupplierRow
  const [suppliers, setSuppliers] = useState<Tables<'suppliers'>[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  
  // 🛠️ Tipizzato esattamente sui campi ammessi nel form
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '', vat_number: '', eori_number: '', address: '', 
    phone: '', email: '', website: '', contact_person: ''
  })

  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoading(true)
      const data = await getSuppliers(toolId)
      setSuppliers(data)
      setLoading(false)
    }
    fetchSuppliers()
  }, [toolId])

  const handleCreate = async () => {
    if (!formData.name?.trim()) {
      toast.error("Il nome del fornitore è obbligatorio")
      return
    }

    setIsCreating(true)
    const result = await createSupplier(formData, toolId)
    
    if (result.success && result.data) {
      const newSupplier = result.data;
      setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(newSupplier.id)
      toast.success("Fornitore creato e selezionato")
      setShowModal(false)
      // Reset form (i tipi null/undefined rispettano quelli del db)
      setFormData({ name: '', vat_number: '', eori_number: '', address: '', phone: '', email: '', website: '', contact_person: '' })
    } else {
      toast.error("Errore durante la creazione: " + result.error)
    }
    setIsCreating(false)
  }

  const selectedSupplier = suppliers.find(s => s.id === value)

  return (
    <div className="w-full flex flex-col gap-4">
      {/* SELEZIONE E RICERCA */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            role="combobox" 
            aria-expanded={open} 
            className={cn("w-full justify-between bg-white hover:bg-slate-50", readOnly && "opacity-80")}
            disabled={readOnly || loading}
          >
            <span className="truncate flex-1 text-left mr-2 font-normal text-slate-700">
              {loading ? "Caricamento fornitori..." : (selectedSupplier ? selectedSupplier.name : "Seleziona o cerca un fornitore...")}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] md:w-[400px] p-0 flex flex-col">
          <Command>
            <CommandInput placeholder="Cerca fornitore..." />
            <CommandList className="flex-1 max-h-[200px]">
              {suppliers.length === 0 && !loading && <CommandEmpty>Nessun fornitore trovato.</CommandEmpty>}
              <CommandGroup>
                {suppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={supplier.name}
                    onSelect={() => {
                      onChange(supplier.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 text-[#967635]", value === supplier.id ? "opacity-100" : "opacity-0")} />
                    {supplier.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          
          {!readOnly && (
            <div className="p-2 border-t bg-slate-50 mt-auto">
              <Button 
                variant="ghost" 
                size="sm"
                className="w-full justify-start text-[#967635] hover:bg-amber-100/50 hover:text-[#967635]"
                onClick={() => { setOpen(false); setShowModal(true); }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi nuovo fornitore
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* SCHEDA DETTAGLI FORNITORE SELEZIONATO */}
      {selectedSupplier && (
        <div className="bg-white border border-[#967635]/20 p-5 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-[#967635]" />
            <h4 className="font-semibold text-slate-800 text-lg">{selectedSupplier.name}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {selectedSupplier.vat_number && <DetailItem label="Partita IVA" value={selectedSupplier.vat_number} />}
            {selectedSupplier.eori_number && <DetailItem label="EORI" value={selectedSupplier.eori_number} />}
            {selectedSupplier.address && <DetailItem label="Indirizzo" value={selectedSupplier.address} className="sm:col-span-2" />}
            {selectedSupplier.email && <DetailItem label="Email" value={selectedSupplier.email} />}
            {selectedSupplier.phone && <DetailItem label="Telefono" value={selectedSupplier.phone} />}
            {selectedSupplier.contact_person && <DetailItem label="Referente" value={selectedSupplier.contact_person} />}
            {selectedSupplier.website && <DetailItem label="Sito Web" value={selectedSupplier.website} />}
          </div>
        </div>
      )}

      {/* MODALE CREAZIONE NUOVO FORNITORE */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi Nuovo Fornitore</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nome Fornitore *</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ragione sociale o nome" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">Partita IVA</Label>
              <Input id="vat" value={formData.vat_number || ''} onChange={(e) => setFormData({...formData, vat_number: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eori">Codice EORI</Label>
              <Input id="eori" value={formData.eori_number || ''} onChange={(e) => setFormData({...formData, eori_number: e.target.value})} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Indirizzo Completo</Label>
              <Input id="address" value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Referente</Label>
              <Input id="contact" value={formData.contact_person || ''} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sito Web</Label>
              <Input id="website" value={formData.website || ''} onChange={(e) => setFormData({...formData, website: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isCreating}>Annulla</Button>
            <Button onClick={handleCreate} disabled={isCreating} className="bg-[#967635] hover:bg-[#7a5f2a] text-white">
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Salva e Seleziona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailItem({ label, value, className }: { label: string, value: string, className?: string }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-slate-700 truncate" title={value}>{value}</span>
    </div>
  )
}