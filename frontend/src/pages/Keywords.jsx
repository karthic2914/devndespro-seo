import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus, faXmark, faArrowsRotate, faWandMagicSparkles,
  faMagnifyingGlass, faChartLine, faBolt, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, Badge, OrangeBtn, PageHeader, EmptyState, T } from '../components/UI'
import api from '../utils/api'
import toast from 'react-hot-toast'

const ENGINES = [
  { value: 'google', label: 'Google' },
  { value: 'bing', label: 'Bing' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
]

function DifficultyBar({ score }) {
  const color = score < 33 ? T.green : score < 66 ? T.amber : T.red
  const label = score < 33 ? 'Easy' : score < 66 ? 'Medium' : 'Hard'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: T.surface2, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 36 }}>{label}</span>
    </div>
  )
}

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
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiSource, setAiSource] = useState('')
  const [page1Data, setPage1Data] = useState(null)
  const [page1Map, setPage1Map] = useState({})
  const [scanReport, setScanReport] = useState(null)

  // DataForSEO search
  const [dfsQuery, setDfsQuery] = useState('')
  const [dfsLoading, setDfsLoading] = useState(false)
  const [dfsSuggestions, setDfsSuggestions] = useState([])
  const [addedKeywords, setAddedKeywords] = useState(new Set())

  const load = () => api.get(`/sites/${siteId}/keywords`).then(r => setKeywords(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

  const searchDataForSEO = async () => {
    if (!dfsQuery.trim()) return
    setDfsLoading(true)
    setDfsSuggestions([])
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/dataforseo-suggest`, { keyword: dfsQuery.trim() })
      setDfsSuggestions(data.suggestions || [])
      if (!data.suggestions?.length) toast.error('No suggestions found for this keyword')
    } catch (e) {
      toast.error(e.response?.data?.error || 'DataForSEO search failed')
    }
    setDfsLoading(false)
  }

  const addDfsSuggestion = async (s) => {
    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: s.keyword,
        volume: s.volume || 0,
        difficulty: s.difficulty || 'Medium',
        position: null,
      })
      setAddedKeywords(prev => new Set([...prev, s.keyword]))
      toast.success(`Added: ${s.keyword}`)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add keyword')
    }
  }

  const enrichKeywords = async () => {
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/enrich`)
      if (data.enriched > 0) {
        toast.success(`Enriched ${data.enriched} keywords with real volume data`)
        load()
      } else {
        toast(data.message || 'All keywords already have volume data')
      }
    } catch {
      toast.error('Enrichment failed')
    }
  }

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
    } catch { setScanReport(null) }
    setScanRunning(false)
  }

  const generateAiSuggestions = async () => {
    setAiLoading(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/keywords/ai-suggest`, { limit: 12 })
      setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      setAiSource(data.source || 'ai')
    } catch {
      setAiSuggestions([])
      toast.error('Could not generate keyword ideas')
    }
    setAiLoading(false)
  }

  const addAiSuggestion = async (s) => {
    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: s.keyword, volume: s.estimatedVolume || 0,
        difficulty: s.difficulty || 'Medium', position: null,
      })
      setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
      toast.success(`Added: ${s.keyword}`)
      load()
    } catch {}
  }

  useEffect(() => { setPage1Data(null); setPage1Map({}) }, [engine])

  const add = async () => {
    if (!form.keyword.trim()) return
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: form.keyword.trim(), volume: parseInt(form.volume) || 0,
        difficulty: form.difficulty, position: parseInt(form.position) || null,
      })
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
      {/* Fixed header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', margin: 0 }}>Keywords</h1>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Track your target keyword positions</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={enrichKeywords} style={{
            background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 600, color: T.text2,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FontAwesomeIcon icon={faChartLine} />Enrich Volume Data
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* DataForSEO Keyword Research Panel */}
        <Card padding="1.25rem">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: T.orange }} />
            <strong style={{ fontSize: 14, color: T.text }}>Keyword Research</strong>
            <span style={{ fontSize: 11, background: T.orangeDim, color: T.orange, padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>DataForSEO</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Type a seed keyword (e.g. web design norway)"
              value={dfsQuery}
              onChange={e => setDfsQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchDataForSEO()}
              style={{ flex: 1 }}
            />
            <OrangeBtn onClick={searchDataForSEO} disabled={dfsLoading || !dfsQuery.trim()}>
              {dfsLoading
                ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Searching…</>
                : <><FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 6 }} />Search</>
              }
            </OrangeBtn>
          </div>

          {dfsSuggestions.length > 0 && (
            <div style={{ marginTop: 12, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 140px 70px 70px 80px', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {['Keyword', 'Volume', 'Difficulty', 'CPC', 'Comp.', ''].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {dfsSuggestions.map((s, i) => {
                const isAdded = addedKeywords.has(s.keyword)
                return (
                  <div key={s.keyword + i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 140px 70px 70px 80px',
                    padding: '10px 12px', alignItems: 'center',
                    borderBottom: i < dfsSuggestions.length - 1 ? `1px solid #F3F4F6` : 'none',
                    background: isAdded ? '#F0FDF4' : '#fff',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{s.keyword}</div>
                    <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: T.text2, fontWeight: 700 }}>
                      {s.volume?.toLocaleString() || '—'}
                    </div>
                    <DifficultyBar score={s.difficultyScore || 0} />
                    <div style={{ fontSize: 12, color: T.text2 }}>${s.cpc?.toFixed(2) || '0.00'}</div>
                    <div style={{ fontSize: 12, color: T.text2 }}>{s.competition ? (s.competition * 100).toFixed(0) + '%' : '—'}</div>
                    <div>
                      {isAdded ? (
                        <span style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FontAwesomeIcon icon={faCircleCheck} />Added
                        </span>
                      ) : (
                        <button onClick={() => addDfsSuggestion(s)} style={{
                          background: T.orangeDim, color: T.orange, border: 'none',
                          borderRadius: 6, padding: '5px 10px', fontSize: 12,
                          fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <FontAwesomeIcon icon={faPlus} />Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Manual add + AI suggestions */}
        <Card padding="1.25rem">
          <SectionLabel>Add keyword manually</SectionLabel>
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
            <div style={{ marginTop: 12, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', background: T.surface2, fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${T.border}` }}>
                AI Keyword Ideas
                <span style={{ marginLeft: 8, fontWeight: 500, textTransform: 'none', color: T.muted }}>
                  ({aiSource === 'fallback' ? 'smart fallback' : 'Claude AI'})
                </span>
              </div>
              {aiSuggestions.slice(0, 8).map((s, idx) => (
                <div key={`${s.keyword}-${idx}`} style={{
                  padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: idx < Math.min(aiSuggestions.length, 8) - 1 ? `1px solid ${T.border}` : 'none', gap: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{s.keyword}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {s.intent || 'Informational'} • {s.difficulty || 'Medium'} • Vol ~{s.estimatedVolume || 0}
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

        {/* Tracked keywords table */}
        <Card padding="0">
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
              Tracked Keywords ({keywords.length})
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={engine} onChange={e => setEngine(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, color: T.text2, background: '#fff' }}>
                {ENGINES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <OrangeBtn onClick={refreshFirstPage} disabled={checking || !keywords.length}>
                {checking ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Checking…</> : <><FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} />Check Page 1</>}
              </OrangeBtn>
              <OrangeBtn onClick={runWeeklyScanReport} disabled={scanRunning || !keywords.length}>
                {scanRunning ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Scanning…</> : <>Weekly scan report</>}
              </OrangeBtn>
            </div>
          </div>

          {keywords.length > 0 && (
            <div style={{ padding: '10px 20px', background: T.surface2, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: T.text2 }}>
                {selectedEngine} first-page coverage:
                <strong style={{ marginLeft: 6, color: firstPageCount > 0 ? T.green : T.muted }}>
                  {firstPageCount}/{checkedCount || keywords.length}
                </strong>
              </span>
              <span style={{ fontSize: 11, color: T.muted }}>Each check uses SERP API requests.</span>
            </div>
          )}

          {scanReport?.report && (
            <div style={{ margin: '12px 20px', padding: '12px 14px', borderRadius: 10, background: '#F8FAFC', border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontSize: 12, color: T.text }}>Weekly Rank Scan Report</strong>
                <span style={{ fontSize: 11, color: T.muted }}>{new Date(scanReport.report.generatedAt).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: T.text2 }}>
                <span>Checked: <strong>{scanReport.report.checkedKeywords}</strong></span>
                <span>Alerts: <strong>{scanReport.report.alertsCreated}</strong></span>
                <span>Entered page 1: <strong style={{ color: T.green }}>{(scanReport.report.transitions || []).filter(t => t.action === 'entered').length}</strong></span>
                <span>Dropped: <strong style={{ color: T.red }}>{(scanReport.report.transitions || []).filter(t => t.action === 'dropped').length}</strong></span>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: T.muted }}>Loading...</div>
          ) : keywords.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: T.muted, fontSize: 13 }}>
              No keywords yet. Search for keywords above or add manually.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 96px 88px 40px', gap: 8, fontSize: 11, color: T.muted, padding: '8px 20px', borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Keyword</span>
                <span style={{ textAlign: 'right' }}>Vol/mo</span>
                <span style={{ textAlign: 'center' }}>Difficulty</span>
                <span style={{ textAlign: 'center' }}>Manual Pos</span>
                <span style={{ textAlign: 'center' }}>Page 1</span>
                <span style={{ textAlign: 'center' }}>{selectedEngine}</span>
                <span></span>
              </div>
              {keywords.map(k => (
                <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 96px 88px 40px', gap: 8, alignItems: 'center', padding: '10px 20px', borderBottom: `1px solid #F3F4F6` }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{k.keyword}</span>
                  <span style={{ fontSize: 13, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: T.text2 }}>{k.volume?.toLocaleString()}</span>
                  <div style={{ textAlign: 'center' }}><Badge status={k.difficulty} /></div>
                  <input type="number" placeholder="—" defaultValue={k.position || ''} onBlur={e => updatePos(k.id, e.target.value)} style={{ width: '100%', textAlign: 'center', padding: '5px 8px', fontSize: 13 }} min="1" max="100" />
                  <div style={{ textAlign: 'center' }}>
                    {page1Map[k.id]
                      ? page1Map[k.id].inFirstPage ? <Badge variant="success">Yes</Badge> : <Badge variant="danger">No</Badge>
                      : <Badge variant="default">-</Badge>
                    }
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: T.text2, fontWeight: 700 }}>
                    {page1Map[k.id]?.position || '-'}
                  </div>
                  <button onClick={() => remove(k.id)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 16, cursor: 'pointer' }}>
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}