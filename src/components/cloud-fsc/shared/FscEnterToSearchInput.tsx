'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FscEnterToSearchInputProps = {
  value: string
  onSearch: (next: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function FscEnterToSearchInput({
  value,
  onSearch,
  placeholder = 'Cerca…',
  disabled = false,
  className,
}: FscEnterToSearchInputProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const apply = (next: string) => {
    onSearch(next)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative min-w-[200px] sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={placeholder}
          className="h-9 pl-9 pr-9"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            apply(draft)
          }}
        />
        {draft ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setDraft('')
              apply('')
            }}
            disabled={disabled}
            aria-label="Cancella ricerca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => apply(draft)}
        >
          Cerca
        </Button>
        <span className="text-xs text-slate-400">Premi Invio per cercare</span>
      </div>
    </div>
  )
}
