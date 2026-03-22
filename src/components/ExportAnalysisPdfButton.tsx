'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RiskDetail } from '@/lib/risk-calculator'

const DISCLAIMER_EUTR =
  "Il rapporto è stato generato tramite il portale timber tutor di Pasceri Consulting. La responsabilità della valutazione della trascurabilità del rischio ricade esclusivamente sull'operatore EUTR che utilizza tale strumento informatico."
const DISCLAIMER_EUDR =
  "Il rapporto è stato generato tramite il portale timber tutor di Pasceri Consulting. La responsabilità della valutazione della trascurabilità del rischio ricade esclusivamente sull'operatore EUDR che utilizza tale strumento informatico."

const THRESHOLD = 0.30

const OFFICE_BLUE: [number, number, number] = [47, 85, 151] // #2F5597
const FOOTER_LOGO_W = 26
const FOOTER_LOGO_H = 8
const FOOTER_Y_PAD = 2

function asQaRows(fields: Array<{ label: string; value: unknown }>): Array<[string, string]> {
  return fields.map((f) => [f.label, (f.value ?? '').toString().trim() || '—'])
}

export interface SectionForPdf {
  sectionTitle: string
  questions: {
    questionId: string
    questionText: string
    answerText: string
    riskIndex?: number
    mitigation?: { previousLabel: string; newLabel: string; date: string; comment?: string | null }[]
  }[]
}

/** Da dd_report.json — replica PDF senza GEE; screenshot mappa se cattura riuscita */
export interface DdPdfPayload {
  cutting_date_iso: string
  cutting_year: number
  dual_class_mode: boolean
  color_blue: string
  color_red: string
  lossyear_histogram: Record<string, number>
  aoi_area_ha?: number
  loss_pixel_count?: number
  legend_blue: string
  legend_red: string
  sources_limits: string
  has_snapshot?: boolean
  snapshot_storage_filename?: string
  /** Impostato lato server; in handleClick si scarica e si passa come data URL */
  dd_snapshot_signed_url?: string
  /** Impostato in handleClick prima di buildPdf */
  dd_snapshot_image_data_url?: string
  ui_blocks?: { heading?: string; body: string }[]
  methodology_bullets?: string[]
  gate_triggers_non_accettabile?: boolean
  gate_reasons?: string[]
  advisory_notes?: string[]
}

export interface ExportAnalysisPdfProps {
  /** Forza comportamenti specifici regolamento (wrapping titoli, disclaimer default, ecc.) */
  variant?: 'EUDR' | 'EUTR'
  nomeOperazione: string
  /** Dati utente (profilo) per sezione PDF "Dati utente" */
  userProfile?: {
    full_name?: string | null
    ragione_sociale?: string | null
    cf_partita_iva?: string | null
    indirizzo?: string | null
    cap?: string | null
    citta?: string | null
    provincia?: string | null
    recapito_telefonico?: string | null
    email?: string | null
  } | null
  /** Disclaimer personalizzato (es. EUDR vs EUTR) */
  disclaimerText?: string
  outcome: 'accettabile' | 'non accettabile'
  outcomeDescription: string
  specieName: string
  countryName: string
  countryHasConflicts: boolean
  expiryDate: string | null
  overallRisk: number
  details: RiskDetail[]
  sectionsForPdf: SectionForPdf[]
  sessionId: string
  /** Opzionale: screening AOI — grafico a barre con colori blu/rosso come in app */
  ddPdfPayload?: DdPdfPayload | null
}

async function fetchLogoAsDataUrl(): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  try {
    const res = await fetch(`${typeof window !== 'undefined' ? window.location.origin : ''}/unnamed.jpeg`)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string | null>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve((r.result as string) || null)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
    return dataUrl ? { dataUrl, format: 'JPEG' as const } : null
  } catch {
    return null
  }
}

