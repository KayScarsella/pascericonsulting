'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { duplicateFscIloFromYear } from '@/actions/fsc/ilo'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FscIloDuplicateFromYearPanelProps = {
  targetYear: number
  sourceYears: number[]
}

export function FscIloDuplicateFromYearPanel({
  targetYear,
  sourceYears,
}: FscIloDuplicateFromYearPanelProps) {
  const router = useRouter()
  const [sourceYear, setSourceYear] = useState<string>(
    sourceYears[0] != null ? String(sourceYears[0]) : ''
  )
  const [loading, setLoading] = useState(false)

  if (sourceYears.length === 0) return null

  const handleDuplicate = async () => {
    const source = Number.parseInt(sourceYear, 10)
    if (Number.isNaN(source)) {
      toast.error('Seleziona un anno sorgente')
      return
    }

    if (
      !confirm(
        `Copiare le risposte dal ${source}? I file Word/PDF già caricati verranno resettati.`
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const result = await duplicateFscIloFromYear(source, targetYear)
      if (!result.success) {
        toast.error(result.error ?? 'Duplicazione fallita')
        return
      }
      toast.success(`Risposte duplicate dal ${source}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-medium text-amber-900">
        Avvio rapido: copia da un anno precedente
      </p>
      <p className="mt-1 text-xs text-amber-800/80">
        La duplicazione copia le risposte del questionario, non i file Word/PDF.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Copy className="h-4 w-4 text-amber-700" />
        <Select value={sourceYear} onValueChange={setSourceYear}>
          <SelectTrigger className="h-8 w-[120px] bg-white">
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            {sourceYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !sourceYear}
          onClick={handleDuplicate}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Duplica risposte
        </Button>
      </div>
    </div>
  )
}
