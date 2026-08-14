import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faChevronDown,
  faChevronUp,
  faXmark,
  faBolt,
} from '@fortawesome/free-solid-svg-icons'
import { BrandFavicon } from './SiteFavicon'
import api from '../utils/api'

const cardStyle = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 14,
  padding: 16,
  boxSizing: 'border-box',
  boxShadow: '0 1px 2px rgba(15,23,42,.04)',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 280,
}

const titleStyle = {
  fontSize: 14,
  fontWeight: 800,
  color: '#0F172A',
  letterSpacing: '-0.01em',
}

function useScanRefresh(callback) {
  useEffect(() => {
    const handler = () => callback()
    window.addEventListener('ai-visibility-scan-complete', handler)
    return () => window.removeEventListener('ai-visibility-scan-complete', handler)
  }, [callback])
}

function normaliseEngine(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, '')
}

function priorityColors(priority) {
  if (priority === 'High') return { bg: '#FEE2E2', color: '#DC2626' }
  if (priority === 'Medium') return { bg: '#FEF3C7', color: '#D97706' }
  return { bg: '#DCFCE7', color: '#15803D' }
}

function scrollToQuestions() {
  const el = document.getElementById('ai-questions-panel')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function linkStyle() {
  return {
    border: 0,
    background: 'transparent',
    color: '#EA580C',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    whiteSpace: 'nowrap',
  }
}

function actionForReason(issue = '') {
  const t = issue.toLowerCase()
  if (t.includes('schema') || t.includes('structured')) {
    return { label: 'Open Site Audit', path: 'audit' }
  }
  if (t.includes('backlink') || t.includes('citation') || t.includes('authority') || t.includes('review')) {
    return { label: 'Improve backlinks', path: 'backlinks' }
  }
  if (t.includes('content') || t.includes('topical') || t.includes('fresh')) {
    return { label: 'Open Action Plan', path: 'actions' }
  }
  if (t.includes('network') || t.includes('portfolio')) {
    return { label: 'Track competitors', path: 'competitors' }
  }
  return { label: 'Open Action Plan', path: 'actions' }
}

const ENGINE_ROWS = [
  { key: 'chatgpt', label: 'ChatGPT', live: true, color: '#10A37F' },
  { key: 'claude', label: 'Claude', live: true, color: '#D85A30' },
  { key: 'gemini', label: 'Gemini', live: false, color: '#4285F4' },
  { key: 'perplexity', label: 'Perplexity', live: false, color: '#20808D' },
]

export function VisibilityEngineTable({ siteId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [showUpcoming, setShowUpcoming] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/engine-breakdown')
      .then(res => setRows(res.data.breakdown || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => load(), [load])
  useScanRefresh(load)

  const byEngine = Object.fromEntries(
    (rows || []).map(r => [normaliseEngine(r.engine), r])
  )
  const liveRows = ENGINE_ROWS.filter(e => e.live)
  const upcoming = ENGINE_ROWS.filter(e => !e.live)
  const hasAnyScan = liveRows.some(e => byEngine[e.key]?.hasData)
  const anyMention = liveRows.some(e => (byEngine[e.key]?.mentionRate || 0) > 0)
  const avgMention = (() => {
    const scanned = liveRows.filter(e => byEngine[e.key]?.hasData)
    if (!scanned.length) return 0
    return Math.round(
      scanned.reduce((s, e) => s + Number(byEngine[e.key]?.mentionRate || 0), 0) / scanned.length
    )
  })()

  return (
    <div id="ai-vis-engine-card" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={titleStyle}>AI Visibility by Engine</div>
        <button type="button" onClick={() => setShowDetails(true)} style={linkStyle()}>
          View details →
        </button>
      </div>

      {!loading && hasAnyScan && !anyMention && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 4,
            padding: '10px 12px',
            borderRadius: 10,
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#9A3412', marginBottom: 4 }}>
            Not mentioned yet
          </div>
          <div style={{ fontSize: 11, color: '#C2410C', lineHeight: 1.45, marginBottom: 8 }}>
            ChatGPT and Claude answered your tested questions, but neither named your brand.
          </div>
          <button
            type="button"
            onClick={scrollToQuestions}
            style={{
              border: 0,
              background: '#F97316',
              color: '#fff',
              borderRadius: 7,
              padding: '7px 11px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FontAwesomeIcon icon={faBolt} />
            Test a “best / hire” question
          </button>
        </div>
      )}

      {!loading && !hasAnyScan && (
        <div style={{ marginTop: 12, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
          No engine scans yet. Test a question above to measure mention rate.
        </div>
      )}

      <div style={{ fontSize: 11, color: '#64748B', margin: '10px 0 12px' }}>
        {loading
          ? 'Loading...'
          : hasAnyScan
            ? `Your mention rate: ${avgMention}% across live engines`
            : 'Mention rate after scans'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
        {liveRows.map(meta => {
          const data = byEngine[meta.key]
          const hasData = !!data?.hasData
          const rate = hasData ? Number(data.mentionRate || 0) : 0
          const bestRank = data?.bestRank
          const statusLabel = !hasData
            ? 'No scans'
            : bestRank
              ? `#${bestRank}`
              : 'Not mentioned'

          return (
            <div
              key={meta.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '26px minmax(70px, 84px) minmax(0, 1fr) auto',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <BrandFavicon name={meta.label} size={20} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{meta.label}</span>
              <div style={{ height: 7, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, rate)}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: rate > 0
                      ? `linear-gradient(90deg, ${meta.color}aa, ${meta.color})`
                      : 'transparent',
                    transition: 'width .35s ease',
                  }}
                />
              </div>
              <div style={{ textAlign: 'right', minWidth: 78 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                  {hasData ? `${rate}%` : '—'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: bestRank ? '#16A34A' : '#94A3B8' }}>
                  {statusLabel}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowUpcoming(v => !v)}
        style={{
          marginTop: 12,
          border: '1px dashed #E5E7EB',
          background: '#FAFAFA',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 11,
          fontWeight: 650,
          color: '#64748B',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <span>Upcoming engines (Gemini, Perplexity)</span>
        <FontAwesomeIcon icon={showUpcoming ? faChevronUp : faChevronDown} />
      </button>

      {showUpcoming && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.map(meta => (
            <div key={meta.key} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.75 }}>
              <BrandFavicon name={meta.label} size={18} />
              <span style={{ fontSize: 12, fontWeight: 650, color: '#475569', flex: 1 }}>{meta.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>Coming soon</span>
            </div>
          ))}
        </div>
      )}

      {showDetails && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDetails(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 5000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E5E7EB',
              boxShadow: '0 20px 50px rgba(15,23,42,0.2)',
              padding: 18,
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>What these numbers mean</div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={{ border: 0, background: '#F8FAFC', width: 28, height: 28, borderRadius: 8, cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, marginBottom: 14 }}>
              <strong>Mention rate</strong> = how often your brand appears in that engine’s answers.
              <br />
              <strong>Best rank</strong> = your highest position when mentioned (lower is better).
              <br />
              <strong>Not mentioned</strong> means the engine answered, but recommended other brands.
            </div>

            {liveRows.map(meta => {
              const data = byEngine[meta.key]
              return (
                <div key={meta.key} style={{ padding: '10px 0', borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <BrandFavicon name={meta.label} size={18} />
                    <strong style={{ fontSize: 13 }}>{meta.label}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {data?.hasData
                      ? `${data.mentionRate}% mention rate · ${data.bestRank ? `best #${data.bestRank}` : 'not in Top 10'} · avg ${data.averagePosition ?? 'N/A'}`
                      : 'No scans yet for this engine.'}
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => {
                setShowDetails(false)
                scrollToQuestions()
              }}
              style={{
                marginTop: 14,
                width: '100%',
                padding: '10px 0',
                borderRadius: 8,
                border: 0,
                background: '#F97316',
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Test another question
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function VisibilityReasoningCard({ siteId, siteName, productName }) {
  const navigate = useNavigate()
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(0)

  const loadReasons = useCallback((opts = {}) => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)
    const force = !!opts.force
    const req = force
      ? api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName, productName, force: true })
      : api.get('/sites/' + siteId + '/ai-visibility/insights').then(async (res) => {
          const cached = res.data?.reasoning || []
          if (cached.length) return { data: { reasoning: cached } }
          return api.post('/sites/' + siteId + '/ai-visibility/reasoning', {
            siteName,
            productName,
            force: true,
          })
        })

    req
      .then(res => setReasons(res.data.reasoning || []))
      .catch(() => setReasons([]))
      .finally(() => setLoading(false))
  }, [siteId, siteName, productName])

  useEffect(() => loadReasons({ force: false }), [loadReasons])
  useScanRefresh(() => loadReasons({ force: false }))

  const highCount = reasons.filter(r => r.severity === 'High').length

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={titleStyle}>Why You're Not Ranking Higher</div>
        <button
          type="button"
          onClick={() => navigate(`/site/${siteId}/actions`)}
          style={linkStyle()}
        >
          Action plan →
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#64748B', margin: '8px 0 10px' }}>
        {loading
          ? 'Analysing latest scan...'
          : reasons.length
            ? `${highCount} high-priority gap${highCount === 1 ? '' : 's'} from your scans`
            : 'Based on your latest visibility scan results.'}
      </div>

      {!loading && !reasons.length && (
        <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.45 }}>
          Run a visibility scan first. Reasons appear from real ranking gaps.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {reasons.slice(0, 5).map((r, i) => {
          const p = priorityColors(r.severity)
          const open = expanded === i
          const action = actionForReason(r.issue)
          return (
            <div
              key={i}
              style={{
                border: '1px solid #F1F5F9',
                borderRadius: 10,
                background: open ? '#FFFCFA' : '#fff',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? -1 : i)}
                style={{
                  width: '100%',
                  border: 0,
                  background: 'transparent',
                  display: 'grid',
                  gridTemplateColumns: '10px minmax(0,1fr) auto auto',
                  gap: 8,
                  alignItems: 'center',
                  padding: '10px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: p.color,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 650, color: '#0F172A', lineHeight: 1.35 }}>
                  {r.issue}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: p.bg,
                    color: p.color,
                    fontWeight: 800,
                  }}
                >
                  {r.severity || 'Low'}
                </span>
                <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ fontSize: 10, color: '#94A3B8' }} />
              </button>

              {open && (
                <div style={{ padding: '0 10px 10px 28px' }}>
                  {r.detail && (
                    <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5, marginBottom: 8 }}>
                      {r.detail}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate(`/site/${siteId}/${action.path}`)}
                    style={{
                      border: '1px solid #FDBA74',
                      background: '#FFF7ED',
                      color: '#EA580C',
                      borderRadius: 7,
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {action.label}
                    <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 9 }} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function VisibilityCompetitorsPanel({ siteId, siteName = '' }) {
  const navigate = useNavigate()
  const [data, setData] = useState({ yourScore: 0, competitors: [], totalScans: 0 })
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(() => {
    if (!siteId) return
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/competitors', {
      params: { siteName },
    })
      .then(res => setData(res.data || { yourScore: 0, competitors: [] }))
      .catch(() => setData({ yourScore: 0, competitors: [] }))
      .finally(() => setLoading(false))
  }, [siteId, siteName])

  useEffect(() => load(), [load])
  useScanRefresh(load)

  const yourScore = Number(data.yourScore || 0)
  const allCompetitors = data.competitors || []
  const competitors = showAll ? allCompetitors : allCompetitors.slice(0, 5)
  const maxScore = Math.max(1, ...allCompetitors.map(c => c.visibilityScore || 0), yourScore)
  const leader = allCompetitors[0]

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={titleStyle}>Top Competitors</div>
        <button
          type="button"
          onClick={() => {
            if (allCompetitors.length > 5 && !showAll) {
              setShowAll(true)
              return
            }
            navigate(`/site/${siteId}/competitors`)
          }}
          style={linkStyle()}
        >
          {showAll || allCompetitors.length <= 5 ? 'Manage →' : 'View all →'}
        </button>
      </div>

      {!loading && allCompetitors.length > 0 && (
        <div
          style={{
            marginTop: 10,
            marginBottom: 8,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <div style={{ background: '#F8FAFC', borderRadius: 9, padding: '8px 10px', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>You</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: yourScore > 0 ? '#16A34A' : '#0F172A' }}>
              {yourScore}%
            </div>
          </div>
          <div style={{ background: '#FFF7ED', borderRadius: 9, padding: '8px 10px', border: '1px solid #FED7AA' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase' }}>Leader</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#9A3412', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {leader?.name || '—'} · {leader?.visibilityScore ?? 0}%
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, lineHeight: 1.4 }}>
        {loading
          ? 'Loading...'
          : yourScore === 0 && allCompetitors.length
            ? 'AI names these brands instead of you. Click a row for details.'
            : 'Share of AI answers where each brand appears vs you.'}
      </div>

      {!loading && !competitors.length ? (
        <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.45 }}>
          Test questions to discover which brands AI recommends instead of you.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {competitors.map(c => {
            const open = expanded === c.name
            const barPct = Math.round(((c.visibilityScore || 0) / maxScore) * 100)
            const gap = Math.max(0, (c.visibilityScore || 0) - yourScore)
            return (
              <div key={c.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : c.name)}
                  style={{
                    width: '100%',
                    border: 0,
                    background: 'transparent',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.15fr) minmax(88px,1fr) 52px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 0',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <BrandFavicon name={c.name} size={16} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${barPct}%`,
                          height: '100%',
                          borderRadius: 99,
                          background: 'linear-gradient(90deg,#FB923C,#F97316)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#334155', minWidth: 28 }}>
                      {c.visibilityScore}%
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, textAlign: 'right', color: gap > 0 ? '#EA580C' : '#16A34A' }}>
                    {gap > 0 ? `+${gap}` : 'Tied'}
                  </span>
                </button>

                {open && (
                  <div style={{ padding: '0 0 10px 24px', fontSize: 11, color: '#64748B', lineHeight: 1.45 }}>
                    Mentioned in {c.mentions} answer{c.mentions === 1 ? '' : 's'}
                    {c.averageRank != null ? ` · avg rank #${c.averageRank}` : ''}.
                    {yourScore === 0
                      ? ' Your brand was not mentioned in those answers.'
                      : ` You trail by ${gap} points.`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {allCompetitors.length > 0 && (
        <button
          type="button"
          onClick={scrollToQuestions}
          style={{
            marginTop: 12,
            width: '100%',
            border: '1px solid #FDBA74',
            background: '#FFF7ED',
            color: '#EA580C',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Close the gap - test more questions
        </button>
      )}

      {showAll && allCompetitors.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          style={{
            marginTop: 8,
            border: 0,
            background: 'transparent',
            color: '#64748B',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Show less
        </button>
      )}
    </div>
  )
}
