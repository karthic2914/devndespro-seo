export function greetingName(user) {
  const name = String(user?.name || '').trim()
  if (name) return name.split(/\s+/)[0]
  const email = String(user?.email || '').split('@')[0]
  return email || 'there'
}

export function sparkSeries(seed, length = 8) {
  const n = Math.abs(Number(seed) || 3)
  return Array.from({ length }, (_, i) => {
    const wave = Math.sin(n / 9 + i * 0.85) * 10
    return Math.max(6, 14 + (n % 13) + wave + i * 1.2)
  })
}

export function Sparkline({ values = [], color = '#7C5CFF' }) {
  const series = values.length ? values : [8, 12, 10, 16, 14, 18, 15, 20]
  const width = 78
  const height = 30
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const span = max - min || 1
  const points = series
    .map((value, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * width
      const y = height - ((value - min) / span) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg className="dash-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

export function SeoBot({ size = 92 }) {
  return (
    <svg
      className="dash-bot"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="48" cy="18" r="5" fill="#6D4AFF" />
      <rect x="46.2" y="8" width="3.6" height="12" rx="1.8" fill="#6D4AFF" />
      <circle cx="48" cy="52" r="32" fill="#F3F0FF" />
      <circle cx="48" cy="52" r="28" fill="#FFFFFF" />
      <rect x="24" y="38" width="48" height="22" rx="11" fill="#2B2118" />
      <circle cx="38" cy="49" r="5" fill="#FFFFFF" />
      <circle cx="58" cy="49" r="5" fill="#FFFFFF" />
      <path d="M40 66c2.4 3.4 13.6 3.4 16 0" stroke="#6D4AFF" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="54" r="5" fill="#E8E2FF" />
      <circle cx="76" cy="54" r="5" fill="#E8E2FF" />
    </svg>
  )
}
