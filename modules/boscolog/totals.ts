export type TotalsInputSpecies = {
  id?: string
  common?: string | null
  scientific?: string | null
  qty?: string | null
  unit?: string | null
}
export type TotalsInputExit = {
  species_id?: string | null
  qty?: string | null
  unit?: string | null
}
export type TotalsInputMovement = {
  type?: string | null
  qty_in?: string | null
  qty_out?: string | null
  unit?: string | null
}

export type LotTotals = {
  total: string
  sold: string
  residue: string
  unit: string
  residueNegative: boolean
}

export type SpeciesTotals = {
  speciesId: string
  label: string
  unit: string
  total: string
  sold: string
  residue: string
  residueNegative: boolean
}

export type MassBalanceResult = {
  parentInput: string
  mvIn: string
  mvOut: string
  ownTotal: string
  ownSold: string
  totalIn: string
  totalOut: string
  balance: string
  unit: string
  unitMismatch: boolean
  unitWarning: string
  hasData: boolean
}

function toNum(v: string | null | undefined): number | null {
  const s = String(v ?? '')
    .replace(',', '.')
    .trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toNumOr0(v: string | null | undefined): number {
  return toNum(v) ?? 0
}

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString().replace('.', ',')
}

function speciesLabel(s: TotalsInputSpecies, index: number): string {
  const common = String(s.common ?? '').trim()
  const scientific = String(s.scientific ?? '').trim()
  if (common) return common
  if (scientific) return scientific
  return `Specie #${index + 1}`
}

export function guessUnit(lot: {
  species?: TotalsInputSpecies[]
  exits?: TotalsInputExit[]
  movements?: TotalsInputMovement[]
}): string {
  for (const s of lot.species ?? []) {
    if (String(s.unit ?? '').trim()) return String(s.unit).trim()
  }
  for (const e of lot.exits ?? []) {
    if (String(e.unit ?? '').trim()) return String(e.unit).trim()
  }
  for (const m of lot.movements ?? []) {
    if (String(m.unit ?? '').trim()) return String(m.unit).trim()
  }
  return ''
}

export function calcTotals(lot: {
  species?: TotalsInputSpecies[]
  exits?: TotalsInputExit[]
  movements?: TotalsInputMovement[]
}): LotTotals {
  const unit = guessUnit(lot)
  if (!unit) {
    return { total: '', sold: '', residue: '', unit: '', residueNegative: false }
  }

  let total = 0
  let okT = false
  for (const s of lot.species ?? []) {
    if ((s.unit || '') !== unit) continue
    const n = toNum(s.qty)
    if (n == null) continue
    total += n
    okT = true
  }

  let sold = 0
  let okS = false
  for (const e of lot.exits ?? []) {
    if ((e.unit || '') !== unit) continue
    const n = toNum(e.qty)
    if (n == null) continue
    sold += n
    okS = true
  }

  if (!okT && !okS) {
    return { total: '', sold: '', residue: '', unit: '', residueNegative: false }
  }

  const residue = okT ? total - sold : null
  return {
    total: okT ? fmt(total) : '',
    sold: okS ? fmt(sold) : '',
    residue: residue == null ? '' : fmt(residue),
    unit,
    residueNegative: residue != null && residue < 0,
  }
}

/**
 * Per-species stock: sold exits attributed via species_id.
 * Exits without species_id are ignored in per-species sold (still count in aggregate calcTotals).
 */
export function calcTotalsBySpecies(lot: {
  species?: TotalsInputSpecies[]
  exits?: TotalsInputExit[]
}): SpeciesTotals[] {
  const species = lot.species ?? []
  const exits = lot.exits ?? []
  const result: SpeciesTotals[] = []

  species.forEach((s, index) => {
    const id = s.id
    if (!id) return
    const unit = String(s.unit ?? '').trim()
    const totalN = toNum(s.qty)
    let soldN = 0
    let okS = false
    for (const e of exits) {
      if (e.species_id !== id) continue
      if (unit && (e.unit || '') !== unit) continue
      const n = toNum(e.qty)
      if (n == null) continue
      soldN += n
      okS = true
    }
    const residueN = totalN == null ? null : totalN - soldN
    result.push({
      speciesId: id,
      label: speciesLabel(s, index),
      unit,
      total: totalN == null ? '' : fmt(totalN),
      sold: okS ? fmt(soldN) : '',
      residue: residueN == null ? '' : fmt(residueN),
      residueNegative: residueN != null && residueN < 0,
    })
  })

  return result
}

