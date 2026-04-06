import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRobot, faEye, faLink, faListCheck,
  faMagnifyingGlass, faCircleCheck, faCircleXmark,
  faSave, faArrowRight, faSpinner, faExternalLink,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { Card, OrangeBtn, GhostBtn, PageHeader, Button, Badge, T } from '../components/UI'
import api from '../utils/api'

const TABS = [
  { id: 'chat',         label: 'SEO Chat',         icon: faRobot },
  { id: 'visibility',   label: 'AI Visibility',    icon: faEye },
  { id: 'opportunities',label: 'Link Finder',      icon: faLink },
  { id: 'plan',         label: 'Action Plan',      icon: faListCheck },
]

const QUICK = [
  'How do I rank #1 for my target keywords?',
  'Write a blog post outline for this site',
  'Best free backlink strategy for a new site',
  'Analyze my current SEO status',
  'What should I prioritize this week?',
]

// â”€â”€ Chat Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChatTab({ siteId }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)

  const send = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const next = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setLoading(true)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const r = await api.post(`/sites/${siteId}/ai/chat`, { messages: next })
      setMessages([...next, { role: 'assistant', content: r.data.reply }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Error connecting to AI. Please try again.' }])
    }
    setLoading(false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Card style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}><FontAwesomeIcon icon={faRobot} /></div>
              <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 4 }}>AI SEO advisor - knows this site's data</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ask anything about ranking this site on Google</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 28, height: 28, background: 'var(--orange-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)', fontSize: 12, flexShrink: 0, marginRight: 8, marginTop: 2 }}>
                  <FontAwesomeIcon icon={faRobot} />
                </div>
              )}
              <div style={{ maxWidth: '78%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? 'var(--orange)' : 'var(--dark3)', color: m.role === 'user' ? '#fff' : 'var(--text)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: 'var(--orange-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)', fontSize: 12 }}><FontAwesomeIcon icon={faRobot} /></div>
              <div style={{ background: 'var(--dark3)', padding: '10px 14px', borderRadius: '14px 14px 14px 4px' }}>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {QUICK.map(q => <GhostBtn key={q} onClick={() => send(q)} style={{ fontSize: 12, padding: '5px 12px' }}>{q}</GhostBtn>)}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Ask your SEO AI..." style={{ flex: 1, fontSize: 14 }} />
        <OrangeBtn onClick={() => send()} disabled={loading || !input.trim()}>Send</OrangeBtn>
        {messages.length > 0 && <GhostBtn onClick={() => setMessages([])}>Clear</GhostBtn>}
      </div>
    </div>
  )
}

// â”€â”€ AI Visibility Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function VisibilityTab({ siteId }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const SAMPLE_QUERIES = [
    'What is the best web design agency in Norway?',
    'Who are the top UX/UI designers in Stavanger?',
    'Recommend a React developer in Norway',
    'Best freelance web developers in Scandinavia',
  ]

  async function check(q) {
    const qarr = q || query.trim()
    if (!qarr) return
    setQuery(qarr)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await api.post(`/sites/${siteId}/ai/visibility`, { query: qarr })
      setResult(r.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to run visibility check')
    }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Check AI Visibility</div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
            Ask Claude a question someone might search for - e.g. "best web design agency in Norway" - and see if your brand gets mentioned in the AI answer.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && check()}
            placeholder="e.g. best web design agency in Norway"
            style={{ flex: 1 }}
          />
          <OrangeBtn onClick={() => check()} disabled={loading || !query.trim()}>
            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 6 }} />Check</>}
          </OrangeBtn>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SAMPLE_QUERIES.map(q => (
            <button key={q} onClick={() => check(q)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--dark3)', border: `1px solid var(--dark4)`, color: T.text2, cursor: 'pointer', fontFamily: 'inherit' }}>
              {q}
            </button>
          ))}
        </div>
      </Card>

      {error && <div style={{ background: T.redDim, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {result && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '14px', borderRadius: 10, background: result.mentioned ? T.greenDim : T.redDim, border: `1px solid ${result.mentioned ? T.green : T.red}40` }}>
            <FontAwesomeIcon icon={result.mentioned ? faCircleCheck : faCircleXmark} style={{ color: result.mentioned ? T.green : T.red, fontSize: 20, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: result.mentioned ? T.green : T.red }}>
                {result.mentioned ? `${result.brand} was mentioned!` : `${result.brand} was NOT mentioned`}
              </div>
              <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>
                {result.mentioned
                  ? 'Great - your brand appears in AI-generated answers for this query.'
                  : 'Your brand doesn\'t appear yet. Focus on building authority and content around this topic.'}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: result.mentioned ? T.green : T.red, fontFamily: 'DM Mono, monospace' }}>{result.score}</div>
              <div style={{ fontSize: 10, color: T.muted }}>Visibility Score</div>
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>AI Response</div>
          <div style={{ background: 'var(--dark3)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: T.text2, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
            {result.answer}
          </div>
        </Card>
      )}
    </div>
  )
}

