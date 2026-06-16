'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FscProductGroupDetailSheet } from '@/components/cloud-fsc/product-groups/FscProductGroupDetailSheet'
import { FscProductGroupFormDialog } from '@/components/cloud-fsc/product-groups/FscProductGroupFormDialog'
import type { FscCompanyProductGroupWithDetails } from '@/types/fsc'

type FscProductGroupCreateButtonProps = {
  canEdit: boolean
}

export function FscProductGroupCreateButton({ canEdit }: FscProductGroupCreateButtonProps) {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<FscCompanyProductGroupWithDetails | null>(null)

  if (!canEdit) return null

  const handleCreated = (group: FscCompanyProductGroupWithDetails) => {
    setCreatedGroup(group)
    setDetailOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        className="bg-[#967635] hover:bg-[#7d6230]"
        onClick={() => setOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuovo gruppo
      </Button>
      <FscProductGroupFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={handleCreated}
      />
      <FscProductGroupDetailSheet
        group={createdGroup}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
      />
    </>
  )
}
