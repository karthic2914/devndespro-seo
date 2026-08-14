import { useState, useEffect, useCallback, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWandMagicSparkles,
  faRotateRight,
  faArrowRight,
  faHistory,
  faSquareCheck,
  faSquare,
  faListCheck,
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
  productName = '',
  sessionId = null,
}) {
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState({})
  const [selectedQuestion, setSelectedQuestion] = useState(
    questions?.[0] || ''
  )
  const [activeEngine, setActiveEngine] = useState('chatgpt')
  const [compareEngines, setCompareEngines] = useState(false)
  const [showFullAnswers, setShowFullAnswers] = useState(false)

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
          sessionId,
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

  // AUTO-SCAN disabled: scanning costs money. Only scan when the user
  // explicitly clicks Test / Re-test.
  // useEffect(() => {
  //   if (selectedQuestion && !scannedQuestionsRef.current.has(selectedQuestion)) {
  //     scanQuestion(selectedQuestion)
  //   }
  // }, [selectedQuestion])

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

      {/* VIEW FULL AI ANSWERS - real raw response text from the scan,
          not the extracted top-10 list */}
      {!scanning && baseTop10.length > 0 && (
        <>
          <button
            onClick={() => setShowFullAnswers(v => !v)}
            style={{ width: '100%', marginTop: 12, padding: '9px 0', border: '1px solid #E5E7EB', background: '#7C3AED', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {showFullAnswers ? 'Hide Full AI Answers' : 'View Full AI Answers'}
          </button>

          {showFullAnswers && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {liveEngines.map(engine => {
                const raw = currentResults?.[engine]?.raw_response
                if (!raw) return null
                return (
                  <div key={engine} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: ENGINE_STYLE[engine]?.color, marginBottom: 4 }}>
                      {ENGINE_STYLE[engine]?.label} said:
                    </div>
                    <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {raw}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Overview: KPI cards row ----------
const KPI_META = {
  overallScore: { label: 'Visibility Score', icon: faWandMagicSparkles, color: '#7C3AED', bg: '#F5F3FF' },
  mentionRate: { label: 'Mention Rate', icon: faArrowRight, color: '#16A34A', bg: '#F0FDF4' },
  averageRank: { label: 'Average Position (Top 10)', icon: faHistory, color: '#2563EB', bg: '#EFF6FF' },
  enginesInTop10: { label: 'Engines in Top 10', icon: faSquareCheck, color: '#D97706', bg: '#FFFBEB' },
}

export function VisibilityKPICards({
  siteId,
  onSummaryLoaded,
  totalQuestions = 0,
  testedQuestions = 0
}) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/summary')
      .then(res => {
        setSummary(res.data || null)
        if (onSummaryLoaded) onSummaryLoaded(res.data || null)
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [siteId]) // eslint-disable-line

  useEffect(() => load(), [load])
  useScanRefresh(load)

  const cards = summary ? [
    { key: 'overallScore', value: summary.overallScore + '%', delta: summary.deltas?.overallScore, unit: 'pt' },
    { key: 'mentionRate', value: summary.mentionRate + '%', delta: summary.deltas?.mentionRate, unit: 'pt' },
    { key: 'averageRank', value: summary.averageRank, delta: summary.deltas?.averageRank, unit: '' },
    { key: 'enginesInTop10', value: summary.enginesInTop10, delta: summary.deltas?.enginesInTop10, unit: '' },
  ] : []

  const safeQuestionsTested = Math.min(
    Math.max(Number(testedQuestions) || 0, 0),
    Math.max(Number(totalQuestions) || 0, 0)
  )

  const testedPct = totalQuestions > 0
    ? Math.min(
        100,
        Math.round(
          (safeQuestionsTested / totalQuestions) * 100
        )
      )
    : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginBottom: 0 }}>
      {(loading || !summary) ? (
        <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
          <div style={emptyStyle}>{loading ? 'Loading overview...' : 'No visibility scan yet. Run a scan below to populate this.'}</div>
        </div>
      ) : cards.map(c => {
        const meta = KPI_META[c.key]
        const hasDelta = c.delta !== null && c.delta !== undefined
        const positive = hasDelta && c.delta > 0
        const negative = hasDelta && c.delta < 0
        return (
          <div key={c.key} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FontAwesomeIcon icon={meta.icon} style={{ color: meta.color, fontSize: 11 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{meta.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>{c.value}</div>
              {hasDelta && c.delta !== 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: positive ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FontAwesomeIcon icon={faArrowRight} style={{ transform: positive ? 'rotate(-90deg)' : 'rotate(90deg)', fontSize: 9 }} />
                  {Math.abs(c.delta)}{c.unit}
                </span>
              )}
            </div>
            <div style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 2 }}>{summary.comparisonLabel}</div>
          </div>
        )
      })}
      {/* Questions Tested - real data (how many generated/custom questions
          have actually been scanned at least once), not a fake placeholder */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faListCheck} style={{ color: '#F97316', fontSize: 11 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Questions Tested</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>{safeQuestionsTested} / {totalQuestions}</div>
          {totalQuestions > 0 && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#16A34A' }}>{testedPct}%</span>
          )}
        </div>
        {totalQuestions > 0 && (
          <div style={{ background: '#F3F4F6', borderRadius: 3, height: 5, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: testedPct + '%', height: '100%', background: '#F97316', borderRadius: 3 }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Overview: per-engine breakdown table ----------
export function VisibilityEngineTable({ siteId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/sites/' + siteId + '/ai-visibility/engine-breakdown')
      .then(res => setRows(res.data.breakdown || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [siteId])

  useEffect(() => load(), [load])
  useScanRefresh(load)

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>AI Visibility by Engine</div>
      <div style={subStyle}>{loading ? 'Loading...' : 'Per-engine mention rate and position from your last 30 days of scans.'}</div>

      {!loading && rows.every(r => !r.hasData) && (
        <div style={emptyStyle}>No scans yet for any engine. Run a visibility scan to populate this table.</div>
      )}

      {rows.some(r => r.hasData) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,1.2fr) minmax(70px,1fr) minmax(80px,1fr) minmax(70px,1fr) minmax(60px,1fr)', gap: 8, fontSize: 10, fontWeight: 700, color: '#374151', paddingBottom: 8, borderBottom: '1px solid #E5E7EB' }}>
          <span>AI Engine</span>
          <span>Mention Rate</span>
          <span>Top 10 Presence</span>
          <span>Avg Position</span>
          <span>Trend</span>
        </div>
      )}

      {rows.filter(r => r.hasData).map(r => {
        const meta = ENGINE_STYLE[r.engine] || { label: r.engine, color: '#9CA3AF' }
        const max = Math.max(1, ...r.trend)
        const points = r.trend.map((v, i) => `${(i / Math.max(1, r.trend.length - 1)) * 60},${18 - (v / max) * 16}`).join(' ')
        return (
          <div key={r.engine} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,1.2fr) minmax(70px,1fr) minmax(80px,1fr) minmax(70px,1fr) minmax(60px,1fr)', gap: 8, alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #F3F4F6', fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: meta.color }}>{meta.label}</span>
            <span style={{ color: '#111827' }}>{r.mentionRate}%</span>
            <span style={{ color: r.inTop10 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>{r.inTop10 ? 'Top 10 #' + r.bestRank : 'Not in Top 10'}</span>
            <span style={{ color: '#111827' }}>{r.averagePosition ?? '-'}</span>
            <svg viewBox="0 0 60 20" style={{ width: 60, height: 20 }}>
              {r.trend.length > 1 && <polyline points={points} fill="none" stroke={meta.color} strokeWidth="1.8" />}
            </svg>
          </div>
        )
      })}

      {rows.some(r => r.hasData) && (
        <button
          onClick={() => scrollToId('step-analyze')}
          style={{ width: '100%', marginTop: 10, padding: '8px 0', border: '1px solid #E5E7EB', background: '#fff', color: '#374151', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          View Engine Comparison
        </button>
      )}
    </div>
  )
}

function scrollToId(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ---------- Overview: honest placeholder panels for not-yet-built features ----------
// Each has a "View..." button, but since the feature genuinely isn't built,
// clicking shows a brief "Coming soon" note instead of pretending to work.
function ComingSoonButton({ label }) {
  const [clicked, setClicked] = useState(false)
  return (
    <button
      onClick={() => { setClicked(true); setTimeout(() => setClicked(false), 2000) }}
      style={{ width: '100%', marginTop: 10, padding: '8px 0', border: '1px solid #E5E7EB', background: '#fff', color: clicked ? '#9CA3AF' : '#374151', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
    >
      {clicked ? 'Coming soon' : label}
    </button>
  )
}

export function VisibilityCompetitorsPanel() {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Top Competitors</div>
      <div style={emptyStyle}>Competitor tracking isn't built yet. This will let you track named competitors and compare visibility share directly against them.</div>
      <ComingSoonButton label="View Competitor Benchmarking" />
    </div>
  )
}

export function VisibilityAlertsPanel() {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Alerts</div>
      <div style={emptyStyle}>Alerts aren't built yet. This will notify you when your visibility score changes significantly between scans.</div>
      <ComingSoonButton label="View All Alerts" />
    </div>
  )
}

export function VisibilitySentimentPanel() {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Sentiment</div>
      <div style={emptyStyle}>Sentiment analysis isn't built yet. This will show whether AI engines describe your brand positively, neutrally, or negatively.</div>
      <ComingSoonButton label="View Sentiment Analysis" />
    </div>
  )
}

// ---------- Overview: Quick Actions panel ----------
// Wires real handlers passed down from the page - nothing here is decorative,
// each button does exactly what its label says.
export function VisibilityQuickActions({ onRunScan, onAddQuestion, onGenerateQuestions, onCompareAnswers, onExport }) {
  const btnStyle = (primary) => ({
    width: '100%',
    textAlign: 'left',
    padding: '9px 12px',
    borderRadius: 7,
    border: primary ? 'none' : '1px solid #E5E7EB',
    background: primary ? '#7C3AED' : '#fff',
    color: primary ? '#fff' : '#374151',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
  })
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Quick Actions</div>
      <div style={{ marginTop: 10 }}>
        <button onClick={onRunScan} style={btnStyle(true)}>Run Visibility Scan</button>
        <button onClick={onAddQuestion} style={btnStyle(false)}>Add Custom Question</button>
        <button onClick={onGenerateQuestions} style={btnStyle(false)}>Generate Questions</button>
        <button onClick={onCompareAnswers} style={btnStyle(false)}>Compare AI Answers</button>
        <button onClick={onExport} style={{ ...btnStyle(false), marginBottom: 0 }}>Export Report</button>
      </div>
    </div>
  )
}

// ---------- Section 5: why not Top 10 ----------
export function VisibilityReasoningCard({ siteId, siteName, productName }) {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  const loadReasons = useCallback((opts = {}) => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)
    // Prefer cached insights (free). Only force regenerate after a new scan.
    const force = !!opts.force
    const req = force
      ? api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName, productName, force: true })
      : api.get('/sites/' + siteId + '/ai-visibility/insights').then(async (res) => {
          const cached = res.data?.reasoning || []
          if (cached.length) return { data: { reasoning: cached } }
          // First time only: generate once and persist.
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
  // Do not auto-regenerate after scans — that costs money. Cached analysis stays until forced.
  useScanRefresh(() => loadReasons({ force: false }))

  const displayName = [siteName, productName].filter(Boolean).join(' - ') || 'this project'

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
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

  const loadRecommendations = useCallback((opts = {}) => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)
    const force = !!opts.force

    const start = force
      ? api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName, productName, force: true })
          .then(res => api.post('/sites/' + siteId + '/ai-visibility/recommendations', {
            siteName,
            productName,
            reasoning: res.data.reasoning || [],
            force: true,
          }))
      : api.get('/sites/' + siteId + '/ai-visibility/insights').then(async (res) => {
          const cached = res.data?.recommendations || []
          if (cached.length) return { data: { recommendations: cached } }
          const reasoningRes = await api.post('/sites/' + siteId + '/ai-visibility/reasoning', {
            siteName,
            productName,
            force: true,
          })
          return api.post('/sites/' + siteId + '/ai-visibility/recommendations', {
            siteName,
            productName,
            reasoning: reasoningRes.data.reasoning || [],
            force: true,
          })
        })

    start
      .then(res => setRecs(res.data.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false))
  }, [siteId, siteName, productName])

  useEffect(() => loadRecommendations({ force: false }), [loadRecommendations])
  useScanRefresh(() => loadRecommendations({ force: false }))

  // Marks a recommendation done/not-done. Updates the UI immediately, saves
  // to the database in the background, and rolls back if the save fails so
  // the checkbox never lies about what's actually persisted.
  async function toggleDone(index) {
    const updated = recs.map((r, i) => i === index ? { ...r, completed: !r.completed } : r)
    setRecs(updated)
    try {
      await api.patch('/sites/' + siteId + '/ai-visibility/recommendations', { recommendations: updated })
    } catch (e) {
      setRecs(recs)
    }
  }

  const visibleRecs = showAll ? recs : recs.slice(0, 3)

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>
        Actionable Recommendations
        {!!recs.length && <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>(Top {Math.min(3, recs.length)})</span>}
      </div>
      <div style={subStyle}>{loading ? 'Generating recommendations...' : 'Prioritised AEO & GEO actions from the latest visibility scan.'}</div>

      {!loading && !recs.length && (
        <div style={emptyStyle}>Recommendations will appear after the first visibility scan.</div>
      )}

      {visibleRecs.map((r, i) => {
        const p = priorityColors(r.priority)
        const isDone = !!r.completed
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: 9, padding: '9px 0', borderBottom: i < visibleRecs.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'start', opacity: isDone ? 0.6 : 1 }}>
            <button
              onClick={() => toggleDone(i)}
              title={isDone ? 'Mark as not done' : 'Mark as done'}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0, marginTop: 2, color: isDone ? '#16A34A' : '#D1D5DB' }}
            >
              <FontAwesomeIcon icon={isDone ? faSquareCheck : faSquare} style={{ fontSize: 16 }} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isDone ? '#16A34A' : '#111827', textDecoration: isDone ? 'line-through' : 'none' }}>{r.title}</span>
                {isDone
                  ? <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontWeight: 700 }}>Done</span>
                  : <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 700 }}>{r.priority || 'Low'}</span>
                }
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
        <span>
          Visibility Trend{productName ? ` (${productName})` : ''}
        </span>
        <FontAwesomeIcon icon={faHistory} style={{ color: '#9CA3AF', fontSize: 12 }} />
      </div>

      {loading ? (
        <div style={emptyStyle}>Loading trend...</div>
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

