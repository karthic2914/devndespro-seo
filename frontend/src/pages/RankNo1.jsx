import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTrophy, faMagnifyingGlass, faCircleNotch, faClock,
  faBolt, faArrowTrendUp, faCircleCheck, faExternalLink,
  faChartLine, faLightbulb, faLink, faRotateRight,
} from '@fortawesome/free-solid-svg-icons'
import { T, PageHeader } from '../components/UI'
import api from '../utils/api'

const DIFF_COLOR = {
  Easy:       { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  Medium:     { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  Hard:       { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  'Very Hard':{ bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
}

const PRIORITY_COLOR = {
  High:   { bg: '#FEE2E2', color: '#DC2626' },
  Medium: { bg: '#FEF3C7', color: '#D97706' },
  Low:    { bg: '#F0FDF4', color: '#16A34A' },
}

function StatPill({ icon, label, value, accent = T.orange }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: '16px 20px', gap: 6, minWidth: 130, flex: 1,
    }}>
      <div style={{ color: accent, fontSize: 17 }}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value || '—'}</div>
      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function PositionBadge({ pos }) {
  const colors = [
    { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' }, // #1
    { bg: '#F3F4F6', color: '#374151', border: '#D1D5DB' }, // #2
    { bg: '#FEF3C7', color: '#78350F', border: '#FDE68A' }, // #3
  ]
  const style = colors[pos - 1] || { bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: style.bg, border: `1px solid ${style.border}`,
      fontWeight: 800, fontSize: 13, color: style.color,
    }}>
      {pos === 1 ? <FontAwesomeIcon icon={faTrophy} style={{ fontSize: 14, color: '#D97706' }} /> : `#${pos}`}
    </div>
  )
}

export default function RankNo1() {
  const { siteId } = useParams()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [keywords, setKeywords] = useState([])

  useEffect(() => {
    api.get(`/sites/${siteId}/keywords`).then(r => setKeywords(r.data)).catch(() => {})
  }, [siteId])

  async function analyze() {
    const kw = keyword.trim()
    if (!kw) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const { data: result } = await api.post(`/sites/${siteId}/serp-analysis`, { keyword: kw })
      setData(result)
    } catch (e) {
      setError(e.response?.data?.error || 'Analysis failed. Please try again.')
    }
    setLoading(false)
  }

  const diff = data?.plan?.difficulty
  const diffStyle = DIFF_COLOR[diff] || DIFF_COLOR.Medium

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      <PageHeader
        title="Rank #1 on Google"
        subtitle="See who's on page 1 for any keyword — and get a step-by-step plan to beat them"
      />

      {/* Search bar */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 24,
        background: '#fff', border: '1px solid #E5E7EB',
        borderRadius: 14, padding: '10px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: '#9CA3AF', fontSize: 15, alignSelf: 'center', flexShrink: 0 }} />
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
          placeholder='Enter a keyword, e.g. "baby sleep consultant"'
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 14,
            color: '#111827', background: 'transparent', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={analyze}
          disabled={loading || !keyword.trim()}
          style={{
            background: loading ? '#F3F4F6' : T.orange, color: loading ? '#9CA3AF' : '#fff',
            border: 'none', borderRadius: 9, padding: '9px 20px',
            cursor: loading || !keyword.trim() ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          {loading
            ? <><FontAwesomeIcon icon={faCircleNotch} spin /> Analyzing…</>
            : <><FontAwesomeIcon icon={faBolt} /> Analyze</>
          }
        </button>
      </div>

      {/* Tracked keyword chips */}
      {keywords.length > 0 && !data && !loading && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Your Tracked Keywords
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {keywords.map(k => (
              <button
                key={k.id}
                onClick={() => { setKeyword(k.keyword) }}
                style={{
                  background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 20,
                  padding: '5px 12px', fontSize: 12, color: '#374151',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151' }}
              >
                {k.keyword}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faCircleNotch} spin style={{ color: T.orange }} />
            Fetching Google Page 1 results and generating your ranking plan…
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              height: 54, background: '#F9FAFB', borderRadius: 10,
              marginBottom: 8, animation: 'shimmer 1.4s ease-in-out infinite',
              opacity: 1 - i * 0.1,
            }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
          padding: '14px 18px', fontSize: 13, color: '#DC2626', marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Stats row */}
          {data.plan && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <StatPill icon={faChartLine} label="Competing sites on Page 1" value={data.results.length || '10'} accent={T.orange} />
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${diffStyle.border}`, borderRadius: 12,
                padding: '16px 20px', gap: 6, minWidth: 130, flex: 1,
                background: diffStyle.bg,
              }}>
                <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: diffStyle.color, fontSize: 17 }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: diffStyle.color, lineHeight: 1 }}>{diff}</div>
                <div style={{ fontSize: 11, color: diffStyle.color, fontWeight: 500, opacity: 0.8 }}>Difficulty</div>
              </div>
              <StatPill icon={faClock} label="Estimated time to rank" value={data.plan.timeEstimate} accent='#7C3AED' />
              <StatPill icon={faLink} label="Backlinks target" value={data.plan.backlinkTarget} accent='#0EA5E9' />
            </div>
          )}

          {/* Quick win banner */}
          {data.plan?.quickWin && (
            <div style={{
              background: `linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)`,
              border: '1px solid #FED7AA', borderRadius: 12,
              padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <FontAwesomeIcon icon={faBolt} style={{ color: T.orange, fontSize: 16, marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Quick Win — Do this week
                </div>
                <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>{data.plan.quickWin}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>

            {/* Page 1 competitors */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FontAwesomeIcon icon={faTrophy} style={{ color: '#D97706', fontSize: 14 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  Google Page 1 — <span style={{ color: T.orange }}>"{data.keyword}"</span>
                </span>
              </div>

              {data.results.length === 0 ? (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  Could not retrieve live results.<br />
                  <span style={{ fontSize: 11, marginTop: 4, display: 'block' }}>Set <code>SERPAPI_KEY</code> in your backend .env for reliable SERP data.</span>
                </div>
              ) : data.results.map(r => (
                <div key={r.position} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 18px', borderBottom: '1px solid #F9FAFB',
                  transition: 'background 0.1s',
                }}>
                  <PositionBadge pos={r.position} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.domain}
                      </span>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ color: '#9CA3AF', fontSize: 9 }}>
                        <FontAwesomeIcon icon={faExternalLink} />
                      </a>
                    </div>
                    {r.snippet && (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.snippet}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Ranking Plan */}
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '14px 18px', borderBottom: '1px solid #F3F4F6',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FontAwesomeIcon icon={faLightbulb} style={{ color: '#7C3AED', fontSize: 14 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Your #1 Ranking Plan</span>
              </div>

              {data.plan ? (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {/* Why it matters + content angle */}
                  {data.plan.whyItMatters && (
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #F9FAFB' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Why this keyword</div>
                      <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, margin: 0 }}>{data.plan.whyItMatters}</p>
                    </div>
                  )}
                  {data.plan.contentAngle && (
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #F9FAFB', background: '#F5F3FF' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Content angle to win</div>
                      <p style={{ fontSize: 12, color: '#4C1D95', lineHeight: 1.6, margin: 0 }}>{data.plan.contentAngle}</p>
                    </div>
                  )}

                  {/* Steps */}
                  {(data.plan.steps || []).map((step, i) => {
                    const pStyle = PRIORITY_COLOR[step.priority] || PRIORITY_COLOR.Medium
                    return (
                      <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid #F9FAFB', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: T.orangeDim, color: T.orange,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800,
                        }}>
                          {step.step || i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{step.title}</span>
                            {step.priority && (
                              <span style={{ fontSize: 10, fontWeight: 700, background: pStyle.bg, color: pStyle.color, borderRadius: 5, padding: '1px 6px' }}>
                                {step.priority}
                              </span>
                            )}
                            {step.timeframe && (
                              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{step.timeframe}</span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{step.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '32px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No plan generated. Please try again.
                </div>
              )}
            </div>
          </div>

          {/* Try another keyword */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              onClick={() => { setData(null); setKeyword('') }}
              style={{
                background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 12, color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 11 }} />
              Analyze another keyword
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.45} }
      `}</style>
    </div>
  )
}
