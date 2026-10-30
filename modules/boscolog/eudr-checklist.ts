export type EudrCheckStatus = 'pass' | 'partial' | 'fail'

export type EudrCheck = {
  id: string
  label: string
  detail: string
  status: EudrCheckStatus
  category: string
}

export type EudrChecklistResult = {
  checks: EudrCheck[]
  passed: number
  partial: number
  failed: number
  total: number
  pct: number
  overallStatus: EudrCheckStatus
}

export type EudrChecklistInput = {
  species: { common?: string | null; scientific?: string | null; qty?: string | null }[]
  exits: { doc_ref?: string | null }[]
  permits: { id: string; hasDocs?: boolean }[]
  cutting_date?: string | null
  supplier_id?: string | null
  supplier_name?: string | null
  dds_ref?: string | null
  deforestation_free?: string | null
  risk_outcome?: string | null
  hasGeo?: boolean
  geoFeatureCount?: number
  lotDocCount?: number
}

function normalizeDeforestation(v: string | null | undefined): 'yes' | 'no' | '' {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'yes' || s === 'si') return 'yes'
  if (s === 'no') return 'no'
  return ''
}

/**
 * Port of prototype eudrChecklist (12 checks).
 * Geodati via hasGeo (Fase 6); allegati ancora stub fino a Fase 7.
 */
