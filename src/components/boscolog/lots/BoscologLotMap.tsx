'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const DueDiligenceMap = dynamic(
  () =>
    import('@/features/eudr-due-diligence/map/DueDiligenceMap').then((m) => m.DueDiligenceMap),
  { ssr: false }
)

type Props = {
  geojson: Record<string, unknown> | null
  className?: string
}

/**
 * Thin wrapper: feeds lot jsonb GeoJSON to DueDiligenceMap via blob URL
 * (same contract as EUDR EmbeddedDueDiligenceBlock).
 */
export function BoscologLotMap({ geojson, className }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!geojson) {
      setBlobUrl(null)
      return
    }
    const blob = new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [geojson])

  if (!blobUrl) {
    return (
      <div
        className={
          className ??
          'flex h-[320px] w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500'
        }
      >
        Nessuna geometria da mostrare
      </div>
    )
  }

  return (
    <DueDiligenceMap
      geoJsonUrl={blobUrl}
      className={
        className ?? 'h-[420px] w-full rounded-lg border border-slate-200 shadow-sm'
      }
    />
  )
}
