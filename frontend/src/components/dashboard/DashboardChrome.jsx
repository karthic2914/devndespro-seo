import { useId } from 'react'

export function greetingName(user) {
  const name = String(user?.name || '').trim()
  if (name) return name.split(/\s+/)[0]
  const email = String(user?.email || '').split('@')[0]
  return email || 'there'
}

export function sparkSeries(seed, length = 8) {
  const n = Math.abs(Number(seed) || 3)
  return Array.from({ length }, (_, i) => {
    const wave = Math.sin(n / 7 + i * 1.15) * 14
    const bounce = ((n + i * 5) % 11) * 1.8
    return Math.max(8, 16 + wave + bounce)
  })
}

export function Sparkline({ values = [], color = '#7C5CFF' }) {
  const rawId = useId().replace(/:/g, '')
  const series = values.length ? values : [10, 16, 12, 22, 18, 26, 20, 28]
  const width = 86
  const height = 38
  const max = Math.max(...series, 1)
  const gap = 3.2
  const barWidth = (width - gap * (series.length - 1)) / series.length

  return (
    <svg className="dash-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`dash-bar-${rawId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {series.map((value, index) => {
        const barHeight = Math.max(5, (value / max) * (height - 2))
        return (
          <rect
            key={index}
            x={(barWidth + gap) * index}
            y={height - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2.4}
            fill={`url(#dash-bar-${rawId})`}
          />
        )
      })}
    </svg>
  )
}

export function InsightMark({ size = 36 }) {
  return (
    <span className="dash-insight-mark" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="18" fill="#F3F0FF" />
        <path
          d="M18 9.5l1.15 4.35L23.5 15 19.15 16.15 18 20.5l-1.15-4.35L12.5 15l4.35-1.15L18 9.5z"
          fill="#6D4AFF"
        />
        <path
          d="M25.2 20.2l.7 2.15 2.15.7-2.15.7-.7 2.15-.7-2.15-2.15-.7 2.15-.7.7-2.15z"
          fill="#8B74FF"
        />
      </svg>
    </span>
  )
}
