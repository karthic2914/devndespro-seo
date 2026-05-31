import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faGears, faFileLines, faBolt, faRobot, faBrain, faWandMagicSparkles, faCommentDots, faStar } from '@fortawesome/free-solid-svg-icons'

const CAT_ICONS = {
  'On-Page SEO': faMagnifyingGlass,
  'Technical SEO': faGears,
  'Content Quality': faFileLines,
  'Page Speed': faBolt,
  'AI Snippet': faRobot,
  'AEO': faBrain,
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

      {/* Score arc - starts from top (rotated -90deg via transform attribute) */}
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

      {/* Score text - centered, no CSS transform needed */}
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

<style>{`
  @media (max-width: 768px) {
    .ai-engines-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .audit-cats-grid { grid-template-columns: repeat(3, 1fr) !important; }
  }
  @media (max-width: 480px) {
    .ai-engines-grid { grid-template-columns: repeat(1, 1fr) !important; }
    .audit-cats-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
`}</style>


export default function AuditScoreBanner({ auditData, categories, isScreenshot = false, aiScores = {}, cronEnabled = false, onCronToggle = () => {} }) {
  const navigate = useNavigate()
  const { siteId } = useParams()
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
      {/* AI Engine Visibility */}
      <div style={{ width: '100%', borderTop: '1px solid #F3F4F6', paddingTop: 14, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Engine Visibility
          </div>

          {!isScreenshot && <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <span>Daily Tracking</span>
            <span style={{
              width: 42,
              height: 24,
              borderRadius: 999,
              background: cronEnabled ? '#F97316' : '#E5E7EB',
              position: 'relative',
              transition: 'background 0.2s ease',
              boxShadow: cronEnabled ? '0 0 0 3px rgba(249,115,22,0.12)' : 'none'
            }}>
              <input
                type="checkbox"
                checked={!!cronEnabled}
                onChange={(e) => onCronToggle(e.target.checked)}
                style={{ opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'pointer' }}
              />
              <span style={{
                position: 'absolute',
                top: 3,
                left: cronEnabled ? 21 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                pointerEvents: 'none'
              }} />
            </span>
          </label>}
        </div>
        <div className='ai-engines-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {[
            { key: 'chatgpt', label: 'ChatGPT', score: aiScores.chatgpt, bg: '#000', icon: faRobot },
            { key: 'claude', label: 'Claude', score: aiScores.claude, bg: '#D85A30', icon: faWandMagicSparkles },
            { key: 'perplexity', label: 'Perplexity', score: null, soon: true },
            { key: 'gemini', label: 'Gemini', score: null, soon: true },
          ].map(({ key, label, score, bg, icon, soon }) => (
            <div
              key={key}
              onClick={() => !soon && navigate(`/site/${siteId}/ai-visibility`)}
              style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10,
                padding: '10px 12px', cursor: soon ? 'default' : 'pointer',
                opacity: soon ? 0.5 : 1, transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (!soon) e.currentTarget.style.borderColor = '#F97316' }}
              onMouseLeave={e => { if (!soon) e.currentTarget.style.borderColor = '#E5E7EB' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, background: bg || '#E5E7EB', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                  {icon ? <FontAwesomeIcon icon={icon} style={{ color: '#fff', fontSize: 13 }} /> : '?'}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
                {!soon && <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginLeft: 'auto', fontSize: 10, color: '#9CA3AF' }} />}
              </div>
              {soon ? (
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Coming soon</div>
              ) : score != null ? (
                <>
                  <div style={{ background: '#E5E7EB', borderRadius: 3, height: 4, overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ width: score + '%', height: '100%', background: score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626', borderRadius: 3 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626' }}>{score}/100</span>
                    <span style={{ fontSize: 10, color: score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626' }}>
                      {score >= 80 ? 'Excellent' : score >= 50 ? 'Average' : score > 0 ? 'Below avg' : 'Poor'}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#9CA3AF', cursor: 'pointer' }} onClick={() => navigate('ai-visibility')}>Click to test ?</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

