'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RiskDetail } from '@/lib/risk-calculator'

const DISCLAIMER =
  'Il rapporto è stato generato tramite il portale timber tutor di Pasceri Consulting. La responsabilità della valutazione della trascurabilità del rischio ricade esclusivamente sull\'operatore EUTR che utilizza tale strumento informatico.'

const THRESHOLD = 0.30

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

export interface ExportAnalysisPdfProps {
  nomeOperazione: string
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
    nomeOperazione,
    outcome,
    outcomeDescription,
    specieName,
    countryName,
    countryHasConflicts,
    expiryDate,
    overallRisk,
    details,
    sectionsForPdf,
  } = props

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 14
  let y = margin

  const isAccettabile = outcome === 'accettabile'

  // 1. Logo (unnamed.jpeg)
  const logoHeightMm = 12
  const logoWidthMm = 40
  if (logoResult) {
    try {
      doc.addImage(logoResult.dataUrl, logoResult.format, margin, y, logoWidthMm, logoHeightMm)
    } catch {
      // ignore invalid image
    }
    y += logoHeightMm + 10
  } else {
    y = 20
  }

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

  // 3. Bar chart: scales to many columns (EUDR has ~18); use landscape when needed
  if (details.length > 0) {
    const n = details.length
    // Portrait usable width ~182mm; if bars need more space, draw chart on landscape page
    const portraitChartW = pageW - 2 * margin - 18
    const minSlotMm = 9 // minimum mm per column so labels readable
    const needsLandscape = n * minSlotMm > portraitChartW

    if (y > 220 && !needsLandscape) {
      doc.addPage()
      y = 20
    }

    if (needsLandscape) {
      doc.addPage('a4', 'landscape')
      y = margin
    }

    const chartPageW = needsLandscape ? 297 : pageW
    const chartLeft = margin + 14
    const chartWidth = chartPageW - 2 * margin - 14
    const chartHeight = needsLandscape ? 52 : 48
    const chartTop = y
    const chartBottom = chartTop + chartHeight

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Grafico dei Rischi', margin, y)
    y += 6

    const chartTop2 = y
    const chartBottom2 = chartTop2 + chartHeight
    // Distribute bars across full chart width: one slot per column
    const slotWidth = chartWidth / n
    const barGap = Math.max(0.8, Math.min(2.5, slotWidth * 0.15))
    const barWidth = Math.max(2.5, slotWidth - barGap)
    const totalBarsWidth = n * barWidth + (n - 1) * barGap
    const offsetX = chartLeft + Math.max(0, (chartWidth - totalBarsWidth) / 2)

    const getBarColor = (risk: number) => {
      if (risk <= 0.30) return [74, 124, 46] as const
      if (risk <= 0.60) return [217, 119, 6] as const
      return [220, 38, 38] as const
    }

    // Y-axis grid
    doc.setDrawColor(230, 230, 230)
    doc.setFontSize(7)
    doc.setTextColor(140, 140, 140)
    for (let i = 0; i <= 4; i++) {
      const val = i / 4
      const lineY = chartBottom2 - val * chartHeight
      doc.line(chartLeft, lineY, chartLeft + chartWidth, lineY)
      doc.text(val.toFixed(2), chartLeft - 2, lineY + 1.2, { align: 'right' })
    }
    doc.setTextColor(0, 0, 0)

    // Bars
    details.forEach((d, i) => {
      const x = offsetX + i * (barWidth + barGap)
      const barH = Math.max(d.riskIndex * chartHeight, 0.8)
      const barY = chartBottom2 - barH
      const [r, g, b] = getBarColor(d.riskIndex)
      doc.setFillColor(r, g, b)
      doc.rect(x, barY, barWidth, barH, 'F')
      doc.setFontSize(n > 14 ? 5 : 6)
      doc.setFont('helvetica', 'bold')
      doc.text(d.riskIndex.toFixed(2), x + barWidth / 2, barY - 1.2, { align: 'center' })
      doc.setFont('helvetica', 'normal')
    })

    doc.setDrawColor(200, 200, 200)
    doc.line(chartLeft, chartTop2, chartLeft, chartBottom2)
    doc.line(chartLeft, chartBottom2, chartLeft + chartWidth, chartBottom2)

    const threshY = chartBottom2 - THRESHOLD * chartHeight
    doc.setDrawColor(150, 118, 53)
    doc.setLineWidth(0.5)
    for (let x = chartLeft; x < chartLeft + chartWidth; x += 3) {
      doc.line(x, threshY, Math.min(x + 2, chartLeft + chartWidth), threshY)
    }
    doc.setFontSize(6)
    doc.setTextColor(150, 118, 53)
    doc.text('0.30', chartLeft + chartWidth + 1, threshY + 1)
    doc.setTextColor(0, 0, 0)
    doc.setLineWidth(0.2)

    // X-axis labels: under each bar; when many columns use index + legend table
    const labelY0 = chartBottom2 + 4
    const useLegendTable = n > 12 || slotWidth < 11
    let yAfterChart = chartBottom2 + 22
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 55, 55)
    if (useLegendTable) {
      // Compact index under bars + full names in list below (avoids overlap)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      details.forEach((d, i) => {
        const x = offsetX + i * (barWidth + barGap)
        const cx = x + barWidth / 2
        doc.text(String(i + 1), cx, labelY0 + 2, { align: 'center' })
      })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      let legendY = labelY0 + 10
      doc.setTextColor(80, 80, 80)
      doc.text('Legenda criteri (nr. = colonna nel grafico):', margin, legendY)
      legendY += 5
      doc.setFontSize(7)
      const legendPageH = needsLandscape ? 200 : 275
      details.forEach((d, i) => {
        if (legendY > legendPageH) {
          doc.addPage('a4', needsLandscape ? 'landscape' : 'portrait')
          legendY = margin + 5
        }
        const line = `${i + 1}. ${d.shortLabel}`
        const wrapped = doc.splitTextToSize(line, chartPageW - 2 * margin)
        doc.text(wrapped, margin, legendY)
        legendY += wrapped.length * 3.5 + 1
      })
      yAfterChart = legendY + 6
      doc.setTextColor(0, 0, 0)
    } else {
      const labelFontSize = slotWidth < 15 ? 6 : 7
      const maxCharsPerLine = slotWidth < 15 ? 8 : 10
      doc.setFontSize(labelFontSize)
      details.forEach((d, i) => {
        const x = offsetX + i * (barWidth + barGap)
        const cx = x + barWidth / 2
        const words = d.shortLabel.trim().split(/\s+/)
        let line1 = ''
        let line2 = ''
        if (d.shortLabel.length <= maxCharsPerLine) {
          line1 = d.shortLabel
        } else {
          for (const w of words) {
            if (!line1) line1 = w
            else if ((line1 + ' ' + w).length <= maxCharsPerLine) line1 += ' ' + w
            else if (!line2) line2 = w
            else line2 += ' ' + w
          }
          if (line1.length > maxCharsPerLine) {
            line2 = line1.slice(maxCharsPerLine).trim()
            line1 = line1.slice(0, maxCharsPerLine)
            if (line2.length > 12) line2 = line2.slice(0, 12) + '…'
          } else if (line2.length > 12) line2 = line2.slice(0, 12) + '…'
        }
        doc.text(line1, cx, labelY0, { align: 'center' })
        if (line2) doc.text(line2, cx, labelY0 + 3.2, { align: 'center' })
      })
      yAfterChart = chartBottom2 + 22
    }
    doc.setTextColor(0, 0, 0)

    y = yAfterChart

    // Continue rest of document in portrait after landscape chart
    if (needsLandscape) {
      doc.addPage('a4', 'portrait')
      y = margin
    }
  }

  // 4. All sections: table per section (Domanda | Risposta), mitigation on separate lines
  const docWithTable = doc as jsPDF & { lastAutoTable?: { finalY: number } }
  for (const section of sectionsForPdf) {
    if (y > 260) {
      doc.addPage()
      y = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(section.sectionTitle, margin, y)
    y += 7

    const tableBody = section.questions.map((q) => {
      const answerParts: string[] = [q.answerText || '—']
      if (q.mitigation && q.mitigation.length > 0) {
        answerParts.push('')
        answerParts.push('——— Mitigazione ———')
        for (const m of q.mitigation) {
          answerParts.push(`${m.date}: da "${m.previousLabel}" a "${m.newLabel}".`)
          if (m.comment) answerParts.push(`Commento: ${m.comment}`)
        }
      }
      return [q.questionText, answerParts.join('\n')]
    })

    autoTable(doc, {
      startY: y,
      head: [['Domanda', 'Risposta']],
      body: tableBody,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [60, 43, 26], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: pageW - 2 * margin - 95 },
      },
    })
    y = docWithTable.lastAutoTable?.finalY ?? y
    y += 6
  }

  // 5. Disclaimer at the end (more space above)
  if (y > 250) {
    doc.addPage()
    y = 20
  }
  y += 18
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const disclaimerLines = doc.splitTextToSize(DISCLAIMER, pageW - 2 * margin)
  doc.text(disclaimerLines, margin, y)

  return doc
}

export function ExportAnalysisPdfButton(props: ExportAnalysisPdfProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const logoResult = await fetchLogoAsDataUrl()
      const doc = buildPdf(props, logoResult)
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
