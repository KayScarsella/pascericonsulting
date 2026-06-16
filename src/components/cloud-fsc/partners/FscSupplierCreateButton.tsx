'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FscSupplierFormDialog } from '@/components/cloud-fsc/partners/FscSupplierFormDialog'

type FscSupplierCreateButtonProps = {
  canEdit: boolean
}

export function FscSupplierCreateButton({ canEdit }: FscSupplierCreateButtonProps) {
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
        Nuovo fornitore
      </Button>
      <FscSupplierFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
