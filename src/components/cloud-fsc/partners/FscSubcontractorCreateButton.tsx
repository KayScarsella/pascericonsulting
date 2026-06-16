'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FscSubcontractorFormDialog } from '@/components/cloud-fsc/partners/FscSubcontractorFormDialog'

type FscSubcontractorCreateButtonProps = {
  canEdit: boolean
}

export function FscSubcontractorCreateButton({ canEdit }: FscSubcontractorCreateButtonProps) {
  const [open, setOpen] = useState(false)
  if (!canEdit) return null

  return (
    <>
      <Button
        type="button"
        className="bg-[#967635] hover:bg-[#7d6230]"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuovo terzista
      </Button>
      <FscSubcontractorFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
