  import { useState, useEffect } from 'react'
  import { useParams } from 'react-router-dom'
  import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
  import {
    faPlus, faXmark, faArrowsRotate, faWandMagicSparkles,
    faMagnifyingGlass, faChartLine, faBolt, faCircleCheck, faTrash,
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

  function getOpportunityTag(volume, difficultyRaw) {
    let diffScore
    if (typeof difficultyRaw === 'number') {
      diffScore = difficultyRaw
    } else {
      const d = String(difficultyRaw || '').toLowerCase()
      diffScore = d === 'easy' ? 20 : d === 'medium' ? 50 : d === 'hard' ? 80 : 50
    }
    const vol = volume || 0
    if (vol >= 500 && diffScore < 40) return { label: '🔥 Quick Win', color: '#16a34a', bg: '#dcfce7' }
    if (vol >= 1000 && diffScore < 66) return { label: '📈 High Value', color: '#0369a1', bg: '#e0f2fe' }
    if (vol < 200 && diffScore < 40) return { label: '🎯 Long Tail', color: '#7c3aed', bg: '#ede9fe' }
    if (vol >= 500 && diffScore >= 66) return { label: '💪 High Competition', color: '#b45309', bg: '#fef3c7' }
    if (vol < 100 && diffScore >= 50) return { label: '⚠️ Low Priority', color: '#6b7280', bg: '#f3f4f6' }
    return { label: '📊 Standard', color: '#374151', bg: '#f9fafb' }
  }

  function OpportunityTag({ volume, difficulty }) {
    const tag = getOpportunityTag(volume, difficulty)
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
        background: tag.bg, color: tag.color, whiteSpace: 'nowrap', letterSpacing: '0.02em',
      }}>
        {tag.label}
      </span>
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
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [deleting, setDeleting] = useState(false)

    const [dfsQuery, setDfsQuery] = useState('')
    const [dfsLoading, setDfsLoading] = useState(false)
    const [dfsSuggestions, setDfsSuggestions] = useState([])
    const [addedKeywords, setAddedKeywords] = useState(new Set())
    const [addingKeywords, setAddingKeywords] = useState(new Set())
    const [importingProjectKeywords, setImportingProjectKeywords] = useState(false)

    const load = () =>
      api.get(`/sites/${siteId}/keywords`).then(r => {
        const kws = r.data || []
        setKeywords(kws)
        setAddedKeywords(prev => {
          const next = new Set(prev)
          kws.forEach(k => next.add(k.keyword.toLowerCase().trim()))
          return next
        })
      }).finally(() => setLoading(false))

    useEffect(() => {
    load()
    // Load last search from DB
    api.get(`/sites/${siteId}/keywords/last-search`).then(r => {
      if (r.data.suggestions?.length) {
        setDfsSuggestions(r.data.suggestions)
        setDfsQuery(r.data.query || '')
      }
    }).catch(() => {})
  }, [siteId])

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
      const key = s.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) return
      setAddingKeywords(prev => new Set([...prev, key]))
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: s.keyword, volume: s.volume || 0,
          difficulty: s.difficulty || 'Medium', position: null,
        })
        setAddedKeywords(prev => new Set([...prev, key]))
        toast.success(`Added: ${s.keyword}`)
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          setAddedKeywords(prev => new Set([...prev, key]))
          toast('Already tracked', { icon: 'ℹ️' })
        } else {
          toast.error(msg || 'Failed to add keyword')
        }
      }
      setAddingKeywords(prev => { const n = new Set(prev); n.delete(key); return n })
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

    const importFromProject = async () => {
      setImportingProjectKeywords(true)
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/import-from-gsc`, { limit: 30 })
        if ((data?.imported || 0) > 0) {
          toast.success(`Imported ${data.imported} keywords from project GSC data`)
          load()
        } else {
          toast('No new keywords found in project GSC data', { icon: 'ℹ️' })
        }
      } catch (e) {
        toast.error(e.response?.data?.error || 'Project keyword import failed')
      }
      setImportingProjectKeywords(false)
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
      const key = s.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) return
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: s.keyword, volume: s.estimatedVolume || 0,
          difficulty: s.difficulty || 'Medium', position: null,
        })
        setAddedKeywords(prev => new Set([...prev, key]))
        setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
        toast.success(`Added: ${s.keyword}`)
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          setAddedKeywords(prev => new Set([...prev, key]))
          setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
          toast('Already tracked', { icon: 'ℹ️' })
        } else {
          toast.error('Failed to add keyword')
        }
      }
    }

    useEffect(() => { setPage1Data(null); setPage1Map({}) }, [engine])

    const add = async () => {
      if (!form.keyword.trim()) return
      const key = form.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) { toast('Already tracked', { icon: 'ℹ️' }); return }
      setAdding(true)
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: form.keyword.trim(), volume: parseInt(form.volume) || 0,
          difficulty: form.difficulty, position: parseInt(form.position) || null,
        })
        setForm({ keyword: '', volume: '', difficulty: 'Easy', position: '' })
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          toast('Already tracked', { icon: 'ℹ️' })
        } else {
          toast.error('Failed to add keyword')
        }
      }
      setAdding(false)
    }

    const updatePos = async (id, position) => {
      try { await api.put(`/sites/${siteId}/keywords/${id}`, { position: parseInt(position) || null }) } catch {}
    }

    const confirmDelete = (k) => setDeleteConfirm(k)

    const remove = async () => {
      if (!deleteConfirm) return
      setDeleting(true)
      try {
        await api.delete(`/sites/${siteId}/keywords/${deleteConfirm.id}`)
        setAddedKeywords(prev => {
          const next = new Set(prev)
          next.delete(deleteConfirm.keyword.toLowerCase().trim())
          return next
        })
        toast.success(`Removed: ${deleteConfirm.keyword}`)
        load()
      } catch {
        toast.error('Failed to remove keyword')
      }
      setDeleting(false)
      setDeleteConfirm(null)
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
            <button onClick={importFromProject} disabled={importingProjectKeywords} style={{
              background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, color: T.text2,
              cursor: importingProjectKeywords ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: importingProjectKeywords ? 0.75 : 1,
            }}>
              <FontAwesomeIcon icon={faBolt} />
              {importingProjectKeywords ? 'Importing...' : 'Import from Project'}
            </button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 140px 70px 70px 90px', padding: '8px 12px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                  {['Keyword', 'Opportunity', 'Volume', 'Difficulty', 'CPC', 'Comp.', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>
                {dfsSuggestions.map((s, i) => {
                  const key = s.keyword.toLowerCase().trim()
                  const isAdded = addedKeywords.has(key)
                  const isAdding = addingKeywords.has(key)
                  return (
                    <div key={s.keyword + i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 80px 140px 70px 70px 90px',
                      padding: '10px 12px', alignItems: 'center',
                      borderBottom: i < dfsSuggestions.length - 1 ? `1px solid #F3F4F6` : 'none',
                      background: isAdded ? '#F0FDF4' : '#fff',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{s.keyword}</div>
                      <div><OpportunityTag volume={s.volume} difficulty={s.difficultyScore || s.difficulty} /></div>
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
                          <button onClick={() => addDfsSuggestion(s)} disabled={isAdding} style={{
                            background: isAdding ? T.surface2 : T.orangeDim, color: isAdding ? T.muted : T.orange,
                            border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12,
                            fontWeight: 700, cursor: isAdding ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, opacity: isAdding ? 0.6 : 1,
                          }}>
                            {isAdding ? <><FontAwesomeIcon icon={faArrowsRotate} spin />Adding…</> : <><FontAwesomeIcon icon={faPlus} />Add</>}
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
                {aiSuggestions.slice(0, 8).map((s, idx) => {
                  const key = s.keyword.toLowerCase().trim()
                  const isAdded = addedKeywords.has(key)
                  return (
                    <div key={`${s.keyword}-${idx}`} style={{
                      padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: idx < Math.min(aiSuggestions.length, 8) - 1 ? `1px solid ${T.border}` : 'none', gap: 8,
                      background: isAdded ? '#F0FDF4' : '#fff',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {s.keyword}
                          <OpportunityTag volume={s.estimatedVolume} difficulty={s.difficulty} />
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>
                          {s.intent || 'Informational'} • {s.difficulty || 'Medium'} • Vol ~{s.estimatedVolume || 0}
                          {s.why ? ` • ${s.why}` : ''}
                        </div>
                      </div>
                      {isAdded ? (
                        <span style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <FontAwesomeIcon icon={faCircleCheck} />Added
                        </span>
                      ) : (
                        <OrangeBtn onClick={() => addAiSuggestion(s)}>
                          <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add
                        </OrangeBtn>
                      )}
                    </div>
                  )
                })}
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
                <div style={{ marginTop: 10 }}>
                  <OrangeBtn onClick={importFromProject} disabled={importingProjectKeywords}>
                    <FontAwesomeIcon icon={faBolt} style={{ marginRight: 6 }} />
                    {importingProjectKeywords ? 'Importing from project…' : 'Import from project data'}
                  </OrangeBtn>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 90px 90px 96px 88px 40px', gap: 8, fontSize: 11, color: T.muted, padding: '8px 20px', borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Keyword</span>
                  <span>Opportunity</span>
                  <span style={{ textAlign: 'right' }}>Vol/mo</span>
                  <span style={{ textAlign: 'center' }}>Difficulty</span>
                  <span style={{ textAlign: 'center' }}>Manual Pos</span>
                  <span style={{ textAlign: 'center' }}>Page 1</span>
                  <span style={{ textAlign: 'center' }}>{selectedEngine}</span>
                  <span></span>
                </div>
                {keywords.map(k => (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 90px 90px 96px 88px 40px', gap: 8, alignItems: 'center', padding: '10px 20px', borderBottom: `1px solid #F3F4F6` }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{k.keyword}</span>
                    <div><OpportunityTag volume={k.volume} difficulty={k.difficulty} /></div>
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
                    <button
                      onClick={() => confirmDelete(k)}
                      title="Remove keyword"
                      style={{ background: 'none', border: 'none', color: T.muted, fontSize: 14, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = T.muted}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </Card>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
          >
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 400, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <FontAwesomeIcon icon={faTrash} style={{ color: '#ef4444', fontSize: 18 }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8 }}>Remove Keyword?</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>This will permanently remove:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, wordBreak: 'break-all' }}>
                "{deleteConfirm.keyword}"
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 24 }}>
                All tracking history will be lost. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`, background: '#fff', fontSize: 13, fontWeight: 600, color: T.text2, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={remove}
                  disabled={deleting}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: deleting ? '#fca5a5' : '#ef4444', fontSize: 13, fontWeight: 700, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {deleting
                    ? <><FontAwesomeIcon icon={faArrowsRotate} spin />Removing…</>
                    : <><FontAwesomeIcon icon={faTrash} />Remove</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }