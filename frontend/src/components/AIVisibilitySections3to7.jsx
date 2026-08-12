import { useState, useEffect, useCallback, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWandMagicSparkles,
  faRotateRight,
  faArrowRight,
  faHistory,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'

const ENGINE_STYLE = {
  chatgpt: { label: 'ChatGPT', color: '#10A37F' },
  claude: { label: 'Claude', color: '#D85A30' },
  gemini: { label: 'Gemini', color: '#4285F4' },
  perplexity: { label: 'Perplexity', color: '#20808D' },
}

function priorityColors(priority) {
  if (priority === 'High') return { bg: '#FEE2E2', color: '#DC2626' }
  if (priority === 'Medium') return { bg: '#FEF3C7', color: '#D97706' }
  return { bg: '#DCFCE7', color: '#15803D' }
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 16,
  boxSizing: 'border-box',
}

const titleStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#111827',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const subStyle = {
  fontSize: 11,
  color: '#6B7280',
  marginTop: 4,
  marginBottom: 12,
}

const numberBadge = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: '#F97316',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 800,
  flexShrink: 0,
}

const emptyStyle = {
  padding: '14px 0 4px',
  fontSize: 12,
  color: '#9CA3AF',
}

const primaryBtn = disabled => ({
  padding: '8px 13px',
  borderRadius: 7,
  border: '1px solid #F97316',
  background: disabled ? '#F9FAFB' : '#fff',
  color: disabled ? '#9CA3AF' : '#F97316',
  fontWeight: 700,
  fontSize: 11,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: 7,
})

function normaliseEngine(value = '') {
  return String(value).toLowerCase().replace(/\s+/g, '')
}

function dispatchScanComplete() {
  window.dispatchEvent(new CustomEvent('ai-visibility-scan-complete'))
}

function useScanRefresh(callback) {
  useEffect(() => {
    const handler = () => callback()
    window.addEventListener('ai-visibility-scan-complete', handler)
    return () => window.removeEventListener('ai-visibility-scan-complete', handler)
  }, [callback])
}

