import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faArrowsRotate, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, Badge, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import api from '../utils/api'

const ENGINES = [
  { value: 'google', label: 'Google' },
  { value: 'bing', label: 'Bing' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
]

export default function Keywords() {
  const { siteId } = useParams()
  const [keywords, setKeywords] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ keyword: '', volume: '', difficulty: 'Easy', position: '' })
  const [adding, setAdding] = useState(false)
  const [engine, setEngine] = useState('google')
  const [checking, setChecking] = useState(false)
  const [scanRunning, setScanRunning] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [page1Data, setPage1Data] = useState(null)
  const [page1Map, setPage1Map] = useState({})
  const [scanReport, setScanReport] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState([])

  const load = () => api.get(`/sites/${siteId}/keywords`).then(r => setKeywords(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

  const refreshFirstPage = async () => {
    if (!keywords.length) return
    setChecking(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/first-page-status`, { engine, limit: 50 })
      setPage1Data(data)
      const map = {}
      ;(data.details || []).forEach(d => { map[d.id] = d })
      setPage1Map(map)
    } catch {}
    setChecking(false)
  }

  const runWeeklyScanReport = async () => {
    if (!keywords.length) return
    setScanRunning(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/scan-weekly-now`, { engines: [engine], limit: 50 })
      setScanReport(data)
    } catch {
      setScanReport(null)
    }
    setScanRunning(false)
  }

  const generateAiSuggestions = async () => {
    setAiLoading(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/ai-suggest`, { limit: 12 })
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch {
      setAiSuggestions([])
    }
    setAiLoading(false)
  }

  const addAiSuggestion = async (s) => {
    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: s.keyword,
        volume: s.estimatedVolume || 0,
        difficulty: s.difficulty || 'Medium',
        position: null,
      })
      setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
      load()
    } catch {}
  }

  useEffect(() => {
    setPage1Data(null)
    setPage1Map({})
  }, [engine])

  const add = async () => {
    if (!form.keyword.trim()) return
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/keywords`, { keyword: form.keyword.trim(), volume: parseInt(form.volume) || 0, difficulty: form.difficulty, position: parseInt(form.position) || null })
      setForm({ keyword: '', volume: '', difficulty: 'Easy', position: '' })
      load()
    } catch {}
    setAdding(false)
  }

  const updatePos = async (id, position) => {
    try { await api.put(`/sites/${siteId}/keywords/${id}`, { position: parseInt(position) || null }) } catch {}
  }

  const remove = async (id) => {
    try { await api.delete(`/sites/${siteId}/keywords/${id}`); load() } catch {}
  }

  const firstPageCount = page1Data?.inFirstPageCount || 0
  const checkedCount = page1Data?.checked || 0
  const selectedEngine = ENGINES.find(e => e.value === engine)?.label || 'Google'

  return (
    <div className="fade-in">
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', paddingTop: 4 }}>
        <PageHeader title="Keywords" subtitle="Track your target keyword positions" />
      </div>
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Add keyword</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input placeholder="Keyword" value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 2, minWidth: 200 }} />
          <input placeholder="Vol/mo" value={form.volume} onChange={e => setForm(p => ({ ...p, volume: e.target.value }))} style={{ width: 90 }} type="number" />
          <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} style={{ width: 110 }}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
          <input placeholder="Position" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} style={{ width: 90 }} type="number" min="1" max="100" />
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
          <OrangeBtn onClick={generateAiSuggestions} disabled={aiLoading}>
            {aiLoading
              ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Thinking…</>
              : <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />AI suggestions</>
            }
          </OrangeBtn>
        </div>

        {aiSuggestions.length > 0 && (
          <div style={{ marginTop: 12, border: '1px solid var(--dark4)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 10px', background: 'var(--dark3)', fontSize: 11, color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AI Keyword Ideas to Improve SEO
            </div>
            {aiSuggestions.slice(0, 8).map((s, idx) => (
              <div key={`${s.keyword}-${idx}`} style={{
                padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: idx === 0 ? 'none' : '1px solid var(--dark4)', gap: 8,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.keyword}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.intent || 'Informational'} • {s.difficulty || 'Medium'} • Vol {s.estimatedVolume || 0}
                    {s.why ? ` • ${s.why}` : ''}
                  </div>
                </div>
                <OrangeBtn onClick={() => addAiSuggestion(s)}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add
                </OrangeBtn>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <SectionLabel
          action={(
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={engine}
                onChange={e => setEngine(e.target.value)}
                style={{
                  border: '1px solid var(--dark4)', borderRadius: 8, padding: '6px 9px',
                  fontSize: 12, color: 'var(--text2)', background: '#fff', fontFamily: 'inherit',
                }}
              >
                {ENGINES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <OrangeBtn onClick={refreshFirstPage} disabled={checking || !keywords.length}>
                {checking
                  ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Checking…</>
                  : <><FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} />Check Page 1</>
                }
              </OrangeBtn>
              <OrangeBtn onClick={runWeeklyScanReport} disabled={scanRunning || !keywords.length}>
                {scanRunning
                  ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Scanning…</>
                  : <>Weekly scan report</>
                }
              </OrangeBtn>
            </div>
          )}
        >
          Tracked keywords ({keywords.length})
        </SectionLabel>

        {keywords.length > 0 && (
          <div style={{
            marginBottom: 10, padding: '10px 12px', borderRadius: 10,
            background: 'var(--dark3)', border: '1px solid var(--dark4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              {selectedEngine} first-page coverage:
              <strong style={{ marginLeft: 6, color: firstPageCount > 0 ? 'var(--green)' : 'var(--muted)' }}>
                {firstPageCount}/{checkedCount || keywords.length}
              </strong>
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Each check uses SERP API requests.
            </span>
          </div>
        )}

        {scanReport?.report && (
          <div style={{
            marginBottom: 12, padding: '12px 14px', borderRadius: 10,
            background: '#F8FAFC', border: '1px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <strong style={{ fontSize: 12, color: '#0F172A' }}>Weekly Rank Scan Report</strong>
              <span style={{ fontSize: 11, color: '#64748B' }}>{new Date(scanReport.report.generatedAt).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#334155' }}>
              <span>Checked: <strong>{scanReport.report.checkedKeywords}</strong></span>
              <span>Alerts: <strong>{scanReport.report.alertsCreated}</strong></span>
              <span>Entered page 1: <strong style={{ color: '#16A34A' }}>{(scanReport.report.transitions || []).filter(t => t.action === 'entered').length}</strong></span>
              <span>Dropped: <strong style={{ color: '#DC2626' }}>{(scanReport.report.transitions || []).filter(t => t.action === 'dropped').length}</strong></span>
            </div>
            {scanReport.emailedTo?.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#0F766E' }}>
                Report emailed to: {scanReport.emailedTo.join(', ')}
              </div>
            )}
            {scanReport.emailError && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#B45309' }}>
                Email notice: {scanReport.emailError}
              </div>
            )}
          </div>
        )}

        {loading ? <EmptyState message="Loading..." /> : keywords.length === 0 ? <EmptyState message="No keywords yet. Add your first keyword above." /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 96px 88px 40px', gap: 8, fontSize: 11, color: 'var(--muted)', padding: '0 0 8px', borderBottom: '1px solid var(--dark4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Keyword</span><span style={{ textAlign: 'right' }}>Vol/mo</span><span style={{ textAlign: 'center' }}>Difficulty</span><span style={{ textAlign: 'center' }}>Manual Pos</span><span style={{ textAlign: 'center' }}>Page 1</span><span style={{ textAlign: 'center' }}>{selectedEngine}</span><span></span>
            </div>
            {keywords.map(k => (
              <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 96px 88px 40px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--dark4)' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{k.keyword}</span>
                <span style={{ fontSize: 13, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{k.volume?.toLocaleString()}</span>
                <div style={{ textAlign: 'center' }}><Badge status={k.difficulty} /></div>
                <input type="number" placeholder="—" defaultValue={k.position || ''} onBlur={e => updatePos(k.id, e.target.value)} style={{ width: '100%', textAlign: 'center', padding: '5px 8px', fontSize: 13 }} min="1" max="100" />
                <div style={{ textAlign: 'center' }}>
                  {page1Map[k.id]
                    ? page1Map[k.id].inFirstPage
                      ? <Badge variant="success">Yes</Badge>
                      : <Badge variant="danger">No</Badge>
                    : <Badge variant="default">-</Badge>
                  }
                </div>
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>
                  {page1Map[k.id]?.position || '-'}
                </div>
                <button onClick={() => remove(k.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  )
}
