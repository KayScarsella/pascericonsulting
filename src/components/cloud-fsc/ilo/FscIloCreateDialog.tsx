'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createFscIloAssessment,
  deleteFscIloAssessment,
  type FscIloAssessmentWithStatus,
} from '@/actions/fsc/ilo'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fscIloEditPath } from '@/lib/fsc/constants'

type FscIloCreateDialogProps = {
  assessments: FscIloAssessmentWithStatus[]
  canEdit: boolean
}

export function FscIloCreateDialog({ assessments, canEdit }: FscIloCreateDialogProps) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear + 1 - i)
  const existingYears = new Set(assessments.map((a) => a.reference_year))

  const [open, setOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [loading, setLoading] = useState(false)

  if (!canEdit) return null

  const navigateToEdit = (year: number) => {
    setOpen(false)
    setReplaceOpen(false)
    router.push(fscIloEditPath(year))
  }

  const createFresh = async (year: number) => {
    setLoading(true)
    try {
      const result = await createFscIloAssessment(year)
      if (!result.success) {
        toast.error(result.error ?? 'Impossibile creare autovalutazione')
        return
      }

      toast.success(`Autovalutazione ${year} creata`)
      navigateToEdit(year)
    } finally {
      setLoading(false)
    }
  }

  const handlePrimary = () => {
    const year = Number.parseInt(selectedYear, 10)
    if (Number.isNaN(year)) return

    if (existingYears.has(year)) {
      setReplaceOpen(true)
      return
    }

    void createFresh(year)
  }

  const handleReplaceConfirm = async () => {
    const year = Number.parseInt(selectedYear, 10)
    if (Number.isNaN(year)) return

    setLoading(true)
    try {
      const deleted = await deleteFscIloAssessment(year)
      if (!deleted.success) {
        toast.error(deleted.error ?? 'Eliminazione fallita')
        return
      }

      const created = await createFscIloAssessment(year)
      if (!created.success) {
        toast.error(created.error ?? 'Impossibile creare autovalutazione')
        return
      }

      toast.success(`Autovalutazione ${year} sostituita`)
      navigateToEdit(year)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Nuova autovalutazione
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova autovalutazione ILO</DialogTitle>
            <DialogDescription>
              Scegli l&apos;anno di riferimento. Se esiste già un&apos;autovalutazione per
              quell&apos;anno, potrai sostituirla eliminando tutti i dati precedenti.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                  {existingYears.has(y) ? ' (già presente)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="button" disabled={loading} onClick={handlePrimary}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sostituire l&apos;autovalutazione {selectedYear}?</DialogTitle>
            <DialogDescription>
              Esiste già un&apos;autovalutazione per il {selectedYear}. Sostituendola verranno
              eliminati definitivamente risposte, file Word/PDF e stato di completamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplaceOpen(false)}>
              Annulla
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={handleReplaceConfirm}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sì, sostituisci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
