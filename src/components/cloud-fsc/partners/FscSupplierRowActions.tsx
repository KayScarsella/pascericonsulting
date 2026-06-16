'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Pencil, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { getFscSupplier, setFscSupplierStatus } from '@/actions/fsc/suppliers'
import { FscSupplierDetailSheet } from '@/components/cloud-fsc/partners/FscSupplierDetailSheet'
import { FscSupplierFormDialog } from '@/components/cloud-fsc/partners/FscSupplierFormDialog'
import { Button } from '@/components/ui/button'
import type { FscSupplierWithDetails } from '@/types/fsc'

type FscSupplierRowActionsProps = {
  supplier: FscSupplierWithDetails
  canEdit: boolean
}

export function FscSupplierRowActions({ supplier, canEdit }: FscSupplierRowActionsProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailSupplier, setDetailSupplier] = useState<FscSupplierWithDetails | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const openDetail = async () => {
    setLoadingDetail(true)
    try {
      const result = await getFscSupplier(supplier.id)
      if (!result.success || !result.data) {
        toast.error(result.error ?? 'Impossibile caricare il dettaglio')
        return
      }
      setDetailSupplier(result.data)
      setDetailOpen(true)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleStatusChange = async (status: 'active' | 'inactive' | 'reactivated') => {
    const label =
      status === 'inactive' ? 'disattivare' : status === 'reactivated' ? 'riattivare' : 'attivare'
    if (!confirm(`Confermi di ${label} questo fornitore?`)) return

    const result = await setFscSupplierStatus(supplier.id, status)
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
            {supplier.status !== 'inactive' ? (
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

      <FscSupplierFormDialog open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
      <FscSupplierDetailSheet
        supplier={detailSupplier}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
      />
    </>
  )
}