function buildPdf(
  props: ExportAnalysisPdfProps,
  logoResult: { dataUrl: string; format: 'JPEG' | 'PNG' } | null
): jsPDF {
  const {
    variant,
    nomeOperazione,
    userProfile,
    disclaimerText,
    outcome,
    outcomeDescription,
    specieName,
    countryName,
    countryHasConflicts,
    expiryDate,
    overallRisk,
    details,
    sectionsForPdf,
    ddPdfPayload,
  } = props

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 14
  let y = margin

  const isAccettabile = outcome === 'accettabile'
  const resolvedVariant: 'EUDR' | 'EUTR' =
    variant ??
    (Boolean((disclaimerText || '').includes('operatore EUDR') || (disclaimerText || '').trim() === DISCLAIMER_EUDR.trim())
      ? 'EUDR'
      : 'EUTR')
  const isEudrPdf = resolvedVariant === 'EUDR'

  /**
   * Normalizza spaziature “non semantiche” (tabs, doppi spazi, nbsp) che in PDF
   * possono diventare “buchi” visivi. Preserva gli a-capo.
   */
  const normalizePdfText = (input: unknown): string => {
    const raw = String(input ?? '')
    if (!raw) return ''
    const cleaned = raw
      .replace(/\u00a0/g, ' ')
      .replace(/\u200b/g, '') // zero-width space
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n')

    const fixLetterSpacedRuns = (line: string) => {
      let s = line
      // Unisci run di lettere spaziatissime: "R o s s o" -> "Rosso"
      s = s.replace(/(?:\p{L}\s){5,}\p{L}/gu, (m) => m.replace(/\s+/g, ''))
      // Unisci run di cifre spaziatissime: "2 0 2 3" -> "2023"
      s = s.replace(/(?:\d\s){3,}\d/g, (m) => m.replace(/\s+/g, ''))
      // Ripulisci apostrofi/punteggiatura
      s = s
        .replace(/\s*'\s*/g, "'")
        .replace(/\s+([,:;.!?])/g, '$1')
        .replace(/([(\["“‘])\s+/g, '$1')
        .replace(/\s+([)\]"”’])/g, '$1')
      return s
    }

    // Alcune stringhe (da JSON/HTML) arrivano “letter-spaced” (una lettera per token).
    // Ricompone in modo aggressivo ma solo su run lunghi, lasciando intatte le frasi normali.
    return cleaned
      .split('\n')
      .map((line) => fixLetterSpacedRuns(line))
      .join('\n')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/…/g, '...')
      .replace(/—/g, '-')
      .replace(/≈/g, '~')
      .replace(/≥/g, '>=')
      .replace(/≤/g, '<=')
      .replace(/∩/g, '∩') // keep if font supports; replaced below if not
      .replace(/∪/g, 'U')
      // Drop any remaining non-latin1 chars (jsPDF core fonts are WinAnsi-ish)
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
  }

  // 1. (Logo moved to footer per requirements)
  y = 20

  // 2. Initial summary (no disclaimer here) — title lowered
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Analisi Finale – Valutazione del Rischio', margin, y)
  y += 8

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(nomeOperazione, margin, y)
  y += 10

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isAccettabile ? 74 : 185, isAccettabile ? 124 : 28, isAccettabile ? 46 : 28)
  doc.text(
    isAccettabile ? 'Rischio Accettabile' : 'Rischio Non Accettabile',
    margin,
    y
  )
  doc.setTextColor(0, 0, 0)
  y += 7

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const descLines = doc.splitTextToSize(outcomeDescription, pageW - 2 * margin)
  doc.text(descLines, margin, y)
  y += descLines.length * 5 + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Operazione:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(nomeOperazione, margin + 28, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('Specie:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(specieName, margin + 28, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('Paese:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(
    countryName + (countryHasConflicts ? ' (Conflitti)' : ''),
    margin + 28,
    y
  )
  y += 6

  if (expiryDate) {
    doc.setFont('helvetica', 'bold')
    doc.text('Scadenza:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(
      new Date(expiryDate).toLocaleDateString('it-IT'),
      margin + 28,
      y
    )
    y += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.text('Rischio complessivo (MAX):', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(overallRisk.toFixed(2), margin + 55, y)
  y += 12

  // 2b. "Dati utente" section (supplier-like: fixed fields with — when missing)
  if (userProfile) {
    const addressParts = [
      userProfile.indirizzo,
      [userProfile.cap, userProfile.citta].filter(Boolean).join(' '),
      userProfile.provincia ? `(${userProfile.provincia})` : '',
    ]
      .filter((p) => String(p || '').trim())
      .join(', ')

    const qaRows = asQaRows([
      { label: 'Nome', value: userProfile.full_name },
      { label: 'Ragione sociale', value: userProfile.ragione_sociale },
      { label: 'CF / P.IVA', value: userProfile.cf_partita_iva },
      { label: 'Email', value: userProfile.email },
      { label: 'Telefono', value: userProfile.recapito_telefonico },
      { label: 'Indirizzo', value: addressParts },
    ])

    if (y > 240) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Dati utente', margin, y)
    y += 11

    autoTable(doc, {
      startY: y,
      head: [['Domanda', 'Risposta']],
      body: qaRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: pageW - 2 * margin - 95 },
      },
      pageBreak: 'auto',
    })
    const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 10
  }

  // 3. Risk chart (horizontal bars in portrait)
  if (details.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = margin
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Grafico dei Rischi', margin, y)
    y += 6

    const labelW = 62
    const valueW = 14
    const barX = margin + labelW + 2
    const barW = pageW - margin - barX - valueW
    const barH = 4
    const rowGap = 2.5
    const maxRowsPerPage = Math.floor((pageH - margin - y - 20) / (barH + rowGap))

    const getBarColor = (risk: number) => {
      if (risk <= 0.30) return [74, 124, 46] as const
      if (risk <= 0.60) return [217, 119, 6] as const
      return [220, 38, 38] as const
    }

    let rowY = y
    let rowIndex = 0
    for (const d of details) {
      if (rowIndex > 0 && rowIndex % Math.max(1, maxRowsPerPage) === 0) {
        doc.addPage()
        rowY = margin
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Grafico dei Rischi (continua)', margin, rowY)
        rowY += 6
      }

      const label = d.shortLabel || d.label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const labelTxt = doc.splitTextToSize(label, labelW)
      doc.text(labelTxt, margin, rowY + 3)

      // background
      doc.setFillColor(245, 245, 245)
      doc.rect(barX, rowY, barW, barH, 'F')

      // threshold marker at 0.30
      const tX = barX + barW * THRESHOLD
      doc.setDrawColor(150, 118, 53)
      doc.setLineWidth(0.4)
      doc.line(tX, rowY - 0.6, tX, rowY + barH + 0.6)
      doc.setLineWidth(0.2)
      doc.setDrawColor(0, 0, 0)

      // actual bar
      const w = Math.max(0, Math.min(1, d.riskIndex)) * barW
      const [r, g, b] = getBarColor(d.riskIndex)
      doc.setFillColor(r, g, b)
      doc.rect(barX, rowY, w, barH, 'F')

      // value
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(d.riskIndex.toFixed(2), barX + barW + 2, rowY + 3.3)

      rowY += barH + rowGap + (labelTxt.length > 1 ? (labelTxt.length - 1) * 3.2 : 0)
      rowIndex++
    }

    y = rowY + 10
  }

  // 4. Q/A report (tables) — portrait pages, no per-page banner (optional header only on first page)
  const reportTitle = 'Report analisi (Domande e risposte)'
  const drawReportHeaderOnce = () => {
    const headerH = 10
    doc.setFillColor(OFFICE_BLUE[0], OFFICE_BLUE[1], OFFICE_BLUE[2])
    doc.rect(margin, y, pageW - 2 * margin, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(reportTitle, margin + 3, y + 6.8)
    doc.setTextColor(0, 0, 0)
    y += headerH + 8
  }

  if (sectionsForPdf.length > 0) {
    if (y > 230) {
      doc.addPage()
      y = margin
    }
    drawReportHeaderOnce()
  }

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  for (const section of sectionsForPdf) {
    if (y > 260) {
      doc.addPage()
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    if (isEudrPdf) {
      const titleLines = doc.splitTextToSize(normalizePdfText(section.sectionTitle), pageW - 2 * margin)
      const lineH = 6
      // Se il titolo occupa troppo spazio a fondo pagina, vai a pagina nuova.
      if (y + titleLines.length * lineH > pageH - margin - 10) {
        doc.addPage()
        y = margin
      }
      doc.text(titleLines, margin, y)
      y += titleLines.length * lineH + 5
    } else {
      doc.text(section.sectionTitle, margin, y)
      y += 11
    }

    const tableBody: Array<
      [
        { content: string; styles?: Record<string, unknown> },
        { content: string; styles?: Record<string, unknown> },
      ]
    > = []

    for (const q of section.questions) {
      tableBody.push([{ content: q.questionText }, { content: q.answerText || '—' }])

      if (q.mitigation && q.mitigation.length > 0) {
        tableBody.push([
          { content: '' },
          { content: 'Mitigazione', styles: { fontStyle: 'italic' } },
        ])
        for (const m of q.mitigation) {
          tableBody.push([
            { content: '' },
            {
              content: `${m.date}: da "${m.previousLabel}" a "${m.newLabel}".`,
              styles: { fontStyle: 'italic' },
            },
          ])
          if (m.comment) {
            tableBody.push([
              { content: '' },
              { content: `Commento: ${m.comment}`, styles: { fontStyle: 'italic' } },
            ])
          }
        }
      }
    }

    autoTable(doc, {
      startY: y,
      head: [['Domanda', 'Risposta']],
      body: tableBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: {
        fillColor: OFFICE_BLUE,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11,
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: pageW - 2 * margin - 95 },
      },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 8
  }

  // 5. Screening AOI — subito prima del disclaimer:
  // includi sempre la sezione se il run AOI è stato salvato su storage.
  // La presenza/assenza di loss post-2020 può rendere la histogram vuota (o tutti zeri),
  // ma il report (legenda + note) deve comunque comparire.
  if (ddPdfPayload) {
    doc.addPage()
    y = margin
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('Due diligence geospaziale (AOI) — allegato', margin, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    // Summary line + gate outcome
    const gateActive = Boolean(ddPdfPayload.gate_triggers_non_accettabile)
    const aoiSummaryRows: Array<[string, string]> = [
      ['Data di taglio', normalizePdfText(`${ddPdfPayload.cutting_date_iso} (anno ${ddPdfPayload.cutting_year})`)],
      ['Esito gate AOI', normalizePdfText(gateActive ? 'NON ACCETTABILE' : 'nessun gate attivato')],
    ]
    autoTable(doc, {
      startY: y,
      head: [['Sintesi', 'Valore']],
      body: aoiSummaryRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: pageW - 2 * margin - 50 },
      },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 6

    // KPI table
    const kpiRows: Array<[string, string]> = [
      ['AOI (ha)', ddPdfPayload.aoi_area_ha != null ? ddPdfPayload.aoi_area_ha.toFixed(2) : '—'],
      ['Pixel loss Hansen (tot)', ddPdfPayload.loss_pixel_count != null ? String(ddPdfPayload.loss_pixel_count) : '—'],
      ['Anno taglio', String(ddPdfPayload.cutting_year || '—')],
    ]
    autoTable(doc, {
      startY: y,
      head: [['Parametro', 'Valore']],
      body: kpiRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: pageW - 2 * margin - 70 },
      },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 6

    // Immagine mappa (screenshot canvas se cattura non tainted)
    if (ddPdfPayload.dd_snapshot_image_data_url) {
      try {
        const imgW = pageW - 2 * margin
        const imgH = 85
        doc.addImage(ddPdfPayload.dd_snapshot_image_data_url, 'PNG', margin, y, imgW, imgH)
        y += imgH + 4
        doc.setFontSize(7)
        doc.setTextColor(90, 90, 90)
        doc.text('Mappa AOI (Sentinel-2/JRC/Hansen) — immagine generata e salvata su storage', margin, y)
        doc.setTextColor(0, 0, 0)
        y += 6
      } catch {
        doc.setFontSize(8)
        doc.text(
          '(Vista mappa non inclusa — limiti CORS sui tile; dati numerici e istogramma sotto.)',
          margin,
          y
        )
        y += 8
      }
    } else {
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      doc.text(
        'Vista mappa non disponibile. Il report sotto resta valido (numeri + istogramma + note).',
        margin,
        y
      )
      doc.setTextColor(0, 0, 0)
      y += 10
    }
    // Legend (compact)
    if (y > 265) {
      doc.addPage()
      y = margin
    }
    const legendLines = [ddPdfPayload.legend_blue, ...(ddPdfPayload.dual_class_mode ? [ddPdfPayload.legend_red] : [])]
    autoTable(doc, {
      startY: y,
      head: [['Legenda']],
      body: legendLines.map((l) => [normalizePdfText(l)]),
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 6

    // Gate reasons (if any)
    if (gateActive && ddPdfPayload.gate_reasons?.length) {
      autoTable(doc, {
        startY: y,
        head: [['Motivazioni (gate AOI)']],
        body: ddPdfPayload.gate_reasons.map((r) => [normalizePdfText(r)]),
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [180, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 6
    }

    // Narrative blocks (grouped bullets)
    if (ddPdfPayload.ui_blocks?.length) {
      const rows = ddPdfPayload.ui_blocks.map((b) => [
        normalizePdfText(b.heading || ''),
        normalizePdfText(b.body),
      ])
      autoTable(doc, {
        startY: y,
        head: [['Dettagli e note operative', '']],
        body: rows,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: 'bold' },
          1: { cellWidth: pageW - 2 * margin - 55 },
        },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 6
    }

    // Istogramma a barre (stessi colori)
    const bandToYear = (band: number) => (band >= 1 && band <= 99 ? 2000 + band : band)
    const entries = Object.entries(ddPdfPayload.lossyear_histogram)
      .map(([k, c]) => ({ year: bandToYear(Number(k)), count: Number(c) || 0, band: Number(k) }))
      .filter((e) => e.band > 0 && e.count > 0 && e.year >= 2021)
      .sort((a, b) => a.year - b.year)
    if (entries.length > 0) {
      if (y > 200) {
        doc.addPage()
        y = margin
      }
      doc.setFont('helvetica', 'bold')
      doc.text('Istogramma forest loss (Hansen) — pixel per anno', margin, y)
      y += 8
      const maxC = Math.max(...entries.map((e) => e.count), 1)
      const barW = 6
      const gap = 2
      const baseY = y + 28
      let x0 = margin
      doc.setFontSize(7)
      for (const e of entries) {
        if (x0 + barW > pageW - margin) break
        const h = Math.max(4, (e.count / maxC) * 22)
        const isRed = ddPdfPayload.dual_class_mode && e.year >= ddPdfPayload.cutting_year
        const rgb = isRed ? [220, 38, 38] : [37, 99, 235]
        doc.setFillColor(rgb[0], rgb[1], rgb[2])
        doc.rect(x0, baseY - h, barW, h, 'F')
        doc.setTextColor(0, 0, 0)
        doc.text(String(e.year), x0 + barW / 2, baseY + 4, { align: 'center' })
        x0 += barW + gap
      }
      y = baseY + 12
    }
    if (ddPdfPayload.advisory_notes?.length) {
      autoTable(doc, {
        startY: y,
        head: [['Note']],
        body: ddPdfPayload.advisory_notes.map((n) => [normalizePdfText(n)]),
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 6
    }
    const bullets = ddPdfPayload.methodology_bullets?.length
      ? ddPdfPayload.methodology_bullets
      : [ddPdfPayload.sources_limits]
    autoTable(doc, {
      startY: y,
      head: [['Fonti dati e limiti']],
      body: bullets.map((b) => [normalizePdfText(b)]),
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: OFFICE_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 10
  }

  // 6. Disclaimer at the end (more space above)
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  y += 18
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const disclaimer = (disclaimerText || (resolvedVariant === 'EUDR' ? DISCLAIMER_EUDR : DISCLAIMER_EUTR)).trim()
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageW - 2 * margin)
  doc.text(disclaimerLines, margin, y)

  // Logo bottom-right on last page only
  if (logoResult) {
    const last = doc.getNumberOfPages()
    doc.setPage(last)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    const x = w - margin - FOOTER_LOGO_W
    const yFooter = h - margin - FOOTER_LOGO_H - FOOTER_Y_PAD
    try {
      doc.addImage(logoResult.dataUrl, logoResult.format, x, yFooter, FOOTER_LOGO_W, FOOTER_LOGO_H)
    } catch {
      /* ignore */
    }
  }

  return doc
}

export function ExportAnalysisPdfButton(props: ExportAnalysisPdfProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const logoResult = await fetchLogoAsDataUrl()
      let propsForPdf = props
      if (props.ddPdfPayload?.dd_snapshot_signed_url) {
        try {
          const r = await fetch(props.ddPdfPayload.dd_snapshot_signed_url)
          if (r.ok) {
            const blob = await r.blob()
            const dataUrl = await new Promise<string | null>((resolve) => {
              const fr = new FileReader()
              fr.onload = () => resolve((fr.result as string) || null)
              fr.onerror = () => resolve(null)
              fr.readAsDataURL(blob)
            })
            if (dataUrl)
              propsForPdf = {
                ...props,
                ddPdfPayload: {
                  ...props.ddPdfPayload,
                  dd_snapshot_image_data_url: dataUrl,
                },
              }
          }
        } catch {
          /* ignore */
        }
      }
      const doc = buildPdf(propsForPdf, logoResult)
      const filename = `analisi-finale-${props.sessionId.slice(0, 8)}.pdf`
      doc.save(filename)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#967635]/30 bg-white hover:bg-[#fcfaf7] text-[#3d2b1a] font-semibold text-sm shadow-sm transition-all duration-200 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4" />
      )}
      {loading ? 'Generazione PDF...' : 'Scarica analisi completa (PDF)'}
    </button>
  )
}

export const PDF_DISCLAIMERS = {
  EUTR: DISCLAIMER_EUTR,
  EUDR: DISCLAIMER_EUDR,
} as const
