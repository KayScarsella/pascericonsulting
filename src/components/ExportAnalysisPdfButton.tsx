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

const TEMPLATE_TEAL: [number, number, number] = [0, 112, 192] // Office blue
const TEMPLATE_YELLOW: [number, number, number] = [254, 222, 0] // #FEDE00 (Informazioni di contatto in DOCX)
const HEADER_LOGO_W = 54
const HEADER_LOGO_H = 16
const TABLE_BODY_GRAY: [number, number, number] = [242, 242, 242]

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
  baseEvaluationCode?: number | null
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
    sessionId,
    baseEvaluationCode,
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
  const formatValue = (value: unknown) => String(value ?? '').trim() || '—'
  const addressLine = [
    userProfile?.indirizzo,
    [userProfile?.cap, userProfile?.citta].filter(Boolean).join(' '),
    userProfile?.provincia ? `(${userProfile.provincia})` : '',
  ]
    .filter((p) => String(p || '').trim())
    .join(', ')
  const companyLabel = formatValue(userProfile?.ragione_sociale || userProfile?.full_name)
  const analysisCode =
    baseEvaluationCode != null && Number.isFinite(baseEvaluationCode)
      ? String(baseEvaluationCode)
      : sessionId.slice(0, 8).toUpperCase()

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

  const drawSectionDivider = (title: string, titleSize = 16) => {
    if (y > pageH - 30) {
      doc.addPage()
      y = margin
    }
    doc.setDrawColor(TEMPLATE_TEAL[0], TEMPLATE_TEAL[1], TEMPLATE_TEAL[2])
    doc.setLineWidth(0.6)
    doc.line(margin, y, pageW - margin, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleSize)
    doc.setTextColor(TEMPLATE_TEAL[0], TEMPLATE_TEAL[1], TEMPLATE_TEAL[2])
    doc.text(title, margin, y)
    doc.setTextColor(0, 0, 0)
    y += 5
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(margin, y, pageW - margin, y)
    y += 6
  }

  // 1. Titolo + barra superiore (fornitore a sx, logo a dx)
  y = 18
  const regulationLabel = resolvedVariant === 'EUDR' ? 'EUDR' : 'Timber'
  doc.setFontSize(21)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(TEMPLATE_TEAL[0], TEMPLATE_TEAL[1], TEMPLATE_TEAL[2])
  doc.text(`Valutazione del Rischio ${regulationLabel}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 5

  const barTop = y
  const barH = 24
  doc.setFillColor(236, 246, 246)
  doc.rect(margin, barTop, pageW - 2 * margin, barH, 'F')
  doc.setDrawColor(210, 230, 230)
  doc.rect(margin, barTop, pageW - 2 * margin, barH)

  if (logoResult) {
    const xLogo = pageW - margin - HEADER_LOGO_W - 2
    try {
      doc.addImage(logoResult.dataUrl, logoResult.format, xLogo, barTop + 4, HEADER_LOGO_W, HEADER_LOGO_H)
    } catch {
      /* ignore */
    }
  }

  const supplierX = margin + 3
  y = barTop + 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(companyLabel, supplierX, y, { maxWidth: 120 })
  y += 6.2
  doc.text(formatValue(addressLine), supplierX, y, { maxWidth: 120 })
  y += 6.2
  doc.text(`${formatValue(userProfile?.recapito_telefonico)} · — · — · —`, supplierX, y, { maxWidth: 120 })
  y = barTop + barH + 7

  // Esito in evidenza prima della sintesi analisi
  const nonAcceptableMessage =
    'Esito non accettabile non è conforme alla normativa EUDR a causa di evidenza geospaziale di deforestazione. Sono necessarie verifiche e/o mitigazione.'
  const outcomeDetailLines = !isAccettabile
    ? doc.splitTextToSize(nonAcceptableMessage, pageW - 2 * margin - 10)
    : []
  const outcomeBoxH = !isAccettabile ? 16 + outcomeDetailLines.length * 4.2 : 18
  const outcomeColor: [number, number, number] = isAccettabile ? [74, 124, 46] : [185, 28, 28]
  const outcomeBg: [number, number, number] = isAccettabile ? [232, 245, 226] : [254, 242, 242]
  doc.setFillColor(outcomeBg[0], outcomeBg[1], outcomeBg[2])
  doc.roundedRect(margin, y, pageW - 2 * margin, outcomeBoxH, 2, 2, 'F')
  doc.setDrawColor(outcomeColor[0], outcomeColor[1], outcomeColor[2])
  doc.setLineWidth(0.4)
  doc.line(margin + 2, y + 1.5, margin + 2, y + outcomeBoxH - 1.5)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(outcomeColor[0], outcomeColor[1], outcomeColor[2])
  doc.text(isAccettabile ? 'Rischio Accettabile' : 'Rischio Non Accettabile', margin + 6, y + 7)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Indice massimo: ${overallRisk.toFixed(2)}`, margin + 6, y + 13)
  if (!isAccettabile) {
    doc.setFontSize(8.5)
    doc.text(outcomeDetailLines, margin + 6, y + 17)
  }
  doc.setTextColor(0, 0, 0)
  y += outcomeBoxH + 6

  // 2. Tabella riepilogo progetto con codice sessione base.
  autoTable(doc, {
    startY: y,
    head: [['Sintesi richiesta', 'Valore']],
    body: [
      ['Codice analisi', analysisCode],
      ['Operazione', nomeOperazione],
      ['Specie', specieName],
      ['Paese', countryName + (countryHasConflicts ? ' (Conflitti)' : '')],
      ['Scadenza', expiryDate ? new Date(expiryDate).toLocaleDateString('it-IT') : '—'],
      ['Rischio complessivo (MAX)', overallRisk.toFixed(2)],
      ['Esito', isAccettabile ? 'Rischio Accettabile' : 'Rischio Non Accettabile'],
    ],
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
    bodyStyles: { fontSize: 10, fillColor: TABLE_BODY_GRAY },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: pageW - 2 * margin - 70 },
    },
    pageBreak: 'auto',
  })
  const docWithTableHeader = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  y = (docWithTableHeader.lastAutoTable?.finalY ?? y) + 6

  autoTable(doc, {
    startY: y,
    head: [['Dati utente', 'Valore']],
    body: [
      ['Ragione sociale / Nome', companyLabel],
      ['CF / P.IVA', formatValue(userProfile?.cf_partita_iva)],
      ['Indirizzo', formatValue(addressLine)],
      ['Telefono', formatValue(userProfile?.recapito_telefonico)],
      ['Email', formatValue(userProfile?.email)],
    ],
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
    bodyStyles: { fontSize: 10, fillColor: TABLE_BODY_GRAY },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: pageW - 2 * margin - 70 },
    },
    pageBreak: 'auto',
  })
  y = (docWithTableHeader.lastAutoTable?.finalY ?? y) + 6
  if (isAccettabile) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(outcomeDescription, pageW - 2 * margin)
    doc.text(descLines, margin, y)
    y += descLines.length * 5 + 8
  } else {
    y += 2
  }
  drawSectionDivider('Risposte del questionario')

  // 4. Report di dettaglio (tabelle)
  const reportTitle = 'Report analisi (dettaglio risposte)'
  const drawReportHeaderOnce = () => {
    const headerH = 10
    doc.setFillColor(TEMPLATE_TEAL[0], TEMPLATE_TEAL[1], TEMPLATE_TEAL[2])
    doc.rect(margin, y, pageW - 2 * margin, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(reportTitle, margin + 3, y + 6.8)
    doc.setTextColor(0, 0, 0)
    y += headerH + 8
  }

  const sectionsForPdfMerged: SectionForPdf[] = [...sectionsForPdf]
  if (sectionsForPdfMerged.length >= 2) {
    const firstTitle = normalizePdfText(sectionsForPdfMerged[0].sectionTitle).toUpperCase()
    const secondTitle = normalizePdfText(sectionsForPdfMerged[1].sectionTitle).toUpperCase()
    const firstIsA = firstTitle.startsWith('A)') || firstTitle.startsWith('A.')
    const secondIsB = secondTitle.startsWith('B)') || secondTitle.startsWith('B.')
    if (firstIsA && secondIsB) {
      const mergedFirst: SectionForPdf = {
        sectionTitle: 'A) INFORMAZIONI PRELIMINARI',
        questions: [...sectionsForPdfMerged[0].questions, ...sectionsForPdfMerged[1].questions],
      }
      sectionsForPdfMerged.splice(0, 2, mergedFirst)
    }
  }

  if (sectionsForPdfMerged.length > 0) {
    if (y > 230) {
      doc.addPage()
      y = margin
    }
    drawReportHeaderOnce()
  }

  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  for (const section of sectionsForPdfMerged) {
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
        fillColor: TEMPLATE_TEAL,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 11,
      },
      bodyStyles: { fontSize: 10, fillColor: TABLE_BODY_GRAY },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: pageW - 2 * margin - 95 },
      },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 8
  }

  drawSectionDivider('Grafico dei rischi', 13)
  // Risk chart after questionnaire responses
  if (details.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = margin
    }

    const labelW = 62
    const valueW = 14
    const barX = margin + labelW + 2
    const barW = pageW - margin - barX - valueW
    const barH = 4
    const rowGap = 2.5

    // Guida visiva rapida per lettura intuitiva del grafico
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setFillColor(245, 245, 245)
    doc.rect(barX, y - 1.2, barW, 1.4, 'F')
    const tXLegend = barX + barW * THRESHOLD
    doc.setDrawColor(TEMPLATE_YELLOW[0], TEMPLATE_YELLOW[1], TEMPLATE_YELLOW[2])
    doc.setLineWidth(0.4)
    doc.line(tXLegend, y - 2.2, tXLegend, y + 1.8)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    doc.setFontSize(7.5)
    doc.text('Soglia 0.30', tXLegend + 1.5, y + 1.2)
    y += 5

    const getBarColor = (risk: number) => {
      if (risk <= 0.30) return [74, 124, 46] as const
      if (risk <= 0.60) return [217, 119, 6] as const
      return [220, 38, 38] as const
    }

    let rowY = y
    for (const d of details) {
      const label = d.shortLabel || d.label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const labelTxt = doc.splitTextToSize(label, labelW)
      const rowH = barH + rowGap + (labelTxt.length > 1 ? (labelTxt.length - 1) * 3.2 : 0)
      if (rowY + rowH > pageH - margin - 6) {
        doc.addPage()
        rowY = margin
      }
      doc.text(labelTxt, margin, rowY + 3)

      doc.setFillColor(245, 245, 245)
      doc.rect(barX, rowY, barW, barH, 'F')

      const tX = barX + barW * THRESHOLD
      doc.setDrawColor(TEMPLATE_YELLOW[0], TEMPLATE_YELLOW[1], TEMPLATE_YELLOW[2])
      doc.setLineWidth(0.4)
      doc.line(tX, rowY - 0.6, tX, rowY + barH + 0.6)
      doc.setLineWidth(0.2)
      doc.setDrawColor(0, 0, 0)

      const w = Math.max(0, Math.min(1, d.riskIndex)) * barW
      const [r, g, b] = getBarColor(d.riskIndex)
      doc.setFillColor(r, g, b)
      doc.rect(barX, rowY, w, barH, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(d.riskIndex.toFixed(2), barX + barW + 2, rowY + 3.3)

      rowY += rowH
    }

    y = rowY + 10
  }

  // 5. Screening AOI — subito prima del disclaimer:
  // includi sempre la sezione se il run AOI è stato salvato su storage.
  // La presenza/assenza di loss post-2020 può rendere la histogram vuota (o tutti zeri),
  // ma il report (legenda + note) deve comunque comparire.
  if (ddPdfPayload || isEudrPdf) {
    doc.addPage()
    y = margin
    drawSectionDivider('Allegato due diligence geospaziale')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    if (!ddPdfPayload) {
      autoTable(doc, {
        startY: y,
        head: [['Stato allegato AOI']],
        body: [[
          'Dati AOI non disponibili per questa analisi (run non presente o artefatti non caricati).',
        ]],
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9, fillColor: TABLE_BODY_GRAY },
        columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 10
    }

    if (ddPdfPayload) {
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
        headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9, fillColor: TABLE_BODY_GRAY },
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
        headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 9, fillColor: TABLE_BODY_GRAY },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: pageW - 2 * margin - 70 },
        },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 6

    // Immagine mappa in sezione dedicata
    if (ddPdfPayload.dd_snapshot_image_data_url) {
      drawSectionDivider('Foto mappa AOI salvata')
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
      headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 8, fillColor: TABLE_BODY_GRAY },
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
        bodyStyles: { fontSize: 8, fillColor: TABLE_BODY_GRAY },
        columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 6
    }

    // Dettagli e note operative (tabella grigia stile office)
    const detailRowsFromPayload: Array<[string, string]> =
      ddPdfPayload.ui_blocks?.map(
        (b): [string, string] => [normalizePdfText(b.heading || 'Dettaglio'), normalizePdfText(b.body)]
      ) ?? []
    const detailRows: Array<[string, string]> =
      detailRowsFromPayload.length > 0
        ? detailRowsFromPayload
        : [
            ['Logica screening', gateActive ? 'Gate AOI attivato (esito non accettabile).' : 'Nessun gate AOI attivato.'],
            [
              'Risultato numerico',
              `Pixel Hansen con loss ~ ${ddPdfPayload.loss_pixel_count ?? '—'} · AOI ~ ${ddPdfPayload.aoi_area_ha?.toFixed(2) ?? '—'} ha`,
            ],
          ]
    autoTable(doc, {
      startY: y,
      head: [['Dettagli e note operative', '']],
      body: detailRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 8, fillColor: TABLE_BODY_GRAY },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: pageW - 2 * margin - 55 },
      },
      pageBreak: 'auto',
    })
    y = (docWithTable.lastAutoTable?.finalY ?? y) + 6

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
        headStyles: { fillColor: TEMPLATE_TEAL, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 8, fillColor: TABLE_BODY_GRAY },
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
        headStyles: { fillColor: [180, 180, 180], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 7, fillColor: TABLE_BODY_GRAY },
        columnStyles: { 0: { cellWidth: pageW - 2 * margin } },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 8

      // Glossario termini (nuova tabella grigia)
      const glossaryRows: Array<[string, string, string]> = [
        ['AOI', 'Area of Interest', "La zona geografica specifica dove il legno e stato tagliato"],
        ['Hansen', 'Global Forest Change Dataset da UMD', 'Dati satellitari mondiali che rilevano tagli forestali'],
        ['Loss', 'Forest Loss (riduzione copertura forestale)', 'Aree dove gli alberi sono stati abbattuti'],
        ['Screening', 'Verifica automatica iniziale', 'Test che controlla rapidamente se il legno e conforme'],
        ['JRC', 'Joint Research Centre europeo', "Centro di ricerca dell'Unione Europea"],
        ['GFC', 'Global Forest Change', 'Progetto che monitora i cambiamenti forestali globali'],
        ['Ettari (ha)', 'Unita di misura dell area ~ 10.000 m²', 'Circa 1,2 campi da calcio o 14 piscine olimpioniche'],
      ]
      autoTable(doc, {
        startY: y,
        head: [['Termine', 'Significato tecnico', 'Spiegazione semplice']],
        body: glossaryRows,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [180, 180, 180], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 8, fillColor: TABLE_BODY_GRAY },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 76 },
          2: { cellWidth: pageW - 2 * margin - 98 },
        },
        pageBreak: 'auto',
      })
      y = (docWithTable.lastAutoTable?.finalY ?? y) + 10
    }
  }

  // 6. Disclaimer at the end (more space above)
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  drawSectionDivider('Disclaimer')
  y += 18
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const disclaimer = (disclaimerText || (resolvedVariant === 'EUDR' ? DISCLAIMER_EUDR : DISCLAIMER_EUTR)).trim()
  const disclaimerLines = doc.splitTextToSize(disclaimer, pageW - 2 * margin)
  doc.text(disclaimerLines, margin, y)

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
