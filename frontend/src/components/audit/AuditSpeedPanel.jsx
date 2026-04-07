export default function AuditSpeedPanel({ speed }) {
  if (!speed) return null

  const metrics = [
    { label: 'LCP', value: speed.lcp, good: '< 2.5s', desc: 'Largest Contentful Paint', goodThreshold: 2.5, unit: 's' },
    { label: 'CLS', value: speed.cls, good: '< 0.1',  desc: 'Cumulative Layout Shift',  goodThreshold: 0.1, unit: ''  },
    { label: 'TBT', value: speed.tbt, good: '< 200ms', desc: 'Total Blocking Time',     goodThreshold: 200, unit: 'ms' },
    { label: 'FCP', value: speed.fcp, good: '< 1.8s', desc: 'First Contentful Paint',   goodThreshold: 1.8, unit: 's' },
  ].filter(m => m.value)

  function getStatus(label, value) {
    const num = parseFloat(value)
    if (isNaN(num)) return 'unknown'
    if (label === 'CLS') return num < 0.1 ? 'good' : num < 0.25 ? 'warn' : 'bad'
    if (label === 'LCP') return num < 2.5 ? 'good' : num < 4 ? 'warn' : 'bad'
    if (label === 'TBT') return num < 200 ? 'good' : num < 600 ? 'warn' : 'bad'
    if (label === 'FCP') return num < 1.8 ? 'good' : num < 3 ? 'warn' : 'bad'
    return 'unknown'
  }

  const statusStyle = {
    good:    { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Good' },
    warn:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', label: 'Needs Work' },
    bad:     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', label: 'Poor' },
    unknown: { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', label: '—' },
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      {metrics.map(m => {
        const st = getStatus(m.label, m.value)
        const s = statusStyle[st]
        return (
          <div key={m.label} style={{
            background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB',
            padding: '12px 16px', flex: 1, minWidth: 120,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em' }}>{m.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontFamily: 'monospace', marginBottom: 2 }}>
              {m.value}
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>{m.desc} · target {m.good}</div>
          </div>
        )
      })}
    </div>
  )
}
