'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FscLogoFormDialog } from '@/components/cloud-fsc/loghi/FscLogoFormDialog'
import type { FscLogoType } from '@/types/fsc'

type FscLogoCreateButtonProps = {
  canEdit: boolean
  defaultType?: FscLogoType
}

export function FscLogoCreateButton({ canEdit, defaultType = 'product' }: FscLogoCreateButtonProps) {
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
        Nuovo logo
      </Button>
      <FscLogoFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultType={defaultType}
        canEdit={canEdit}
      />
    </>
  )
}