// ---------- Section 3: multi-engine comparison ----------
export function VisibilityResultsCard({
  siteId,
  siteName,
  questions,
  productName = ''
}) {
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState({})
  const [selectedQuestion, setSelectedQuestion] = useState(
    questions?.[0] || ''
  )
  const [activeEngine, setActiveEngine] = useState('chatgpt')
  const [compareEngines, setCompareEngines] = useState(false)

  const scannedQuestionsRef = useRef(new Set())

  const liveEngines = ['chatgpt', 'claude']

  const allEngines = [
    { key: 'chatgpt', label: 'ChatGPT', status: 'Top 10' },
    { key: 'claude', label: 'Claude', status: 'Top 10' },
    { key: 'gemini', label: 'Gemini', status: 'Coming soon' },
    { key: 'perplexity', label: 'Perplexity', status: 'Coming soon' },
  ]

  // When Compare Engines is ON, show all 4 engine columns side by side.
  // When OFF, show only the currently selected engine tab's column.
  const visibleEngines = compareEngines
    ? ['chatgpt', 'claude', 'gemini', 'perplexity']
    : [activeEngine]

  const tableColumns = `55px minmax(180px, 2fr) repeat(${visibleEngines.length}, minmax(80px, 1fr))`

  useEffect(() => {
    if (
      questions?.length &&
      !questions.includes(selectedQuestion)
    ) {
      setSelectedQuestion(questions[0])
    }
  }, [questions, selectedQuestion])

  async function scanQuestion(question) {
    if (!question || scanning) return

    if (scannedQuestionsRef.current.has(question)) {
      return
    }

    setScanning(true)

    try {
      const res = await api.post(
        '/sites/' + siteId + '/ai-visibility/scan',
        {
          siteName,
          questions: [question],
        }
      )

      const questionResult = (res.data.results || []).find(
        item => item.question === question
      )

      const byEngine = {}

      for (const result of questionResult?.results || []) {
        byEngine[result.engine] = result
      }

      setScanResults(prev => ({
        ...prev,
        [question]: byEngine,
      }))

      scannedQuestionsRef.current.add(question)

      window.dispatchEvent(
        new CustomEvent('ai-visibility-scan-complete')
      )
    } catch (e) {
      console.error(
        'Visibility scan failed:',
        e?.response?.data || e
      )
    } finally {
      setScanning(false)
    }
  }

  // AUTO-SCAN
  // First generated question is scanned automatically.
  useEffect(() => {
    if (
      selectedQuestion &&
      !scannedQuestionsRef.current.has(selectedQuestion)
    ) {
      scanQuestion(selectedQuestion)
    }
  }, [selectedQuestion])

  const currentResults =
    scanResults[selectedQuestion] || {}

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/\.(com|no|net|org|io|co)$/g, '')
      .replace(/[^a-z0-9]/g, '')
  }

  function getEngineTop10(engine) {
    return currentResults?.[engine]?.top10 || []
  }

  function getRank(engine, brand) {
    const needle = normalize(brand)

    const hit = getEngineTop10(engine).find(
      item => normalize(item.name) === needle
    )

    return hit ? Number(hit.rank) : null
  }

  /*
   * The selected engine defines the main ranking/order.
   * This matches the approved UX:
   *
   * Rank | Brand/Product | ChatGPT | Claude | ...
   */
  const activeTop10 = getEngineTop10(activeEngine)

  /*
   * If selected active engine has no data, fall back
   * to the first live engine that has results.
   */
  const baseTop10 =
    activeTop10.length > 0
      ? activeTop10
      : getEngineTop10('chatgpt').length
        ? getEngineTop10('chatgpt')
        : getEngineTop10('claude')

  const brandNeedle = normalize(siteName)

  const siteAlreadyInRows = baseTop10.some(
    item => {
      const candidate = normalize(item.name)

      return (
        candidate === brandNeedle ||
        candidate.includes(brandNeedle) ||
        brandNeedle.includes(candidate)
      )
    }
  )

  function renderEngineRank(engine, brand, rowRank) {
    if (!liveEngines.includes(engine)) {
      return (
        <span style={{ color: '#9CA3AF' }}>-</span>
      )
    }

    const rank = getRank(engine, brand)

    if (!rank) {
      return (
        <span style={{ color: '#9CA3AF' }}>-</span>
      )
    }

    if (rank === rowRank) {
      return (
        <span
          style={{
            color: '#16A34A',
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          ✓
        </span>
      )
    }

    return (
      <span
        style={{
          color: '#111827',
          fontWeight: 700,
        }}
      >
        {rank}
      </span>
    )
  }

  function renderOwnBrandRank(engine) {
    if (!liveEngines.includes(engine)) {
      return (
        <span style={{ color: '#9CA3AF' }}>-</span>
      )
    }

    const rank = getRank(engine, siteName)

    if (rank) {
      return (
        <span
          style={{
            fontWeight: 800,
            color: '#16A34A',
          }}
        >
          {rank}
        </span>
      )
    }

    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 7px',
          borderRadius: 5,
          border: '1px solid #FCA5A5',
          background: '#FEF2F2',
          color: '#DC2626',
          fontSize: 10,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}
      >
        Not in Top 10
      </span>
    )
  }

  return (
    <div style={cardStyle}>

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={titleStyle}>
            AI Visibility Results
            {productName &&
              productName !== 'All Questions' && (
                <span
                  style={{
                    fontWeight: 500,
                    marginLeft: 5,
                    color: '#374151',
                  }}
                >
                  ({productName})
                </span>
              )}
          </div>
        </div>

        <div
          onClick={() => setCompareEngines(v => !v)}
          role="switch"
          aria-checked={compareEngines}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCompareEngines(v => !v)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#374151',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span>Compare Engines</span>

          <div
            style={{
              width: 30,
              height: 17,
              background: compareEngines ? '#F97316' : '#E5E7EB',
              borderRadius: 10,
              padding: 2,
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: '#fff',
                transform: compareEngines ? 'translateX(13px)' : 'translateX(0)',
                transition: 'transform 0.15s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* QUESTION SELECT */}
      {!!questions?.length && (
        <select
          value={selectedQuestion}
          onChange={e =>
            setSelectedQuestion(e.target.value)
          }
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '9px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: 7,
            marginBottom: 12,
            fontSize: 12,
            color: '#111827',
            background: '#fff',
          }}
        >
          {questions.map(q => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      )}

      {/* ENGINE TABS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(4, minmax(0, 1fr))',
          border: '1px solid #E5E7EB',
          borderRadius: '8px 8px 0 0',
          overflow: 'hidden',
        }}
      >
        {allEngines.map(engine => {
          const active =
            activeEngine === engine.key

          const disabled =
            !liveEngines.includes(engine.key)

          return (
            <button
              key={engine.key}
              disabled={disabled}
              onClick={() =>
                !disabled &&
                setActiveEngine(engine.key)
              }
              style={{
                padding: '11px 12px',
                textAlign: 'left',
                border: 0,
                borderRight:
                  '1px solid #E5E7EB',
                borderBottom: active
                  ? '3px solid #6366F1'
                  : '3px solid transparent',
                background: '#fff',
                cursor: disabled
                  ? 'default'
                  : 'pointer',
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color:
                    engine.key === 'chatgpt'
                      ? '#10A37F'
                      : engine.key === 'claude'
                        ? '#D85A30'
                        : '#6366F1',
                }}
              >
                {engine.label}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                {engine.status}
              </div>
            </button>
          )
        })}
      </div>

      {/* LOADING */}
      {scanning && (
        <div
          style={{
            padding: 28,
            textAlign: 'center',
            color: '#F97316',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Analysing AI visibility...
        </div>
      )}

      {/* RESULTS TABLE */}
      {!scanning && baseTop10.length > 0 && (
        <div
          style={{
            borderLeft: '1px solid #E5E7EB',
            borderRight: '1px solid #E5E7EB',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          {/* TABLE HEADER */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: tableColumns,
              padding: '8px 10px',
              borderBottom:
                '1px solid #E5E7EB',
              fontSize: 10,
              fontWeight: 700,
              color: '#374151',
            }}
          >
            <span>Rank</span>
            <span>Brand / Product</span>
            {visibleEngines.map(engine => (
              <span key={engine}>{ENGINE_STYLE[engine]?.label || engine}</span>
            ))}
          </div>

          {/* TOP 10 */}
          {baseTop10
            .slice(0, 10)
            .map((item, index) => {
              const rank =
                Number(item.rank) ||
                index + 1

              return (
                <div
                  key={`${item.name}-${rank}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: tableColumns,
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderBottom:
                      '1px solid #F3F4F6',
                    fontSize: 11,
                  }}
                >
                  <span>{rank}</span>

                  <span
                    style={{
                      fontWeight: 600,
                      color: '#111827',
                    }}
                  >
                    {item.name}
                  </span>

                  {visibleEngines.map(engine => (
                    <span key={engine}>
                      {renderEngineRank(
                        engine,
                        item.name,
                        rank
                      )}
                    </span>
                  ))}
                </div>
              )
            })}

          {/* OWN BRAND */}
          {!siteAlreadyInRows && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: tableColumns,
                alignItems: 'center',
                padding: '9px 10px',
                background: '#FFF1F2',
                borderTop:
                  '1px solid #FECACA',
                fontSize: 11,
              }}
            >
              <span
                style={{
                  color: '#DC2626',
                  fontWeight: 800,
                }}
              >
                —
              </span>

              <span
                style={{
                  color: '#DC2626',
                  fontWeight: 800,
                }}
              >
                {siteName}
              </span>

              {visibleEngines.map(engine => (
                <span key={engine}>
                  {renderOwnBrandRank(engine)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EMPTY */}
      {!scanning &&
        selectedQuestion &&
        !baseTop10.length && (
          <div
            style={{
              padding: 28,
              textAlign: 'center',
              color: '#9CA3AF',
              fontSize: 12,
            }}
          >
            Waiting for AI visibility results...
          </div>
        )}

      {/* LEGEND */}
      {!scanning && baseTop10.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 22,
            flexWrap: 'wrap',
            marginTop: 12,
            fontSize: 10,
            color: '#374151',
          }}
        >
          <span>
            <b style={{ color: '#16A34A' }}>
              ✓
            </b>{' '}
            Same rank
          </span>

          <span>
            <b>3</b> Rank position
          </span>

          <span>
            <b style={{ color: '#DC2626' }}>
              ⊗
            </b>{' '}
            Not in Top 10
          </span>

          <span>
            <b>–</b> Not mentioned /
            unavailable
          </span>
        </div>
      )}
    </div>
  )
}

// ---------- Section 4: summary ----------
export function VisibilitySummaryCard({ siteId, siteName, productName }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSummary = useCallback(() => {
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/summary')
      .then(res => setSummary(res.data || null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => loadSummary(), [loadSummary])
  useScanRefresh(loadSummary)

  const score = Number(summary?.overallScore || 0)
  const label = summary?.label || (score >= 60 ? 'Strong' : score >= 30 ? 'Moderate' : 'Low')
  const color = label === 'Strong' ? '#16A34A' : label === 'Moderate' ? '#D97706' : '#DC2626'

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        <span style={numberBadge}>4</span>
        AI Visibility Summary{productName ? ` (${productName})` : ''}
      </div>
      <div style={subStyle}>Overall visibility across tested questions and AI engines.</div>

      {loading ? (
        <div style={emptyStyle}>Loading visibility summary...</div>
      ) : !summary ? (
        <div style={emptyStyle}>No visibility scan yet. Run Section 3 to generate your first summary.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score)) * 3.6}deg, #F3F4F6 0deg)`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <div style={{ width: 66, height: 66, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{score}%</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>Overall Visibility Score</div>
              <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 2 }}>{label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', marginTop: 10, fontSize: 10.5 }}>
                <span style={{ color: '#6B7280' }}>Top 10 Presence</span><strong>{summary.top10Presence ?? '-'}</strong>
                <span style={{ color: '#6B7280' }}>Average Rank</span><strong>{summary.averageRank ?? '-'}</strong>
                <span style={{ color: '#6B7280' }}>Questions Tested</span><strong>{summary.questionsTested ?? 0}</strong>
                <span style={{ color: '#6B7280' }}>Total Mentions</span><strong>{summary.totalMentions ?? 0}</strong>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: '9px 10px', borderRadius: 7, background: score >= 60 ? '#F0FDF4' : '#FEF2F2', color: score >= 60 ? '#166534' : '#B91C1C', fontSize: 10.5, display: 'flex', gap: 7, alignItems: 'center' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} />
            {score >= 60
              ? `${siteName || 'Your brand'} has solid AI visibility, with room to improve consistency.`
              : `${siteName || 'Your brand'} is not consistently recommended by AI engines.`}
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Section 5: why not Top 10 ----------
export function VisibilityReasoningCard({ siteId, siteName, productName }) {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  const loadReasons = useCallback(() => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName, productName })
      .then(res => setReasons(res.data.reasoning || []))
      .catch(() => setReasons([]))
      .finally(() => setLoading(false))
  }, [siteId, siteName, productName])

  useEffect(() => loadReasons(), [loadReasons])
  useScanRefresh(loadReasons)

  const displayName = [siteName, productName].filter(Boolean).join(' - ') || 'this project'

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        <span style={numberBadge}>5</span>
        Why is {displayName} not in the Top 10?
      </div>
      <div style={subStyle}>{loading ? 'Analysing latest scan...' : 'Based on your latest visibility scan.'}</div>

      {!loading && !reasons.length && (
        <div style={emptyStyle}>Run a visibility scan first. The reasons will be generated from the actual AI results.</div>
      )}

      {reasons.slice(0, 5).map((r, i) => {
        const p = priorityColors(r.severity)
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', gap: 8, padding: '8px 0', borderBottom: i < Math.min(reasons.length, 5) - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'start' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#FFF7ED', display: 'grid', placeItems: 'center' }}>
              <FontAwesomeIcon icon={faArrowRight} style={{ color: '#F97316', fontSize: 9 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{r.issue}</div>
              {r.detail && <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.45, marginTop: 2 }}>{r.detail}</div>}
            </div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 700 }}>{r.severity || 'Low'}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Section 6: recommendations ----------
export function VisibilityRecommendationsCard({ siteId, siteName, productName }) {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const loadRecommendations = useCallback(() => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)

    api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName, productName })
      .then(res => api.post('/sites/' + siteId + '/ai-visibility/recommendations', {
        siteName,
        productName,
        reasoning: res.data.reasoning || [],
      }))
      .then(res => setRecs(res.data.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false))
  }, [siteId, siteName, productName])

  useEffect(() => loadRecommendations(), [loadRecommendations])
  useScanRefresh(loadRecommendations)

  const visibleRecs = showAll ? recs : recs.slice(0, 3)

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        <span style={numberBadge}>6</span>
        Actionable Recommendations
        {!!recs.length && <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>(Top {Math.min(3, recs.length)})</span>}
      </div>
      <div style={subStyle}>{loading ? 'Generating recommendations...' : 'Prioritised AEO & GEO actions from the latest visibility scan.'}</div>

      {!loading && !recs.length && (
        <div style={emptyStyle}>Recommendations will appear after the first visibility scan.</div>
      )}

      {visibleRecs.map((r, i) => {
        const p = priorityColors(r.priority)
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: 9, padding: '9px 0', borderBottom: i < visibleRecs.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'start' }}>
            <div style={{ width: 22, height: 34, borderRadius: 5, background: p.bg, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: p.color }}>{i + 1}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{r.title}</span>
                <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 700 }}>{r.priority || 'Low'}</span>
              </div>
              <div style={{ fontSize: 10, color: '#6B7280', lineHeight: 1.45, marginTop: 2 }}>{r.detail}</div>

              {expanded === i && Array.isArray(r.plan) && (
                <ol style={{ fontSize: 10, color: '#6B7280', marginTop: 6, paddingLeft: 17 }}>
                  {r.plan.map((step, si) => <li key={si} style={{ marginBottom: 3 }}>{step}</li>)}
                </ol>
              )}
            </div>

            {Array.isArray(r.plan) && r.plan.length > 0 && (
              <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ border: '1px solid #FDBA74', background: '#fff', color: '#EA580C', borderRadius: 6, padding: '5px 7px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                {expanded === i ? 'Hide' : 'View Plan'}
              </button>
            )}
          </div>
        )
      })}

      {recs.length > 3 && (
        <button onClick={() => setShowAll(v => !v)} style={{ width: '100%', marginTop: 8, border: 0, borderTop: '1px solid #F3F4F6', paddingTop: 9, background: 'transparent', color: '#F97316', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {showAll ? 'Show Top 3' : `View all ${recs.length} recommendations`}
        </button>
      )}
    </div>
  )
}

// ---------- Section 7: history trend ----------
export function VisibilityHistoryCard({ siteId, productName }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const loadHistory = useCallback(() => {
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/history')
      .then(res => setHistory(res.data.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => loadHistory(), [loadHistory])
  useScanRefresh(loadHistory)

  const bucketOrder = { top3: 0, top10: 1, top20: 2, not_in_top20: 3 }
  const dates = [...new Set(history.map(h => h.snapshot_date))].sort()
  const engines = [...new Set(history.map(h => normaliseEngine(h.engine)))].filter(Boolean)
  const chartWidth = Math.max(300, dates.length * 64 + 55)

  return (
    <div style={cardStyle}>
      <div style={{ ...titleStyle, justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={numberBadge}>7</span>
          AI Visibility History{productName ? ` (${productName})` : ''}
        </span>
        <FontAwesomeIcon icon={faHistory} style={{ color: '#9CA3AF', fontSize: 12 }} />
      </div>

      {loading ? (
        <div style={emptyStyle}>Loading history...</div>
      ) : !history.length ? (
        <div style={emptyStyle}>No history yet - run visibility scans over time to build the trend.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <svg viewBox={`0 0 ${chartWidth} 150`} style={{ width: '100%', minWidth: 300, height: 135 }}>
              {['Top 3', 'Top 10', 'Top 20', 'Not Top 20'].map((label, i) => (
                <g key={label}>
                  <line x1="52" x2={chartWidth - 10} y1={16 + i * 34} y2={16 + i * 34} stroke="#F3F4F6" strokeWidth="1" />
                  <text x="4" y={20 + i * 34} fontSize="9" fill="#9CA3AF">{label}</text>
                </g>
              ))}

              {engines.map(engine => {
                const points = dates.map((d, i) => {
                  const point = history.find(h => h.snapshot_date === d && normaliseEngine(h.engine) === engine)
                  const y = point ? (bucketOrder[point.bucket] ?? 3) * 34 + 16 : 118
                  const x = 62 + i * 62
                  return `${x},${y}`
                }).join(' ')

                return (
                  <g key={engine}>
                    <polyline points={points} fill="none" stroke={ENGINE_STYLE[engine]?.color || '#9CA3AF'} strokeWidth="2.5" />
                    {dates.map((d, i) => {
                      const point = history.find(h => h.snapshot_date === d && normaliseEngine(h.engine) === engine)
                      const y = point ? (bucketOrder[point.bucket] ?? 3) * 34 + 16 : 118
                      return <circle key={d} cx={62 + i * 62} cy={y} r="2.7" fill={ENGINE_STYLE[engine]?.color || '#9CA3AF'} />
                    })}
                  </g>
                )
              })}

              {dates.map((d, i) => (
                <text key={d} x={62 + i * 62} y="145" textAnchor="middle" fontSize="8.5" fill="#9CA3AF">
                  {new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </text>
              ))}
            </svg>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {engines.map(e => (
              <span key={e} style={{ fontSize: 9.5, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ENGINE_STYLE[e]?.color || '#9CA3AF', display: 'inline-block' }} />
                {ENGINE_STYLE[e]?.label || e}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

