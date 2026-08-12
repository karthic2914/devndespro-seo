import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faRotateRight, faArrowRight, faHistory, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'

// Matches the exact engine colors already used in AIVisibility.jsx's top score grid
const ENGINE_STYLE = {
  chatgpt: { label: 'ChatGPT', bg: '#000', color: '#fff' },
  claude: { label: 'Claude', bg: '#D85A30', color: '#fff' },
  gemini: { label: 'Gemini', bg: '#4285F4', color: '#fff' },
  perplexity: { label: 'Perplexity', bg: '#20808D', color: '#fff' },
}

// Matches the exact priority badge colors already used for recommendations/tips
function priorityColors(priority) {
  if (priority === 'High') return { bg: '#FEE2E2', color: '#DC2626' }
  if (priority === 'Medium') return { bg: '#FEF3C7', color: '#D97706' }
  return { bg: '#F3F4F6', color: '#6B7280' }
}

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }
const titleStyle = { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }
const subStyle = { fontSize: 12, color: '#6B7280', marginBottom: 14 }
const primaryBtn = (disabled) => ({
  padding: '10px 24px', borderRadius: 8, border: 'none',
  background: disabled ? '#D1D5DB' : '#F97316', color: '#fff', fontWeight: 700, fontSize: 14,
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: 8,
})

