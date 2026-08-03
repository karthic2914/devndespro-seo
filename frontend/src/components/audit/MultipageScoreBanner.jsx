import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faGears, faFileLines, faBolt, faRobot, faBrain, faShieldHalved, faChartLine } from '@fortawesome/free-solid-svg-icons'

const CAT_ICONS = {
  'On-Page SEO': faMagnifyingGlass,
  'Technical SEO': faGears,
  'Content Quality': faFileLines,
  'Page Speed': faBolt,
  'Server & Security': faShieldHalved,
  'Advanced SEO': faChartLine,
  'AI Snippet': faRobot,
  'AEO': faBrain,
}

function scoreColor(s) {
  return s >= 80 ? '#16A34A' : s >= 55 ? '#D97706' : '#DC2626'
}
function scoreBg(s) {
  return s >= 80 ? '#F0FDF4' : s >= 55 ? '#FFFBEB' : '#FEF2F2'
}

function ScoreRing({ score, size = 80 }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0))
  const r = (size - 10) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (safeScore / 100) * circ
  const color = scoreColor(safeScore)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={7} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
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

function ScoreDelta({ change }) {
  if (change === null || change === undefined || change === 0) return null
  const isUp = change > 0
  return (
    <span style={{
      fontSize: 12, fontWeight: 700,
      color: isUp ? '#16A34A' : '#DC2626',
      background: isUp ? '#F0FDF4' : '#FEF2F2',
      padding: '2px 8px', borderRadius: 5,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {isUp ? '\u25B2' : '\u25BC'} {Math.abs(change)}
    </span>
  )
}

export default function MultipageScoreBanner({ results, history = [], onCategoryClick = () => {} }) {
  if (!results) return null

  const categoryScores = results.categoryScores || {}
  const categoryEntries = Object.entries(categoryScores)

  // Assumes history[0] is the run we're currently showing and history[1] is
  // the prior run. If your history endpoint is ordered differently, or
  // doesn't carry siteHealthPct/categoryScores per entry, this just quietly
  // skips the delta and "what changed" sections instead of breaking.
  const prevRun = Array.isArray(history) && history.length > 1 ? history[1] : null
  const prevSiteHealthPct = prevRun && typeof prevRun.siteHealthPct === 'number' ? prevRun.siteHealthPct : null
  const scoreChange = prevSiteHealthPct !== null
    ? Math.round((results.siteHealthPct || 0) - prevSiteHealthPct)
    : null

  const prevCategoryScores = prevRun && prevRun.categoryScores ? prevRun.categoryScores : null
  const changedCategories = prevCategoryScores
    ? categoryEntries
        .map(([cat, score]) => {
          const prevScore = prevCategoryScores[cat]
          if (typeof prevScore !== 'number') return null
          const diff = score - prevScore
          if (diff === 0) return null
          return { cat, diff, direction: diff > 0 ? 'improved' : 'regressed' }
        })
        .filter(Boolean)
    : []

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB',
      padding: '1.25rem 1.5rem', marginBottom: '1rem',
      display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <ScoreRing score={results.siteHealthPct || 0} size={80} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            Site Health Score
            <ScoreDelta change={scoreChange} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {results.totalErrors > 0 && (
              <span style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {results.totalErrors} critical
              </span>
            )}
            {results.totalWarnings > 0 && (
              <span style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {results.totalWarnings} warnings
              </span>
            )}
            {results.healthyCount > 0 && (
              <span style={{ fontSize: 12, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 5, fontWeight: 500 }}>
                {results.healthyCount} healthy
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
            {results.brokenCount || 0} broken &middot; {results.duplicateTitles?.length || 0} duplicate titles &middot; {results.duplicateMetaDescriptions?.length || 0} duplicate meta
          </div>
        </div>
      </div>

      <div style={{ width: 1, height: 60, background: '#F3F4F6', flexShrink: 0 }} />

      <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap' }}>
        {categoryEntries.map(([cat, score]) => (
          <div
            key={cat}
            onClick={() => onCategoryClick(cat.toLowerCase().replace(/\s+/g, '_'))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100, cursor: 'pointer' }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: scoreBg(score),
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FontAwesomeIcon icon={CAT_ICONS[cat] || faMagnifyingGlass} style={{ color: scoreColor(score), fontSize: 15 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 1 }}>{cat}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(score) }}>{score}</div>
            </div>
          </div>
        ))}
      </div>

      {changedCategories.length > 0 && (
        <div style={{ width: '100%', borderTop: '1px solid #F3F4F6', paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            What Changed Since Last Audit
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {changedCategories.map((c, idx) => (
              <div key={c.cat + idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: c.direction === 'regressed' ? '#DC2626' : '#16A34A', fontWeight: 700, width: 14, flexShrink: 0 }}>
                  {c.direction === 'regressed' ? '\u25BC' : '\u25B2'}
                </span>
                <span style={{ color: '#6B7280', minWidth: 120, flexShrink: 0 }}>{c.cat}</span>
                <span style={{ color: '#374151' }}>
                  {c.direction === 'regressed' ? 'dropped' : 'improved'} by {Math.abs(c.diff)} points
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}