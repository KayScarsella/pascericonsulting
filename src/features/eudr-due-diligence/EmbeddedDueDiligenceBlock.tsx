'use client'

/**
 * Miniatura due-diligence inline dopo la domanda "Rischio paese" (sezione Paese di raccolta).
 * Mappa a sinistra, grafico a destra; sotto la mappa upload GeoJSON/JSON + data taglio + esegui analisi.
 */

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { runDueDiligenceAoiAnalysis, getDueDiligenceArtifactUrl } from '@/actions/eudr-due-diligence'
import { LossYearChart } from '@/features/eudr-due-diligence/map/LossYearChart'
import type { RunMetadata } from '@/features/eudr-due-diligence/types/due-diligence-run'
import { MapPin, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const DueDiligenceMap = dynamic(
  () => import('@/features/eudr-due-diligence/map/DueDiligenceMap').then((m) => m.DueDiligenceMap),
  { ssr: false }
)

type Props = {
  sessionId: string
}

const MAX_POINT_BUFFER_HA = 4

function hasPointLikeGeometry(aoi: unknown): boolean {
  if (!aoi || typeof aoi !== 'object') return false
  const o = aoi as Record<string, unknown>

  if (o.type === 'Point' || o.type === 'MultiPoint') return true
  if (o.type === 'Feature' && o.geometry && typeof o.geometry === 'object') {
    const g = o.geometry as Record<string, unknown>
    return g.type === 'Point' || g.type === 'MultiPoint'
  }
  if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
    return o.features.some((f) => {
      if (!f || typeof f !== 'object') return false
      const ff = f as Record<string, unknown>
      const g = ff.geometry
      if (!g || typeof g !== 'object') return false
      const gg = g as Record<string, unknown>
      return gg.type === 'Point' || gg.type === 'MultiPoint'
    })
  }
  if (o.type === 'GeometryCollection' && Array.isArray(o.geometries)) {
    return o.geometries.some((g) => {
      if (!g || typeof g !== 'object') return false
      const gg = g as Record<string, unknown>
      return gg.type === 'Point' || gg.type === 'MultiPoint'
    })
  }
  return false
}

function hasLossFromCutYear(metadata: RunMetadata): boolean {
  const iso = metadata.cutting_date_iso
  if (!iso || !/^\d{4}/.test(iso)) return false
  const y = parseInt(iso.slice(0, 4), 10)
  if (!Number.isFinite(y) || !metadata.lossyear_histogram) return false
  return Object.entries(metadata.lossyear_histogram).some(([key, count]) => {
    const band = Number(key)
    const calendarYear = band >= 1 && band <= 99 ? 2000 + band : band
    return calendarYear >= y && Number(count) > 0
  })
}

