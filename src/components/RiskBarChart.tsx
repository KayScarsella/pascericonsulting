'use client'

import type { RiskDetail } from "@/lib/risk-calculator"

interface RiskBarChartProps {
    details: RiskDetail[]
    overallRisk: number
}

const THRESHOLD = 0.30

/**
 * Vertical bar chart for risk visualization.
 * Bars are color-coded: green (≤ 0.30), amber (0.31–0.60), red (> 0.60).
 * A dashed threshold line at 0.30 makes the risk logic immediately clear.
 */
export function RiskBarChart({ details, overallRisk }: RiskBarChartProps) {
    if (details.length === 0) return null

    const n = details.length
    const chartHeight = 280
    const paddingLeft = 44
    const paddingRight = 20
    const barGap = Math.max(4, Math.min(8, Math.floor(56 / n)))
    // Fixed slot per column so chart width grows linearly with n (avoids squashed bars)
    const slotWidth = n > 16 ? 22 : n > 12 ? 26 : n > 8 ? 30 : 34
    const barWidth = Math.max(10, slotWidth - barGap)
    const totalBarsWidth = n * barWidth + (n - 1) * barGap
    // Chart width grows with bar count so labels have room (page scrolls horizontally if needed)
    const chartWidth = Math.max(600, paddingLeft + totalBarsWidth + paddingRight)
    const offsetX = paddingLeft + Math.max(0, (chartWidth - paddingLeft - paddingRight - totalBarsWidth) / 2)
    // Extra bottom space for rotated labels (more bars → taller diagonal footprint)
    const labelAreaHeight = n > 14 ? 140 : n > 10 ? 110 : 80
    const svgHeight = chartHeight + 20 + labelAreaHeight

    const yLabelCount = 5
    const isOverallAccettabile = overallRisk <= THRESHOLD

    const getBarColor = (risk: number) => {
        if (risk <= 0.30) return { fill: '#4a7c2e', bg: 'rgba(74, 124, 46, 0.15)', border: '#4a7c2e' }
        if (risk <= 0.60) return { fill: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: '#d97706' }
        return { fill: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: '#dc2626' }
    }

    const labelFontSize = n > 16 ? 7 : n > 12 ? 8 : 9

    return (
        <div className="flex flex-col items-center w-full">
            {/* Horizontal scroll when many columns so bars stay readable */}
            <div className="w-full overflow-x-auto overflow-y-visible pb-2 -mx-1 px-1">
            <svg
                viewBox={`0 0 ${chartWidth} ${svgHeight}`}
                className="min-w-0 h-auto"
                style={{ fontFamily: 'system-ui, sans-serif', width: '100%', minWidth: chartWidth }}
                preserveAspectRatio="xMidYMin meet"
            >
                {/* Y-axis grid lines + labels */}
                {Array.from({ length: yLabelCount + 1 }, (_, i) => {
                    const value = i / yLabelCount
                    const y = chartHeight - value * chartHeight + 20
                    return (
                        <g key={i}>
                            <line
                                x1={paddingLeft}
                                y1={y}
                                x2={chartWidth - paddingRight}
                                y2={y}
                                stroke="#e5e7eb"
                                strokeWidth={0.8}
                            />
                            <text
                                x={paddingLeft - 6}
                                y={y + 4}
                                fontSize="10"
                                fill="#94a3b8"
                                textAnchor="end"
                            >
                                {value.toFixed(1)}
                            </text>
                        </g>
                    )
                })}

                {/* Bars */}
                {details.map((d, i) => {
                    const barH = Math.max(d.riskIndex * chartHeight, 2)
                    const x = offsetX + i * (barWidth + barGap)
                    const y = chartHeight - barH + 20
                    const colors = getBarColor(d.riskIndex)

                    return (
                        <g key={d.questionId}>
                            {/* Bar background (subtle) */}
                            <rect
                                x={x}
                                y={20}
                                width={barWidth}
                                height={chartHeight}
                                fill="#f8fafc"
                                rx={4}
                            />
                            {/* Actual bar */}
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barH}
                                fill={colors.fill}
                                rx={4}
                                opacity={0.85}
                            >
                                <animate
                                    attributeName="height"
                                    from="0"
                                    to={barH}
                                    dur="0.6s"
                                    fill="freeze"
                                />
                                <animate
                                    attributeName="y"
                                    from={chartHeight + 20}
                                    to={y}
                                    dur="0.6s"
                                    fill="freeze"
                                />
                            </rect>

                            {/* Value label on top of bar */}
                            <text
                                x={x + barWidth / 2}
                                y={y - 6}
                                fontSize={n > 14 ? '8' : '9'}
                                fill={colors.fill}
                                textAnchor="middle"
                                fontWeight="700"
                            >
                                {d.riskIndex.toFixed(2)}
                            </text>

                            {/* X-axis label (rotated) — anchor end so text reads up-left */}
                            <text
                                x={0}
                                y={0}
                                fontSize={labelFontSize}
                                fill="#64748b"
                                textAnchor="end"
                                transform={`translate(${x + barWidth / 2}, ${chartHeight + 28}) rotate(-50)`}
                            >
                                {d.shortLabel}
                            </text>
                        </g>
                    )
                })}

                {/* Y-axis line */}
                <line
                    x1={paddingLeft}
                    y1={20}
                    x2={paddingLeft}
                    y2={chartHeight + 20}
                    stroke="#d1d5db"
                    strokeWidth={1}
                />

                {/* Threshold line at 0.30 — drawn on top of bars */}
                {(() => {
                    const y = chartHeight - THRESHOLD * chartHeight + 20
                    return (
                        <g>
                            <line
                                x1={paddingLeft}
                                y1={y}
                                x2={chartWidth - paddingRight}
                                y2={y}
                                stroke="#967635"
                                strokeWidth={1.8}
                                strokeDasharray="8 4"
                                opacity={0.9}
                            />
                            <text
                                x={chartWidth - paddingRight}
                                y={y - 6}
                                fontSize="9"
                                fill="#967635"
                                textAnchor="end"
                                fontWeight="600"
                            >
                                Soglia 0.30
                            </text>
                        </g>
                    )
                })()}
            </svg>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#4a7c2e' }} />
                    <span>Rischio basso (≤ 0.30)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#d97706' }} />
                    <span>Rischio medio (0.31–0.60)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#dc2626' }} />
                    <span>Rischio alto (&gt; 0.60)</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: '#967635' }} />
                    <span>Soglia accettabilità</span>
                </div>
            </div>

            {/* Overall risk badge */}
            <div className={`mt-4 px-5 py-2.5 rounded-xl text-center border ${isOverallAccettabile
                ? 'bg-[#4a7c2e]/10 border-[#4a7c2e]/20'
                : 'bg-red-50 border-red-200'
                }`}>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Rischio Max</p>
                <p className={`text-xl font-black ${isOverallAccettabile ? 'text-[#4a7c2e]' : 'text-red-600'}`}>
                    {overallRisk.toFixed(2)}
                </p>
            </div>
        </div>
    )
}
