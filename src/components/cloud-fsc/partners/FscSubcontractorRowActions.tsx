'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Pencil, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { getFscSubcontractor, setFscSubcontractorStatus } from '@/actions/fsc/subcontractors'
import { FscSubcontractorDetailSheet } from '@/components/cloud-fsc/partners/FscSubcontractorDetailSheet'
import { FscSubcontractorFormDialog } from '@/components/cloud-fsc/partners/FscSubcontractorFormDialog'
import { Button } from '@/components/ui/button'
import type { FscSubcontractorWithDetails } from '@/types/fsc'

type FscSubcontractorRowActionsProps = {
  subcontractor: FscSubcontractorWithDetails
  canEdit: boolean
}

export function FscSubcontractorRowActions({
  subcontractor,
  canEdit,
}: FscSubcontractorRowActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<FscSubcontractorWithDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const openDetail = async () => {
    setLoadingDetail(true)
    try {
      const result = await getFscSubcontractor(subcontractor.id)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Impossibile caricare il dettaglio')
        return
      }
      setDetailRow(result.data)
      setDetailOpen(true)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleStatusChange = async (status: 'active' | 'inactive' | 'reactivated') => {
    const label =
      status === 'inactive' ? 'disattivare' : status === 'reactivated' ? 'riattivare' : 'attivare'
    if (!confirm(`Confermi di ${label} questo terzista?`)) return

    const result = await setFscSubcontractorStatus(subcontractor.id, status)
    if (!result.success) {
      toast.error(result.error ?? 'Operazione fallita')
      return
    }
    toast.success('Stato aggiornato')
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
            {subcontractor.status !== 'inactive' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleStatusChange('inactive')}
              >
                <PowerOff className="mr-1 h-4 w-4" />
                Disattiva
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void handleStatusChange('reactivated')}
              >
                <Power className="mr-1 h-4 w-4" />
                Riattiva
              </Button>
            )}
          </>
        )}
      </div>

      <FscSubcontractorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        subcontractor={subcontractor}
      />
      <FscSubcontractorDetailSheet
        subcontractor={detailRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
      />
    </>
  )
}