// ---------- Section 3: multi-engine comparison ----------
export function VisibilityResultsCard({ siteId, siteName, questions }) {
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState(null) // { question: { engine: { top10 } } }
  const [selectedQuestion, setSelectedQuestion] = useState(questions?.[0] || '')

  useEffect(() => {
    if (!selectedQuestion && questions?.length) setSelectedQuestion(questions[0])
  }, [questions]) // eslint-disable-line

  async function runScan() {
    if (!questions || !questions.length) return
    setScanning(true)
    try {
      const grouped = {}
      for (const q of questions) {
        const res = await api.post('/sites/' + siteId + '/ai-visibility/scan', {
          siteName, questions: [q],
        })
        const byEngine = {}
        for (const r of res.data.results || []) byEngine[r.engine] = r
        grouped[q] = byEngine
      }
      setScanResults(grouped)
    } catch (e) {
      console.error('Visibility scan failed', e)
    }
    setScanning(false)
  }

  const rowsForQuestion = (scanResults && scanResults[selectedQuestion]) || {}
  const engines = Object.keys(rowsForQuestion).length ? Object.keys(rowsForQuestion) : ['chatgpt', 'claude']

  const rowsByRank = Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1
    const row = { rank }
    engines.forEach(engine => {
      const top10 = rowsForQuestion[engine]?.top10 || []
      const hit = top10.find(r => r.rank === rank)
      row[engine] = hit?.name || null
    })
    return row
  })

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <div style={titleStyle}>AI Visibility Results</div>
          <div style={subStyle}>Ranked top-10 answers across engines, per question.</div>
        </div>
        <button onClick={runScan} disabled={scanning || !questions?.length} style={primaryBtn(scanning || !questions?.length)}>
          <FontAwesomeIcon icon={scanning ? faRotateRight : faWandMagicSparkles} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
          {scanning ? 'Scanning...' : 'Run Visibility Scan'}
        </button>
      </div>

      {!questions?.length && (
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Generate questions above first.</div>
      )}

      {!!questions?.length && (
        <select
          value={selectedQuestion}
          onChange={e => setSelectedQuestion(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', width: '100%', marginTop: 12, marginBottom: 14, color: '#111827' }}
        >
          {questions.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      )}

      {scanResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rowsByRank.map(row => (
            <div key={row.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', width: 18, flexShrink: 0, fontWeight: 600 }}>{row.rank}</span>
              {engines.map(e => (
                <span key={e} style={{ fontSize: 12, flex: 1, color: '#111827' }}>
                  {row[e]
                    ? <span><span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: ENGINE_STYLE[e]?.bg, color: ENGINE_STYLE[e]?.color, marginRight: 6 }}>{ENGINE_STYLE[e]?.label || e}</span>{row[e]}</span>
                    : <span style={{ color: '#D1D5DB' }}>-</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Section 4: summary score card ----------
export function VisibilitySummaryCard({ siteId }) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    api.get('/sites/' + siteId + '/ai-visibility/summary').then(res => setSummary(res.data)).catch(() => {})
  }, [siteId])

  if (!summary) return null

  const color = summary.label === 'Strong' ? '#16A34A' : summary.label === 'Moderate' ? '#D97706' : '#DC2626'
  const bg = summary.label === 'Strong' ? '#DCFCE7' : summary.label === 'Moderate' ? '#FEF3C7' : '#FEE2E2'

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>AI Visibility Summary</div>
      <div style={subStyle}>Overall score across all tested questions and engines.</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color }}>{summary.overallScore}<span style={{ fontSize: 16, fontWeight: 400 }}>%</span></div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: bg, color }}>{summary.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Top 10 Presence</div><div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{summary.top10Presence}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Average Rank</div><div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{summary.averageRank}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Questions Tested</div><div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{summary.questionsTested}</div></div>
        <div><div style={{ fontSize: 11, color: '#9CA3AF' }}>Total Mentions</div><div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{summary.totalMentions}</div></div>
      </div>
    </div>
  )
}

// ---------- Section 5: reasoning ("why not in Top 10") ----------
export function VisibilityReasoningCard({ siteId, siteName }) {
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName })
      .then(res => setReasons(res.data.reasoning || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [siteId, siteName])

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Why is {siteName} not in the Top 10?</div>
      <div style={subStyle}>{loading ? 'Analysing...' : 'Based on your latest visibility scan.'}</div>
      {reasons.map((r, i) => {
        const p = priorityColors(r.severity)
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < reasons.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <FontAwesomeIcon icon={faArrowRight} style={{ color: '#F97316', fontSize: 12 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.issue}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 600 }}>{r.severity}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{r.detail}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Section 6: recommendations ----------
export function VisibilityRecommendationsCard({ siteId, siteName }) {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.post('/sites/' + siteId + '/ai-visibility/reasoning', { siteName })
      .then(res => api.post('/sites/' + siteId + '/ai-visibility/recommendations', { siteName, reasoning: res.data.reasoning || [] }))
      .then(res => setRecs(res.data.recommendations || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [siteId, siteName])

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Actionable Recommendations</div>
      <div style={subStyle}>{loading ? 'Generating...' : 'Prioritised fixes to improve AI visibility.'}</div>
      {recs.map((r, i) => {
        const p = priorityColors(r.priority)
        return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < recs.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
            <div style={{ width: 24, height: 42, borderRadius: 5, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 11, fontWeight: 700, color: p.color }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.title}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: p.bg, color: p.color, fontWeight: 600 }}>{r.priority}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{r.detail}</div>
              {expanded === i && Array.isArray(r.plan) && (
                <ol style={{ fontSize: 12, color: '#6B7280', marginTop: 6, paddingLeft: 18 }}>
                  {r.plan.map((step, si) => <li key={si} style={{ marginBottom: 3 }}>{step}</li>)}
                </ol>
              )}
              {Array.isArray(r.plan) && r.plan.length > 0 && (
                <button onClick={() => setExpanded(expanded === i ? null : i)} style={{ marginTop: 4, fontSize: 11, color: '#F97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                  {expanded === i ? 'Hide plan' : 'View plan'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Section 7: history trend ----------
export function VisibilityHistoryCard({ siteId }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    api.get('/sites/' + siteId + '/ai-visibility/history').then(res => setHistory(res.data.history || [])).catch(() => {})
  }, [siteId])

  const bucketOrder = { top3: 0, top10: 1, top20: 2, not_in_top20: 3 }
  const dates = [...new Set(history.map(h => h.snapshot_date))].sort()
  const engines = [...new Set(history.map(h => h.engine))]

  return (
    <div style={cardStyle}>
      <div style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <FontAwesomeIcon icon={faHistory} style={{ color: '#6B7280' }} /> AI Visibility History
      </div>
      {!history.length && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>No history yet - run a scan weekly to build the trend.</div>}
      {!!history.length && (
        <svg viewBox={`0 0 ${dates.length * 80 + 40} 140`} style={{ width: '100%', height: 120, marginTop: 12 }}>
          {engines.map(engine => {
            const points = dates.map((d, i) => {
              const point = history.find(h => h.snapshot_date === d && h.engine === engine)
              const y = point ? bucketOrder[point.bucket] * 35 + 10 : 115
              return `${i * 80 + 20},${y}`
            }).join(' ')
            return <polyline key={engine} points={points} fill="none" stroke={ENGINE_STYLE[engine]?.bg || '#9CA3AF'} strokeWidth="2.5" />
          })}
        </svg>
      )}
      {!!engines.length && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          {engines.map(e => (
            <span key={e} style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: ENGINE_STYLE[e]?.bg || '#9CA3AF', display: 'inline-block' }} />
              {ENGINE_STYLE[e]?.label || e}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

