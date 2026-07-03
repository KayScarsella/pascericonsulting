'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteFscLogo } from '@/actions/fsc/logos'
import { FscLogoFormDialog } from '@/components/cloud-fsc/loghi/FscLogoFormDialog'
import { Button } from '@/components/ui/button'
import type { FscLogo } from '@/types/fsc'

type FscLogoRowActionsProps = {
  logo: FscLogo
  canEdit: boolean
}

export function FscLogoRowActions({ logo, canEdit }: FscLogoRowActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Eliminare definitivamente questo logo e i file associati?')) return
    const result = await deleteFscLogo(logo.id)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success('Logo eliminato')
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1 h-4 w-4" />
          {canEdit ? 'Modifica' : 'Dettaglio'}
        </Button>

        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Elimina
          </Button>
        )}
      </div>

      <FscLogoFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        logo={logo}
        canEdit={canEdit}
      />
    </>
  )
}
