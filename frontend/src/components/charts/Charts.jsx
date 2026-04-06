/**
 * Chart Components
 * import { RankChart, TrendLine, BarChart, DonutChart } from '../components/charts/Charts'
 *
 * No external dependencies — pure SVG
 */

import { useState } from 'react'
import { T } from '../UI'

// ─────────────────────────────────────────────
// TREND LINE — mini sparkline for stat cards
// Usage: <TrendLine data={[4,7,5,9,12,10,15]} color={T.green} />
// ─────────────────────────────────────────────
export function TrendLine({ data = [], color = T.orange, width = 80, height = 32, filled = true }) {
  if (!data.length) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 3

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + ((max - v) / range) * (height - pad * 2)
    return `${x},${y}`
  })

  const polyline = pts.join(' ')
  const area = `${pad},${height} ${polyline} ${width - pad},${height}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible">
      {filled && (
        <polygon points={area} fill={color} opacity="0.12" />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1].split(',')[0]}
          cy={pts[pts.length - 1].split(',')[1]}
          r="3" fill={color}
        />
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────
// RANK CHART — keyword position over time
// Usage: <RankChart data={[{date:'2026-01-01', position:14}, ...]} keyword="web design norway" />
// Note: Lower position = better (rank 1 is best)
// ─────────────────────────────────────────────
export function RankChart({ data = [], keyword, width = '100%', height = 200 }) {
  const [tooltip, setTooltip] = useState(null)

  if (!data.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 13 }}>
      No ranking data yet
    </div>
  )

  const positions = data.map(d => d.position)
  const maxPos = Math.max(...positions)
  const minPos = Math.min(...positions)
  const range = maxPos - minPos || 1

  const W = 600
  const H = height
  const padX = 40, padY = 20

  const pts = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (W - padX * 2)
    // Invert: lower rank = higher on chart
    const y = padY + ((d.position - minPos) / range) * (H - padY * 2)
    return { x, y, ...d }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `${pts[0].x},${H} ${polyline} ${pts[pts.length - 1].x},${H}`

  const top3Color = minPos <= 3 ? T.green : T.orange

  return (
    <div style={{ position: 'relative' }}>
      {keyword && (
        <div style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 8 }}>
          Rankings for: <span style={{ color: T.text }}>{keyword}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height, overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = padY + (pct / 100) * (H - padY * 2)
          const pos = Math.round(minPos + (pct / 100) * range)
          return (
            <g key={pct}>
              <line x1={padX} y1={y} x2={W - padX} y2={y} stroke={T.border} strokeWidth="1" strokeDasharray="4 4" />
              <text x={padX - 6} y={y + 4} fontSize="10" fill={T.muted} textAnchor="end">#{pos}</text>
            </g>
          )
        })}

        {/* Area fill */}
        <polygon points={area} fill={top3Color} opacity="0.07" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={top3Color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {pts.map((p, i) => (
          <g key={i}
            onMouseEnter={() => setTooltip(p)}
          >
            <circle cx={p.x} cy={p.y} r="8" fill="transparent" />
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={top3Color} strokeWidth="2" />
          </g>
        ))}

        {/* X-axis labels */}
        {pts.filter((_, i) => i % Math.ceil(pts.length / 5) === 0 || i === pts.length - 1).map((p, i) => (
          <text key={i} x={p.x} y={H + 14} fontSize="10" fill={T.muted} textAnchor="middle">
            {new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: `${(tooltip.x / 600) * 100}%`,
          top: `${(tooltip.y / height) * 100}%`,
          transform: 'translate(-50%, -120%)',
          background: T.text,
          color: '#fff',
          padding: '6px 10px',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          #{tooltip.position} · {new Date(tooltip.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// BAR CHART — horizontal bars for traffic/volume
// Usage: <BarChart data={[{label:'Jan', value:120}, ...]} color={T.orange} />
// ─────────────────────────────────────────────
export function BarChart({ data = [], color = T.orange, height = 160, showValues = true }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = 100 / data.length

  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 4px' }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            {showValues && d.value > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: T.text2, fontFamily: 'DM Mono, monospace' }}>
                {d.value > 999 ? `${(d.value/1000).toFixed(1)}k` : d.value}
              </div>
            )}
            <div style={{
              width: '80%', height: `${Math.max(pct, 2)}%`,
              background: d.color || color,
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.4s ease',
              opacity: 0.85,
            }} />
            <div style={{ fontSize: 10, color: T.muted, textAlign: 'center', lineHeight: 1.2 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// DONUT CHART — for score breakdowns
// Usage: <DonutChart segments={[{label:'Technical', value:80, color:T.green}, ...]} />
// ─────────────────────────────────────────────
export function DonutChart({ segments = [], size = 120, strokeWidth = 16 }) {
  const r = (size / 2) - strokeWidth
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, d) => s + d.value, 0) || 1

  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ
          const gap = circ - dash
          const el = (
            <circle
              key={i}
              cx={size/2} cy={size/2} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.text2 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text, marginLeft: 'auto', fontFamily: 'DM Mono, monospace' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
