'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createFscCompany, type FscCompanyInput } from '@/actions/fsc/company'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

export function FscCompanySetupForm({ defaultEmail }: { defaultEmail?: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input: FscCompanyInput = {
      ragione_sociale: String(fd.get('ragione_sociale') ?? '').trim(),
      cf_partita_iva: String(fd.get('cf_partita_iva') ?? '').trim() || null,
      indirizzo: String(fd.get('indirizzo') ?? '').trim() || null,
      cap: String(fd.get('cap') ?? '').trim() || null,
      citta: String(fd.get('citta') ?? '').trim() || null,
      provincia: String(fd.get('provincia') ?? '').trim() || null,
      recapito_telefonico: String(fd.get('recapito_telefonico') ?? '').trim() || null,
      sito_internet: String(fd.get('sito_internet') ?? '').trim() || null,
      email: String(fd.get('email') ?? '').trim() || null,
    }

    if (!input.ragione_sociale) {
      toast.error('Inserisci la ragione sociale.')
      return
    }

    startTransition(async () => {
      const res = await createFscCompany(input)
      if (!res.success) {
        toast.error(res.error ?? 'Errore durante la creazione.')
        return
      }
      toast.success('Impresa creata con successo.')
      router.replace('/cloud-fsc')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ragione_sociale">Ragione sociale *</Label>
        <Input id="ragione_sociale" name="ragione_sociale" required placeholder="Es. Acme S.r.l." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf_partita_iva">CF / Partita IVA</Label>
        <Input id="cf_partita_iva" name="cf_partita_iva" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email impresa</Label>
        <Input id="email" name="email" type="email" defaultValue={defaultEmail ?? ''} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="indirizzo">Indirizzo</Label>
        <Input id="indirizzo" name="indirizzo" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="cap">CAP</Label>
          <Input id="cap" name="cap" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="citta">Città</Label>
          <Input id="citta" name="citta" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provincia">Provincia</Label>
          <Input id="provincia" name="provincia" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="recapito_telefonico">Telefono</Label>
          <Input id="recapito_telefonico" name="recapito_telefonico" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sito_internet">Sito web</Label>
          <Input id="sito_internet" name="sito_internet" />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Creazione...
          </span>
        ) : (
          'Crea impresa e continua'
        )}
      </Button>
    </form>
  )
}