export function EmbeddedDueDiligenceBlock({ sessionId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [cuttingDate, setCuttingDate] = useState('')
  const [aoiText, setAoiText] = useState('')
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState<RunMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [lossTilesUrlTemplate, setLossTilesUrlTemplate] = useState<string | null>(null)
  const [lossAttribution, setLossAttribution] = useState<string | undefined>(undefined)
  const [lossDualClassMode, setLossDualClassMode] = useState(false)
  const [forest2020TilesUrl, setForest2020TilesUrl] = useState<string | null>(null)
  const [forest2020Attribution, setForest2020Attribution] = useState<string | undefined>(undefined)
  const [sentinel2Years, setSentinel2Years] = useState<Array<{ year: number; tilesUrlTemplate: string }>>([])
  const [sentinel2Attribution, setSentinel2Attribution] = useState<string | undefined>(undefined)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAoi, setPendingAoi] = useState<unknown>(null)
  const [pendingAoiHasPoint, setPendingAoiHasPoint] = useState(false)
  const [pointBufferAreaHa, setPointBufferAreaHa] = useState('')
  const lastRunIdRef = useRef<string | null>(null)

  async function runAnalysis(aoi: unknown) {
    setError(null)
    if (!cuttingDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(cuttingDate.trim())) {
      setError('Inserire la data di taglio (obbligatoria) in formato YYYY-MM-DD prima di eseguire l\'analisi.')
      return
    }
    setLoading(true)
    try {
      const cuttingIso = cuttingDate.trim()
      const trimmedArea = pointBufferAreaHa.trim()
      const parsedArea = trimmedArea ? Number(trimmedArea) : null
      const pointBufferArea =
        pendingAoiHasPoint && parsedArea != null && Number.isFinite(parsedArea) ? parsedArea : null
      const res = await runDueDiligenceAoiAnalysis(sessionId, aoi, cuttingIso, pointBufferArea)
      if (res.error && !res.metadata) {
        setError(res.error)
        return
      }
      if (res.metadata?.status === 'completed' && res.metadata.artifact_paths?.aoi_geojson) {
        lastRunIdRef.current = res.runId ?? res.metadata.run_id
        setMetadata(res.metadata)
        const urlRes = await getDueDiligenceArtifactUrl(
          sessionId,
          res.metadata.artifact_paths.aoi_geojson
        )
        if (urlRes.signedUrl) setMapUrl(urlRes.signedUrl)
      }
      if (res.lossTiles?.tilesUrlTemplate) {
        setLossTilesUrlTemplate(res.lossTiles.tilesUrlTemplate)
        setLossAttribution(res.lossTiles.attribution)
        setLossDualClassMode(Boolean(res.lossTiles.dualClassMode))
      }
      if (res.forest2020Tiles?.tilesUrlTemplate) {
        setForest2020TilesUrl(res.forest2020Tiles.tilesUrlTemplate)
        setForest2020Attribution(res.forest2020Tiles.attribution)
      } else {
        setForest2020TilesUrl(null)
      }
      if (res.sentinel2YearTiles?.years?.length) {
        setSentinel2Years(res.sentinel2YearTiles.years)
        setSentinel2Attribution(res.sentinel2YearTiles.attribution)
      } else {
        setSentinel2Years([])
      }
      if (res.error) setError(res.error)
    } finally {
      setLoading(false)
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setAoiText(text)
      try {
        if (!cuttingDate.trim()) {
          setError('Inserire prima la data di taglio (obbligatoria), poi caricare di nuovo il file.')
          return
        }
        const aoi = JSON.parse(text)
        setPendingAoi(aoi)
        setPendingAoiHasPoint(hasPointLikeGeometry(aoi))
        setConfirmOpen(true)
      } catch {
        setError('File non valido: servono GeoJSON/JSON con Point/MultiPoint/Polygon/MultiPolygon (WGS84).')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function runFromTextarea() {
    setError(null)
    if (!cuttingDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(cuttingDate.trim())) {
      setError('Inserire la data di taglio (obbligatoria) in formato YYYY-MM-DD.')
      return
    }
    try {
      const aoi = JSON.parse(aoiText)
      setPendingAoi(aoi)
      setPendingAoiHasPoint(hasPointLikeGeometry(aoi))
      setConfirmOpen(true)
    } catch {
      setError('JSON non valido. Usa il file oppure incolla GeoJSON valido.')
    }
  }

  async function confirmAndRun() {
    if (pendingAoiHasPoint) {
      const parsed = Number(pointBufferAreaHa)
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_POINT_BUFFER_HA) {
        setError(`Per geometrie Point/MultiPoint inserire una superficie valida (ha) tra 0 e ${MAX_POINT_BUFFER_HA}.`)
        return
      }
    }
    setConfirmOpen(false)
    if (pendingAoi != null) await runAnalysis(pendingAoi)
    setPendingAoi(null)
    setPendingAoiHasPoint(false)
  }

  return (
    <div
      className="mt-10 rounded-xl border-2 border-[#967635]/25 bg-gradient-to-br from-[#fcfaf7] to-white shadow-sm overflow-hidden relative"
      data-embedded-due-diligence
    >
      {/* Full-block loading overlay (Earth Engine può richiedere decine di secondi) */}
      {loading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-[#fcfaf7]/95 backdrop-blur-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <Loader2 className="h-10 w-10 animate-spin text-[#967635]" />
          <p className="mt-4 text-sm font-medium text-[#3d2b1a]">Analisi in corso…</p>
          <p className="mt-1 max-w-xs text-center text-xs text-slate-600">
            Hansen / JRC su Earth Engine: non chiudere la pagina. Una nuova analisi sostituisce la precedente per questa sessione.
          </p>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={!loading} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confermare analisi AOI?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  Verrà eseguita l&apos;analisi forest loss (Hansen) e, se disponibili, layer JRC / Sentinel-2.
                  È un processo pesante: <strong>non rilanciare</strong> più volte di seguito.
                </p>
                <p>
                  Data di taglio selezionata: <strong className="text-foreground">{cuttingDate || '—'}</strong>
                </p>
                <p className="text-amber-800">
                  Un eventuale risultato precedente per questa sessione verrà sostituito (artifact su storage aggiornati).
                </p>
                {pendingAoiHasPoint && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <label className="block text-xs font-medium text-amber-900 mb-1">
                      Superficie di analisi intorno al punto (ha) — obbligatoria, massimo {MAX_POINT_BUFFER_HA} ha
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      max={MAX_POINT_BUFFER_HA}
                      step={0.01}
                      value={pointBufferAreaHa}
                      onChange={(e) => setPointBufferAreaHa(e.target.value)}
                      className="w-full rounded-md border border-amber-300 bg-white px-2 py-1 text-sm text-slate-900"
                      placeholder="Es. 1.50"
                    />
                    <p className="mt-1 text-[11px] text-amber-900/90">
                      Verrà usata quest&apos;area per costruire il buffer del punto. Senza questo valore l&apos;analisi non parte.
                    </p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Annulla
            </Button>
            <Button
              type="button"
              className="bg-[#967635] hover:bg-[#856625]"
              onClick={confirmAndRun}
              disabled={
                loading ||
                (pendingAoiHasPoint &&
                  (!Number.isFinite(Number(pointBufferAreaHa)) ||
                    Number(pointBufferAreaHa) <= 0 ||
                    Number(pointBufferAreaHa) > MAX_POINT_BUFFER_HA))
              }
            >
              Avvia analisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="px-5 py-4 border-b border-[#e8dcc8]/80 bg-[#faf9f6] flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#967635]/15">
          <MapPin className="w-5 h-5 text-[#967635]" />
        </div>
        <div>
          <h3 className="font-bold text-[#3d2b1a] text-base">Due diligence geospaziale (AOI)</h3>
          <p className="text-xs text-[#7a5f2a]/80 mt-0.5">
            Carica un file GeoJSON/JSON con il poligono dell&apos;area di interesse, oppure incolla il JSON.
            Dopo l&apos;analisi la mappa e il grafico compaiono qui senza uscire dalla pagina.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Data taglio — stesso stile delle altre domande */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Data di taglio / harvest <span className="text-red-600">*</span> obbligatoria (YYYY-MM-DD)
          </label>
          <input
            type="date"
            required
            disabled={loading}
            min="2000-01-01"
            max={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            value={cuttingDate}
            onChange={(e) => setCuttingDate(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            L&apos;analisi e il grafico usano solo gli anni <strong>dopo</strong> l&apos;anno di questa data;
            i compositi satellite nella mappa sono limitati agli anni ≥ anno di taglio.
          </p>
        </div>

        {/* Upload file */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Carica file .geojson o .json
          </label>
          <input
            ref={fileInputRef}
            type="file"
            disabled={loading}
            accept=".geojson,.json,application/geo+json,application/json"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#3d2b1a] hover:file:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            onChange={onFileSelected}
          />
          <p className="text-xs text-slate-500 mt-1">
            Una sola AOI per analisi: ogni nuova esecuzione sostituisce file e risultati precedenti per questa
            sessione nello storage.
          </p>
        </div>

        {/* Incolla + esegui */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Oppure incolla AOI (GeoJSON)
          </label>
          <textarea
            className="w-full min-h-[100px] rounded-md border border-slate-300 p-3 font-mono text-xs disabled:opacity-50"
            disabled={loading}
            placeholder='{"type":"Polygon","coordinates":[...]}'
            value={aoiText}
            onChange={(e) => setAoiText(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !aoiText.trim() || !cuttingDate.trim()}
            onClick={runFromTextarea}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-[#967635] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Analisi in corso…' : 'Esegui analisi forest loss (Hansen)'}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {/* Mappa a sinistra, grafico a destra */}
        {(mapUrl || metadata?.lossyear_histogram) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <div className="min-w-0 space-y-2">
              {/* Badge logica base vs raffinata */}
              {metadata?.eudr_refined && (
                <div className="flex flex-wrap items-center gap-2">
                  {metadata.eudr_refined.jrc_assessment_ok &&
                  metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha != null &&
                  metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha >= 0.5 ? (
                    <span className="rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-900">
                      Logica raffinata (JRC foresta 2020 ∩ Hansen, ≥0,5 ha)
                    </span>
                  ) : metadata.eudr_refined.jrc_assessment_ok ? (
                    <span className="rounded-full bg-slate-100 border border-slate-300 px-3 py-1 text-xs font-medium text-slate-800">
                      Logica raffinata disponibile — sotto soglia ha → gate su base Hansen se applicabile
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                      Logica base (solo Hansen; JRC non disponibile o errore)
                    </span>
                  )}
                </div>
              )}
              {mapUrl && (
                <DueDiligenceMap
                  onMapLoad={undefined}
                  geoJsonUrl={mapUrl}
                  lossTilesUrlTemplate={lossTilesUrlTemplate}
                  lossAttribution={lossAttribution}
                  lossDualClassMode={lossDualClassMode}
                  forest2020TilesUrlTemplate={forest2020TilesUrl}
                  forest2020Attribution={forest2020Attribution}
                  sentinel2YearTiles={sentinel2Years}
                  sentinel2Attribution={sentinel2Attribution}
                  className="w-full h-[420px] rounded-lg border border-slate-200 shadow-sm"
                />
              )}
            </div>
            <div className="min-w-0 flex flex-col justify-start">
              {metadata?.lossyear_histogram && (
                <LossYearChart
                  histogram={metadata.lossyear_histogram}
                  cuttingDateIso={metadata.cutting_date_iso}
                />
              )}
              {metadata && (
                <div className="mt-3 space-y-2">
                  {metadata.cutting_date_iso && (
                    <p className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900">
                      {hasLossFromCutYear(metadata)
                        ? "LE COORDINATE INSERITE EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO (VEDI GRAFICO IN ROSSO)."
                        : "LE COORDINATE INSERITE NON EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO."}
                    </p>
                  )}
                  <p className="text-xs text-slate-600">
                    <strong>Risultato:</strong> pixel Hansen con loss (tutti gli anni) ≈{' '}
                    <span className="tabular-nums font-medium">{metadata.loss_pixel_count ?? '—'}</span>
                    {' · '}
                    AOI ≈ {metadata.aoi_area_ha?.toFixed(2) ?? '—'} ha
                  </p>
                  {metadata.eudr_refined?.jrc_assessment_ok &&
                    metadata.eudr_refined.forest_2020_ha_in_aoi != null && (
                      <p className="text-xs text-slate-700 rounded-md bg-slate-100 border border-slate-200 px-2 py-1.5">
                        <strong>JRC GFC2020 (foresta al 31/12/2020):</strong> nell&apos;AOI ≈{' '}
                        {metadata.eudr_refined.forest_2020_ha_in_aoi.toFixed(2)} ha (
                        {metadata.eudr_refined.forest_2020_pct_aoi != null
                          ? `${metadata.eudr_refined.forest_2020_pct_aoi.toFixed(1)}% dell'AOI`
                          : '—'}
                        ). Loss Hansen <em>dopo</em> il 2020 su quella foresta ≈{' '}
                        {metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha != null
                          ? `${metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha.toFixed(2)} ha`
                          : '0 ha'}
                        {' — '}
                        {metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha != null &&
                        metadata.eudr_refined.loss_on_forest_2020_post_eudr_ha >= 0.5
                          ? 'sopra soglia 0,5 ha → evidenza EUDR-raffinata.'
                          : 'sotto soglia 0,5 ha o assente → gate non attivato solo su questa evidenza.'}
                      </p>
                    )}
                  {/* Contesto degrado: tipi foresta al 2020 (JRC subtypes V1) — solo informativo */}
                  {metadata.forest_types_2020?.ok &&
                    metadata.forest_types_2020.ha_forest_typed_total != null &&
                    metadata.forest_types_2020.ha_forest_typed_total > 0 && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
                        <p className="font-semibold">Contesto degrado forestale (snapshot 31/12/2020)</p>
                        <p className="mt-1 text-emerald-900/95">
                          JRC <strong>forest types</strong> nell&apos;AOI (aree classificate foresta):{' '}
                          <span className="tabular-nums">
                            primaria ≈ {metadata.forest_types_2020.ha_primary?.toFixed(2) ?? '—'} ha
                          </span>
                          ,{' '}
                          <span className="tabular-nums">
                            naturalmente rigenerante ≈{' '}
                            {metadata.forest_types_2020.ha_naturally_regenerating?.toFixed(2) ?? '—'} ha
                          </span>
                          ,{' '}
                          <span className="tabular-nums">
                            piantata ≈ {metadata.forest_types_2020.ha_planted?.toFixed(2) ?? '—'} ha
                          </span>
                          . Il degrado EUDR riguarda in particolare transizioni da primaria/naturale verso
                          piantagione <em>dopo</em> il 2020 — qui abbiamo solo la fotografia al cut-off, non
                          l&apos;evoluzione temporale automatica.
                        </p>
                      </div>
                    )}
                  {metadata.forest_types_2020 && !metadata.forest_types_2020.ok && (
                    <p className="text-xs text-slate-500">
                      Tipi foresta JRC non disponibili: {metadata.forest_types_2020.error ?? '—'}
                    </p>
                  )}
                  {metadata.eudr_refined && !metadata.eudr_refined.jrc_assessment_ok && (
                    <p className="text-xs text-amber-800">
                      Intersect JRC GFC2020 non disponibile:{' '}
                      {metadata.eudr_refined.jrc_assessment_error ?? 'errore EE'}. Screening fallback su
                      Hansen-only.
                    </p>
                  )}
                  <details className="rounded-md border border-amber-100 bg-amber-50/60 p-2 text-[11px] text-amber-950">
                    <summary className="cursor-pointer font-medium">Fonte dati e limiti</summary>
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-amber-900/95">
                      <li>
                        <strong>Hansen GFC</strong> (UMD/GLAD, Landsat, ~30 m) mappa <em>stand-replacement
                        loss</em> con un <strong>anno</strong> per pixel; l&apos;ultimo anno disponibile nel
                        catalogo EE attuale è il <strong>2024</strong> (v1.12). Quando GLAD pubblica una
                        versione successiva si potrà estendere agli anni successivi aggiornando l&apos;asset
                        in codice.
                      </li>
                      <li>
                        Il fornitore indica che il dataset <strong>non è provato</strong> per analisi
                        areali rigorose EUDR; va usato come <strong>screening</strong> insieme ad altre
                        evidenze.
                      </li>
                      <li>
                        <strong>Rigorosità EUDR:</strong> nessun automatismo è &quot;il più rigoroso&quot; al
                        100% — la Commissione indica JRC GFC2020 come fonte <em>non obbligatoria</em> ma
                        allineata al cut-off; l&apos;approccio raffinato (foresta 2020 + loss successiva +
                        soglia ha) riduce falsi positivi rispetto al solo Hansen.
                      </li>
                      <li>
                        <strong>Data di taglio vs anno Hansen:</strong> se il taglio è a fine anno e la loss
                        cade nello stesso anno, Hansen non distingue mese — usare i compositi Sentinel-2 per
                        anno nella mappa o verifica manuale. In mappa/grafico il <strong>rosso</strong> è dalla
                        data di taglio in poi (≥ anno taglio), così la loss nell&apos;anno inserito è evidenziata;
                        il <strong>blu</strong> è solo per gli anni precedenti. Il gate risultato segue i metadati
                        run (JRC ∩ Hansen / soglie).
                      </li>
                      <li>
                        Questo flusso usa <strong>JRC GFC2020 V3</strong> (10 m) per mostrare la foresta al
                        31/12/2020 e, dove possibile, per il gate raffinato con soglia 0,5 ha.
                      </li>
                      <li>
                        Per <strong>frequenza maggiore</strong> (es. Sentinel-2 ogni ~5 giorni) servono
                        time-series/bi-temporale dedicate oltre questo screening.
                      </li>
                    </ul>
                  </details>
                  <p className="text-[10px] text-slate-400">Run {metadata.run_id.slice(0, 8)}…</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
