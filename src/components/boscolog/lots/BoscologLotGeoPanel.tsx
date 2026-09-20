'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Loader2, Trash2, Upload } from 'lucide-react'
import {
  clearBoscologLotGeojson,
  exportBoscologCompanyGeojson,
  exportBoscologLotGeojson,
  setBoscologLotGeojson,
  type BoscologLotGeo,
} from '@/actions/boscolog/geo'
import { BoscologLotMap } from '@/components/boscolog/lots/BoscologLotMap'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/geo+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function BoscologLotGeoPanel({
  lotId,
  initial,
  canEdit,
}: {
  lotId: string
  initial: BoscologLotGeo
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [geo, setGeo] = useState(initial)
  const [exportYear, setExportYear] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setGeo(initial)
  }, [initial])

  const handleUpload = (file: File | undefined) => {
    if (!file || !canEdit) return
    startTransition(async () => {
      const text = await file.text()
      const res = await setBoscologLotGeojson(lotId, text)
      if (!res.success) {
        toast.error(res.error ?? 'Import fallito')
        return
      }
      if (res.data) setGeo(res.data)
      if (res.warning) toast.message(res.warning)
      toast.success('Geodati salvati.')
      router.refresh()
    })
  }

  const handleClear = () => {
    if (!canEdit) return
    if (!window.confirm('Rimuovere la geometria del lotto?')) return
    startTransition(async () => {
      const res = await clearBoscologLotGeojson(lotId)
      if (!res.success) {
        toast.error(res.error ?? 'Rimozione fallita')
        return
      }
      setGeo({
        geojson: null,
        featureCount: null,
        areaHa: null,
        hasGeo: false,
      })
      toast.success('Geometria rimossa.')
      router.refresh()
    })
  }

  const handleExportLot = () => {
    startTransition(async () => {
      const res = await exportBoscologLotGeojson(lotId)
      if (!res.success || !res.geojson || !res.filename) {
        toast.error(res.error ?? 'Export fallito')
        return
      }
      downloadText(res.filename, res.geojson)
      toast.success('Download GeoJSON lotto.')
    })
  }

  const handleExportCompany = () => {
    startTransition(async () => {
      const year =
        exportYear.trim() !== '' && Number.isFinite(Number(exportYear))
          ? Number(exportYear)
          : undefined
      const res = await exportBoscologCompanyGeojson(year != null ? { year } : undefined)
      if (!res.success || !res.geojson || !res.filename) {
        toast.error(res.error ?? 'Export fallito')
        return
      }
      if ((res.featureCount ?? 0) === 0) {
        toast.message('Nessun lotto con geodati da esportare.')
      }
      downloadText(res.filename, res.geojson)
      toast.success('Download GeoJSON azienda.')
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Geodati</h2>
          <p className="mt-1 text-sm text-slate-500">
            Import GeoJSON (EPSG:4326 / WGS84). La mappa riusa il componente EUDR (senza overlay
            satellitari).
          </p>
        </div>
        {geo.hasGeo ? (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">
            Presente
            {geo.featureCount != null ? ` · ${geo.featureCount} feature` : ''}
            {geo.areaHa != null && geo.areaHa > 0 ? ` · ${geo.areaHa} ha` : ''}
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-50 text-amber-900">
            Assente
          </Badge>
        )}
      </div>

      {geo.hasGeo && geo.geojson ? (
        <BoscologLotMap geojson={geo.geojson as Record<string, unknown>} />
      ) : (
        <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
          Carica un file .geojson o .json per vedere la mappa del lotto.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          disabled={!canEdit || pending}
          onChange={(e) => {
            handleUpload(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {canEdit && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            Carica GeoJSON
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !geo.hasGeo}
          onClick={handleExportLot}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Scarica lotto
        </Button>
        {canEdit && geo.hasGeo && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={handleClear}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Rimuovi
          </Button>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <Label htmlFor="export-year" className="text-slate-700">
          Esporta tutti i GeoJSON azienda
        </Label>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-28">
            <Input
              id="export-year"
              type="number"
              placeholder="Anno"
              value={exportYear}
              onChange={(e) => setExportYear(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={handleExportCompany}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Esporta company
          </Button>
          <p className="text-xs text-slate-500">
            Anno opzionale (filtro su data lotto). Vuoto = tutti i lotti con geodati.
          </p>
        </div>
      </div>
    </div>
  )
}