export function anySpeciesResidueNegative(rows: SpeciesTotals[]): boolean {
  return rows.some((r) => r.residueNegative)
}

export type MassBalanceLot = {
  id: string
  species?: TotalsInputSpecies[]
  exits?: TotalsInputExit[]
  movements?: TotalsInputMovement[]
  parentLots?: string[]
}

/**
 * @param getLot resolve parent lot by id (already loaded graph preferred)
 */
export function calcMassBalance(
  lot: MassBalanceLot,
  getLot: (id: string) => MassBalanceLot | null | undefined,
  _visited?: Set<string>
): MassBalanceResult {
  const visited = _visited ?? new Set<string>()
  if (visited.has(lot.id)) {
    return {
      parentInput: '',
      mvIn: '',
      mvOut: '',
      ownTotal: '',
      ownSold: '',
      totalIn: '',
      totalOut: '',
      balance: '0',
      unit: '',
      unitMismatch: false,
      unitWarning: '',
      hasData: false,
    }
  }
  visited.add(lot.id)

  let parentInput = 0
  let parentUnit = ''
  for (const pid of lot.parentLots ?? []) {
    const parent = getLot(pid)
    if (!parent || visited.has(pid)) continue
    const pt = calcTotals(parent)
    if (pt.total && pt.unit) {
      parentInput += toNumOr0(pt.total)
      if (!parentUnit) parentUnit = pt.unit
    }
  }

  let mvIn = 0
  let mvOut = 0
  let mvUnit = ''
  for (const m of lot.movements ?? []) {
    const u = String(m.unit ?? '').trim()
    if (u && !mvUnit) mvUnit = u
    if (m.type === 'ingresso' || m.type === 'trasferimento') mvIn += toNumOr0(m.qty_in)
    if (m.type === 'uscita') mvOut += toNumOr0(m.qty_out)
    if (m.type === 'lavorazione') {
      mvIn += toNumOr0(m.qty_in)
      mvOut += toNumOr0(m.qty_out)
    }
  }

  const tt = calcTotals(lot)
  const ownTotal = toNumOr0(tt.total)
  const ownSold = toNumOr0(tt.sold)

  const allUnits = new Set<string>()
  if (parentUnit) allUnits.add(parentUnit)
  if (mvUnit) allUnits.add(mvUnit)
  if (tt.unit) allUnits.add(tt.unit)
  const unitMismatch = allUnits.size > 1

  const unit = parentUnit || mvUnit || tt.unit || ''
  const totalIn = parentInput + mvIn + ownTotal
  const totalOut = mvOut + ownSold
  const balance = totalIn - totalOut

  return {
    parentInput: parentInput > 0 ? fmt(parentInput) : '',
    mvIn: mvIn > 0 ? fmt(mvIn) : '',
    mvOut: mvOut > 0 ? fmt(mvOut) : '',
    ownTotal: ownTotal > 0 ? fmt(ownTotal) : '',
    ownSold: ownSold > 0 ? fmt(ownSold) : '',
    totalIn: totalIn > 0 ? fmt(totalIn) : '',
    totalOut: totalOut > 0 ? fmt(totalOut) : '',
    balance: fmt(balance),
    unit,
    unitMismatch,
    unitWarning: unitMismatch
      ? `Attenzione: unità miste (${[...allUnits].join(', ')}) — il bilancio potrebbe non essere corretto`
      : '',
    hasData: totalIn > 0 || totalOut > 0,
  }
}
