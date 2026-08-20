'use client'

import { useTransition } from 'react'
import { UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { stopToolImpersonationAction } from '@/actions/tool-impersonation'

type Props = {
  toolId: string
  targetLabel: string
}

export function ToolImpersonationBanner({ toolId, targetLabel }: Props) {
  const [pending, startTransition] = useTransition()

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm">
          <UserRound className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            Stai operando come <strong>{targetLabel}</strong>. Le analisi create o
            modificate restano intestate a questo utente.
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white hover:bg-amber-100"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await stopToolImpersonationAction(toolId)
            })
          }}
        >
          {pending ? 'Uscita…' : 'Esci dall’impersonazione'}
        </Button>
      </div>
    </div>
  )
}
