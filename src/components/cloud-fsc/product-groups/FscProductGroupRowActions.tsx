'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteFscCompanyProductGroup,
  getFscCompanyProductGroup,
  setFscCompanyProductGroupActive,
} from '@/actions/fsc/product-groups'
import { FscProductGroupDetailSheet } from '@/components/cloud-fsc/product-groups/FscProductGroupDetailSheet'
import { FscProductGroupFormDialog } from '@/components/cloud-fsc/product-groups/FscProductGroupFormDialog'
import { Button } from '@/components/ui/button'
import type { FscCompanyProductGroupWithDetails } from '@/types/fsc'

type FscProductGroupRowActionsProps = {
  group: FscCompanyProductGroupWithDetails
  canEdit: boolean
}

export function FscProductGroupRowActions({ group, canEdit }: FscProductGroupRowActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailGroup, setDetailGroup] = useState<FscCompanyProductGroupWithDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const openDetail = async () => {
    setLoadingDetail(true)
    try {
      const result = await getFscCompanyProductGroup(group.id)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Impossibile caricare il dettaglio')
        return
      }
      setDetailGroup(result.data)
      setDetailOpen(true)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleToggleActive = async () => {
    const nextActive = !group.is_active
    const label = nextActive ? 'riattivare' : 'disattivare'
    if (!confirm(`Confermi di ${label} questo gruppo?`)) return

    const result = await setFscCompanyProductGroupActive(group.id, nextActive)
    if (!result.success) {
      toast.error(result.error ?? 'Operazione fallita')
      return
    }
    toast.success('Stato aggiornato')
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Eliminare definitivamente questo gruppo di prodotto?')) return
    const result = await deleteFscCompanyProductGroup(group.id)
    if (!result.success) {
      toast.error(result.error ?? 'Eliminazione fallita')
      return
    }
    toast.success('Gruppo eliminato')
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loadingDetail}
          onClick={() => void openDetail()}
        >
          <FileText className="mr-1 h-4 w-4" />
          Dettaglio
        </Button>

        {canEdit && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Modifica
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleToggleActive()}
            >
              {group.is_active ? (
                <>
                  <PowerOff className="mr-1 h-4 w-4" />
                  Disattiva
                </>
              ) : (
                <>
                  <Power className="mr-1 h-4 w-4" />
                  Riattiva
                </>
              )}
            </Button>
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
          </>
        )}
      </div>

      <FscProductGroupFormDialog open={editOpen} onOpenChange={setEditOpen} group={group} />
      <FscProductGroupDetailSheet
        group={detailGroup}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
      />
    </>
  )
}
