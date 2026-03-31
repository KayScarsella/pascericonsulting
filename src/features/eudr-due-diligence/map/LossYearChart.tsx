'use client'

import type { LossYearHistogram } from '../types/due-diligence-run'
import { COLOR_POST_CUT, COLOR_POST_EU_ONLY } from '../constants/hansen-visual'
import { HANSEN_LAST_LOSS_CALENDAR_YEAR } from '../constants/hansen-version'

/** Cut-off EUDR: loss rilevante dal 2021 in poi; rosso = dall'anno di taglio in poi (≥). */
const EUDR_MIN_YEAR = 2021

type Props = {
  histogram: LossYearHistogram
  cuttingDateIso?: string | null
}

function lossyearBandToCalendarYear(bandValue: number): number {
  if (bandValue >= 1 && bandValue <= 99) return 2000 + bandValue
  return bandValue
}

function parseCuttingYear(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}/.test(iso)) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

export function LossYearChart({ histogram, cuttingDateIso }: Props) {
  const cuttingYear = parseCuttingYear(cuttingDateIso ?? undefined)

  const allFromEudr = Object.entries(histogram)
    .map(([key, count]) => {
      const bandVal = Number(key)
      const calendarYear = lossyearBandToCalendarYear(bandVal)
      return { bandVal, calendarYear, count: Number(count) || 0 }
    })
    .filter((e) => e.bandVal > 0 && e.count > 0 && e.calendarYear >= EUDR_MIN_YEAR)
    .sort((a, b) => a.calendarYear - b.calendarYear)

  const entries = allFromEudr

  /** Loss nell'anno di taglio o dopo → rosso su mappa; gate coerente. */
  const hasLossFromCutYearOnward =
    cuttingYear != null &&
    allFromEudr.some((e) => e.calendarYear >= cuttingYear && e.count > 0)

  const explicitResultMessage =
    cuttingYear == null
      ? null
      : hasLossFromCutYearOnward
        ? "LE COORDINATE INSERITE EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO (VEDI GRAFICO IN ROSSO)."
        : "LE COORDINATE INSERITE NON EVIDENZIANO LA PRESENZA DI DEFORESTAZIONE PER L'ANNO DI TAGLIO."

  if (entries.length === 0) {
    if (cuttingYear != null) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-900">
            {explicitResultMessage}
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
            <p className="font-medium">Nessuna perdita forestale rilevata dal 2021 in poi nell&apos;AOI</p>
            <p className="mt-1 text-emerald-800/90 text-xs">
              Nessun pixel Hansen negli anni {EUDR_MIN_YEAR}+. Data di taglio {cuttingYear} — nessuna loss da
              evidenziare in rosso.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-900">
        <p className="font-medium">Nessuna perdita forestale rilevata dopo il 31/12/2020</p>
        <p className="mt-1 text-emerald-800/90 text-xs">
          Nessun pixel Hansen negli anni {EUDR_MIN_YEAR}+. Indicare la data di taglio per la legenda blu/rosso.
        </p>
      </div>
    )
  }

  const maxCount = Math.max(...entries.map((e) => e.count), 1)
  const blues = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'] as const

  if (cuttingYear == null) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">Pixel di forest loss (Hansen)</p>
          <p className="text-xs text-slate-600 mt-1">
            Anni {EUDR_MIN_YEAR}–{HANSEN_LAST_LOSS_CALENDAR_YEAR} (run senza data taglio).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          {entries.map(({ bandVal, calendarYear, count }, idx) => {
            const h = Math.max(6, (count / maxCount) * 100)
            return (
              <div key={bandVal} className="flex flex-col items-center gap-1">
                <div
                  className="w-7 rounded-t border border-black/10 shadow-sm"
                  style={{
                    height: h,
                    backgroundColor: blues[Math.min(idx, blues.length - 1)],
                  }}
                  title={`${calendarYear}: ${count} px`}
                />
                <span className="text-[10px] tabular-nums text-slate-700">{calendarYear}</span>
                <span className="text-[9px] text-slate-500 tabular-nums">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Blu = anni prima del taglio; rosso = anno taglio e successivi (come mappa — loss nell'anno inserito è rossa)
  return (
    <div className="space-y-3">
      {explicitResultMessage && (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-900">
          {explicitResultMessage}
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">
          Pixel di forest loss (Hansen) — <strong>rosso dall&apos;anno {cuttingYear} in poi</strong>
        </p>
        <p className="text-xs text-slate-600 mt-1">
          <strong>Blu</strong> = loss solo negli anni {EUDR_MIN_YEAR}…{cuttingYear - 1} (prima del taglio).{' '}
          <strong>Rosso</strong> = loss nell&apos;anno di taglio e negli anni successivi (≥ {cuttingYear}). Così
          se inserisci ad es. il 2024 e c&apos;è loss nel 2024, le colonne {cuttingYear}+ sono rosse e visibili,
          non tutte blu.
        </p>
        {cuttingYear === EUDR_MIN_YEAR && (
          <p className="mt-2 text-xs text-slate-600">
            Taglio nel {EUDR_MIN_YEAR}: tutta la loss post-2020 rilevante è in rosso (nessun anno precedente in blu).
          </p>
        )}
        {hasLossFromCutYearOnward && (
          <p className="mt-2 text-xs text-amber-800 rounded-md bg-amber-50 border border-amber-100 px-2 py-1.5">
            È presente loss nell&apos;anno {cuttingYear} o dopo — coerente con layer rosso su mappa e con il gate
            se applicabile.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_POST_EU_ONLY }} />
            Blu: {EUDR_MIN_YEAR}…{cuttingYear > EUDR_MIN_YEAR ? cuttingYear - 1 : '—'} (solo prima del taglio)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLOR_POST_CUT }} />
            Rosso: ≥ {cuttingYear} (anno taglio incluso)
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        {entries.map(({ bandVal, calendarYear, count }) => {
          const h = Math.max(6, (count / maxCount) * 100)
          const isRed = calendarYear >= cuttingYear!
          const barColor = isRed ? COLOR_POST_CUT : COLOR_POST_EU_ONLY
          const labelColor = isRed ? 'text-red-900' : 'text-blue-900'
          return (
            <div key={bandVal} className="flex flex-col items-center gap-1">
              <div
                className="w-7 rounded-t border border-black/10 shadow-sm"
                style={{ height: h, backgroundColor: barColor }}
                title={`${calendarYear}: ${count} px (~${((count * 900) / 10000).toFixed(2)} ha)`}
              />
              <span className={`text-[10px] tabular-nums font-bold ${labelColor}`}>{calendarYear}</span>
              <span className="text-[9px] text-slate-500 tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