export function eudrChecklist(lot: EudrChecklistInput): EudrChecklistResult {
  const checks: EudrCheck[] = []
  const species = lot.species ?? []
  const spCount = species.length

  const hasCommon = species.some((s) => String(s.common ?? '').trim().length > 0)
  checks.push({
    id: 'species_common',
    label: 'Specie (nome comune)',
    detail: hasCommon
      ? `${species.filter((s) => String(s.common ?? '').trim()).length} specie con nome comune`
      : 'Nessuna specie con nome comune inserita',
    status: hasCommon ? 'pass' : 'fail',
    category: 'identificazione',
  })

  const sciCount = species.filter((s) => String(s.scientific ?? '').trim()).length
  const hasScientific = sciCount > 0
  checks.push({
    id: 'species_scientific',
    label: 'Specie (nome scientifico)',
    detail: hasScientific
      ? `${sciCount}/${spCount} specie con binomiale`
      : 'Nessun nome scientifico inserito (obbligatorio EUDR)',
    status: spCount > 0 && sciCount === spCount ? 'pass' : hasScientific ? 'partial' : 'fail',
    category: 'identificazione',
  })

  const hasGeo = Boolean(lot.hasGeo)
  const geoFeatures = lot.geoFeatureCount ?? 0
  checks.push({
    id: 'geolocation',
    label: 'Geolocalizzazione',
    detail: hasGeo
      ? `GeoJSON con ${geoFeatures} feature caricate`
      : 'Nessuna geometria – importa GeoJSON (EPSG:4326)',
    status: hasGeo ? 'pass' : 'fail',
    category: 'localizzazione',
  })

  const hasCutDate = Boolean(String(lot.cutting_date ?? '').trim())
  checks.push({
    id: 'cutting_date',
    label: 'Data taglio / raccolta',
    detail: hasCutDate ? `Data: ${lot.cutting_date}` : 'Data di taglio/raccolta non inserita',
    status: hasCutDate ? 'pass' : 'fail',
    category: 'temporale',
  })

  const permCount = (lot.permits ?? []).length
  const permWithDocs = (lot.permits ?? []).filter((p) => p.hasDocs).length
  checks.push({
    id: 'permits',
    label: 'Autorizzazioni',
    detail:
      permCount > 0
        ? `${permCount} autorizzazioni (${permWithDocs} con allegati)`
        : 'Nessuna autorizzazione inserita',
    status: permCount > 0 ? (permWithDocs > 0 ? 'pass' : 'partial') : 'fail',
    category: 'proof_pack',
  })

  const exitCount = (lot.exits ?? []).length
  const exitWithDoc = (lot.exits ?? []).filter((e) => String(e.doc_ref ?? '').trim()).length
  checks.push({
    id: 'ddt_contracts',
    label: 'DDT / contratti (uscite)',
    detail:
      exitCount > 0
        ? `${exitWithDoc}/${exitCount} uscite con riferimento documento`
        : 'Nessuna uscita registrata',
    status:
      exitCount === 0
        ? 'partial'
        : exitWithDoc === exitCount
          ? 'pass'
          : exitWithDoc > 0
            ? 'partial'
            : 'fail',
    category: 'proof_pack',
  })

  const lotDocCount = lot.lotDocCount ?? 0
  checks.push({
    id: 'lot_docs',
    label: 'Allegati lotto (contratti, altro)',
    detail:
      lotDocCount > 0
        ? `${lotDocCount} allegati caricati`
        : 'Nessun allegato – carica contratti, comunicazioni, ecc.',
    status: lotDocCount > 0 ? 'pass' : 'partial',
    category: 'proof_pack',
  })

  const qtyOk = species.filter((s) => {
    const n = Number(String(s.qty ?? '').replace(',', '.'))
    return Number.isFinite(n) && n > 0
  }).length
  checks.push({
    id: 'quantities',
    label: 'Quantitativi',
    detail: qtyOk > 0 ? `${qtyOk}/${spCount} specie con quantità` : 'Nessun quantitativo inserito',
    status: spCount > 0 && qtyOk === spCount ? 'pass' : qtyOk > 0 ? 'partial' : 'fail',
    category: 'identificazione',
  })

  const hasSupplier = Boolean(String(lot.supplier_id ?? '').trim())
  checks.push({
    id: 'supplier',
    label: 'Fornitore identificato',
    detail: hasSupplier
      ? `Fornitore: ${lot.supplier_name || lot.supplier_id}`
      : 'Nessun fornitore associato al lotto',
    status: hasSupplier ? 'pass' : 'fail',
    category: 'catena',
  })

  const outcome = String(lot.risk_outcome ?? '').trim()
  const hasDDOutcome = outcome.length > 0
  checks.push({
    id: 'dd_outcome',
    label: 'Esito due diligence',
    detail: hasDDOutcome ? `Esito: ${outcome}` : 'Valutazione rischio senza esito finale',
    status: hasDDOutcome
      ? outcome === 'ok'
        ? 'pass'
        : outcome === 'blocca'
          ? 'fail'
          : 'partial'
      : 'fail',
    category: 'due_diligence',
  })

  const hasDDS = Boolean(String(lot.dds_ref ?? '').trim())
  checks.push({
    id: 'dds_ref',
    label: 'Rif. DDS (sistema informativo EUDR)',
    detail: hasDDS
      ? `DDS: ${lot.dds_ref}`
      : 'Nessun riferimento DDS inserito (facoltativo finché EUDR non operativo)',
    status: hasDDS ? 'pass' : 'partial',
    category: 'due_diligence',
  })

  const deforest = normalizeDeforestation(lot.deforestation_free)
  checks.push({
    id: 'deforestation_free',
    label: 'Deforestazione zero (post 31/12/2020)',
    detail:
      deforest === 'yes'
        ? 'Confermato: nessuna deforestazione post 31/12/2020'
        : deforest === 'no'
          ? 'NON CONFORME: area deforestata post 31/12/2020'
          : 'Non ancora verificato',
    status: deforest === 'yes' ? 'pass' : deforest === 'no' ? 'fail' : 'partial',
    category: 'eudr',
  })

  const passed = checks.filter((c) => c.status === 'pass').length
  const partial = checks.filter((c) => c.status === 'partial').length
  const failed = checks.filter((c) => c.status === 'fail').length
  const total = checks.length
  const pct = Math.round((passed / total) * 100)
  const overallStatus: EudrCheckStatus =
    failed === 0 && partial === 0 ? 'pass' : failed > 0 ? 'fail' : 'partial'

  return { checks, passed, partial, failed, total, pct, overallStatus }
}

export function eudrStatusLabel(s: EudrCheckStatus): string {
  if (s === 'pass') return 'Completo'
  if (s === 'partial') return 'Parziale'
  return 'Mancante'
}

export function eudrCheckBadgeClass(status: EudrCheckStatus): string {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
  if (status === 'partial') return 'bg-amber-100 text-amber-800 hover:bg-amber-100'
  return 'bg-red-100 text-red-800 hover:bg-red-100'
}
