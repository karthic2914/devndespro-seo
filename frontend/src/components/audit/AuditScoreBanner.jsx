import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faGears, faFileLines, faBolt } from '@fortawesome/free-solid-svg-icons'

const CAT_ICONS = {
  'On-Page SEO': faMagnifyingGlass,
  'Technical SEO': faGears,
  'Content Quality': faFileLines,
  'Page Speed': faBolt,
}

function scoreColor(s) {
  return s >= 80 ? '#16A34A' : s >= 55 ? '#D97706' : '#DC2626'
}
function scoreBg(s) {
  return s >= 80 ? '#F0FDF4' : s >= 55 ? '#FFFBEB' : '#FEF2F2'
}

function ScoreRing({ score, size = 88, noAnimation = false }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0))
  const r = (size - 10) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (safeScore / 100) * circ
  const color = scoreColor(safeScore)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={7} />

      {/* Score arc — starts from top (rotated -90deg via transform attribute) */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: noAnimation ? 'none' : 'stroke-dashoffset 0.8s ease' }}
      />

      {/* Score text — centered, no CSS transform needed */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.26}
        fontWeight={700}
        fontFamily="inherit"
      >
        {safeScore}
      </text>
    </svg>
  )
}

export default function AuditScoreBanner({ auditData, categories, isScreenshot = false }) {
  const checks = auditData.checks || []
  const errorCount = checks.filter(i => i.status === 'error').length
  const warnCount  = checks.filter(i => i.status === 'warning').length
  const passCount  = checks.filter(i => i.status === 'pass').length

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
      padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
      display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Score ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <ScoreRing score={auditData.score || 0} size={88} noAnimation={isScreenshot} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Overall Health Score
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {errorCount > 0 && (
              <span style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {errorCount} critical
              </span>
            )}
            {warnCount > 0 && (
              <span style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {warnCount} warnings
              </span>
            )}
            {passCount > 0 && (
              <span style={{ fontSize: 12, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {passCount} passed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 60, background: '#F3F4F6', flexShrink: 0 }} />

      {/* Category scores */}
      <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap' }}>
        {categories.map(cat => cat.score !== null && (
          <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 110 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: scoreBg(cat.score),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FontAwesomeIcon
                icon={CAT_ICONS[cat.name] || faMagnifyingGlass}
                style={{ color: scoreColor(cat.score), fontSize: 15 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 1 }}>{cat.name}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(cat.score) }}>{cat.score}</div>
            </div>
          </div>
        ))}

        {/* PageSpeed */}
        {auditData.speed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 110 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: scoreBg(auditData.speed.performance),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FontAwesomeIcon icon={faBolt} style={{ color: scoreColor(auditData.speed.performance), fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 1 }}>PageSpeed</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(auditData.speed.performance) }}>
                {auditData.speed.performance}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}