// â”€â”€ Link Opportunities Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OpportunitiesTab({ siteId }) {
  const [loading, setLoading] = useState(false)
  const [opps, setOpps] = useState(null)
  const [error, setError] = useState(null)

  const typeColor = { Directory: T.blue, 'Guest post': T.purple, 'Resource page': T.green, 'Unlinked mention': T.amber, Partnership: T.orange }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.post(`/sites/${siteId}/ai/link-opportunities`)
      setOpps(r.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Generation failed')
    }
    setLoading(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>AI Link Opportunity Finder</div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
              Claude analyses your site, keywords, and competitors to suggest the highest-ROI link building targets.
            </div>
          </div>
          <OrangeBtn onClick={generate} disabled={loading}>
            {loading ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />Generating...</> : <><FontAwesomeIcon icon={faLink} style={{ marginRight: 6 }} />Find Opportunities</>}
          </OrangeBtn>
        </div>
      </Card>

      {error && <div style={{ background: T.redDim, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {opps && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opps.map((opp, i) => (
            <Card key={i} padding="1rem">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${(typeColor[opp.type] || T.orange)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FontAwesomeIcon icon={faLink} style={{ color: typeColor[opp.type] || T.orange, fontSize: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{opp.site}</span>
                    <Badge variant={opp.relevance === 'High' ? 'success' : 'info'}>{opp.relevance} relevance</Badge>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${(typeColor[opp.type] || T.orange)}20`, color: typeColor[opp.type] || T.orange, fontWeight: 600 }}>{opp.type}</span>
                    {opp.estimatedDR && <span style={{ fontSize: 11, color: T.muted }}>DR~{opp.estimatedDR}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.5 }}>{opp.strategy}</div>
                </div>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(opp.site)}`} target="_blank" rel="noopener noreferrer" style={{ color: T.muted, flexShrink: 0 }}>
                  <FontAwesomeIcon icon={faExternalLink} style={{ fontSize: 13 }} />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// â”€â”€ Action Plan Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ActionPlanTab({ siteId }) {
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState(null)
  const [selected, setSelected] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)

  const impactColor = { High: T.red, Medium: T.amber, Low: T.green }
  const catColors = { 'On-Page': T.orange, Technical: T.blue, Content: T.amber, Backlinks: T.purple, Speed: T.green }

  async function generate() {
    setLoading(true)
    setSaved(false)
    setForecast(null)
    setError(null)
    try {
      const r = await api.post(`/sites/${siteId}/ai/action-plan`)
      const nextTasks = Array.isArray(r.data) ? r.data : []
      setTasks(nextTasks)
      const defaults = {}
      nextTasks.forEach((_, i) => { defaults[i] = true })
      setSelected(defaults)
    } catch (e) {
      setError(e.response?.data?.error || 'Generation failed')
    }
    setLoading(false)
  }

  const selectedTasks = (tasks || []).filter((_, i) => !!selected[i])

  function toggleTask(i) {
    setSaved(false)
    setSelected(prev => ({ ...prev, [i]: !prev[i] }))
  }

  async function estimateRankForecast() {
    if (!tasks || tasks.length === 0) return
    setEstimating(true)
    setError(null)
    try {
      const r = await api.post(`/sites/${siteId}/seo/rank-forecast`, { selectedTasks })
      setForecast(r.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Forecast failed')
    }
    setEstimating(false)
  }

  async function saveToActions() {
    if (!tasks || tasks.length === 0) {
      setError('Generate tasks first')
      return
    }
    if (selectedTasks.length === 0) {
      setError('Select at least one approved task')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post(`/sites/${siteId}/ai/action-plan`, { save: true, selectedTasks })
      setSaved(true)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to submit approved tasks')
    }
    setSaving(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>AI Action Plan Generator</div>
            <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
              Claude reviews your audit, keywords, backlinks, and metrics - then builds a prioritized action plan ordered by SEO impact.
            </div>
          </div>
          <OrangeBtn onClick={generate} disabled={loading}>
            {loading ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />Generating...</> : <><FontAwesomeIcon icon={faListCheck} style={{ marginRight: 6 }} />Generate Plan</>}
          </OrangeBtn>
        </div>
      </Card>

      {error && <div style={{ background: T.redDim, color: T.red, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {tasks && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                  Rank #1 timeline forecast
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Based on current SEO data and your selected approved tasks.
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={estimateRankForecast} disabled={estimating}>
                {estimating ? 'Estimating...' : 'Estimate Days to #1'}
              </Button>
            </div>

            {forecast && (
              <div style={{ marginTop: 12, background: 'var(--dark3)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  Estimated: {forecast.estimatedDays} days
                </div>
                <div style={{ fontSize: 12, color: T.text2, marginBottom: 4 }}>
                  Range: {forecast.estimatedRange?.from} - {forecast.estimatedRange?.to} days
                  {' '}| Confidence: {forecast.confidence}%
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Current trajectory: ~{forecast.currentDays} days. Completing selected tasks can improve this.
                </div>
              </div>
            )}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {tasks.map((task, i) => (
              <div key={i} style={{ background: 'var(--dark2)', borderRadius: 10, border: `1px solid var(--dark3)`, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={!!selected[i]}
                  onChange={() => toggleTask(i)}
                  style={{ marginTop: 4, width: 16, height: 16, accentColor: 'var(--orange)' }}
                />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${catColors[task.category] || T.orange}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: catColors[task.category] || T.orange, marginTop: 1 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4, marginBottom: 4 }}>{task.text}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${catColors[task.category] || T.orange}20`, color: catColors[task.category] || T.orange, fontWeight: 600 }}>{task.category}</span>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${impactColor[task.impact] || T.text2}20`, color: impactColor[task.impact] || T.text2, fontWeight: 600 }}>{task.impact} impact</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" size="sm" onClick={saveToActions} disabled={saving || saved}>
              <FontAwesomeIcon icon={faSave} style={{ marginRight: 6 }} />
              {saved ? 'Approved Tasks Submitted' : saving ? 'Submitting...' : `Submit Approved (${selectedTasks.length})`}
            </Button>
            <Button variant="ghost" size="sm" onClick={generate}>Regenerate</Button>
          </div>
        </>
      )}
    </div>
  )
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AiAssistant() {
  const { siteId } = useParams()
  const [activeTab, setActiveTab] = useState('chat')

  return (
    <div className="fade-in page-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
      <PageHeader title="AI Assistant" subtitle="Claude-powered SEO tools - visibility check, link finder, action plans, and chat" />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '0 1.5rem 0', borderBottom: `1px solid var(--dark3)`, flexShrink: 0 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 16px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
            color: activeTab === tab.id ? T.orange : T.muted,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: `2px solid ${activeTab === tab.id ? T.orange : 'transparent'}`,
            marginBottom: -1, fontFamily: 'inherit', transition: 'color 0.15s',
          }}>
            <FontAwesomeIcon icon={tab.icon} style={{ fontSize: 13 }} />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '1rem 1.5rem 1rem', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'chat'         && <ChatTab siteId={siteId} />}
        {activeTab === 'visibility'   && <VisibilityTab siteId={siteId} />}
        {activeTab === 'opportunities'&& <OpportunitiesTab siteId={siteId} />}
        {activeTab === 'plan'         && <ActionPlanTab siteId={siteId} />}
      </div>
    </div>
  )
}
