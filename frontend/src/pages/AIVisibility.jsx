import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faCircleXmark, faLightbulb, faArrowRight, faRotateRight, faHistory, faShareNodes, faDownload, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'

function genQueries(domain, brand, keywords) {
  const kw1 = keywords[0] || (brand + ' software')
  const kw2 = keywords[1] || (brand + ' tool')
  return [brand + ' review', 'best ' + kw1, brand + ' vs alternatives']
}

const SCORE_LABEL = s => s >= 80 ? 'Excellent' : s >= 50 ? 'Average' : s > 0 ? 'Below average' : 'Poor'
const SCORE_COLOR = s => s >= 80 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'
const SCORE_BG = s => s >= 80 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2'

const ENGINES = [
  { key: 'Claude', label: 'Claude (Anthropic)', desc: 'Fast, accurate, reads your site content', color: '#D85A30' },
  { key: 'ChatGPT', label: 'ChatGPT (OpenAI)', desc: 'GPT-4o mini, ~$0.02 per analysis', color: '#10A37F' },
  { key: 'Both', label: 'Both engines', desc: 'Compare recommendations side by side', color: '#6366F1' },
]

export default function AIVisibility() {
  const { siteId } = useParams()
  const showSnackbar = useSnackbar()
  const reportRef = useRef(null)
  const menuRef = useRef(null)
  const [site, setSite] = useState(null)
  const [queries, setQueries] = useState(['', '', ''])
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [claudeLoading, setClaudeLoading] = useState(false)
  const [claudeResults, setClaudeResults] = useState(null)
  const [improvements, setImprovements] = useState([])
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [aiRecommendations, setAiRecommendations] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [domain, setDomain] = useState('')
  const [showEngineMenu, setShowEngineMenu] = useState(false)
  const [selectedEngine, setSelectedEngine] = useState('Claude')
  const [aiCronEnabled, setAiCronEnabled] = useState(false)
  const [scoreHistory, setScoreHistory] = useState([])
  const toggleCron = async (val) => {
    setAiCronEnabled(val)
    await api.patch('/sites/' + siteId + '/ai-cron', { enabled: val }).catch(() => {})
  }

  useEffect(() => {
    const handleClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowEngineMenu(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    api.get('/sites').then(res => {
      const s = (res.data || []).find(x => String(x.id) === String(siteId))
      if (s) {
        setSite(s)
        const d = (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()
        setDomain(d)
        const brand = d.split('.')[0]
        if (s.claude_cited != null) setClaudeResults({ score: s.claude_cited })
        setAiCronEnabled(!!s.enable_ai_cron)
        api.get('/sites/' + siteId + '/keywords').then(kr => {
          const kws = (kr.data || []).slice(0, 3).map(k => k.keyword || k.query || '').filter(Boolean)
          setQueries(genQueries(d, brand, kws))
        }).catch(() => setQueries(genQueries(d, brand, [])))
      }
    }).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/improvements').then(res => setImprovements(res.data.tips || [])).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/score-history').then(res => setScoreHistory(res.data.history || [])).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/history').then(res => {
      const h = res.data || []
      setHistory(h)
      if (h.length > 0) setResults(h[0].results || [])
    }).catch(() => {})
  }, [siteId])

  async function runTest() {
    const q = queries.filter(q => q.trim())
    if (!q.length) { showSnackbar('Enter at least one query', 'error'); return }
    setLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/test', { queries: q })
      setResults(res.data.results.map(r => ({ ...r, engine: 'ChatGPT' })))
      setHistory(h => [{ results: res.data.results, created_at: new Date().toISOString() }, ...h].slice(0, 10))
      showSnackbar('Test completed!', 'success')
    } catch (e) { showSnackbar('Test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error') }
    setLoading(false)
  }

  async function runClaudeTest() {
    const q = queries.filter(q => q.trim())
    if (!q.length) { showSnackbar('Enter at least one query', 'error'); return }
    setClaudeLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/test-claude', { queries: q })
      setClaudeResults({ score: res.data.score, results: res.data.results.map(r => ({ ...r, engine: 'Claude' })) })
      showSnackbar('Claude test completed!', 'success')
    } catch (e) { showSnackbar('Claude test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error') }
    setClaudeLoading(false)
  }

  async function analyseWithEngine(engine) {
    setSelectedEngine(engine)
    setShowEngineMenu(false)
    setAnalyseLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/analyse', { engine })
      setAiRecommendations({ ...res.data, engine })
      showSnackbar(engine + ' analysis complete!', 'success')
    } catch (e) { showSnackbar('Analysis failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error') }
    setAnalyseLoading(false)
  }

  async function shareReport() {
    setSharing(true)
    try {
      const res = await api.get('/sites/' + siteId + '/ai-visibility/share')
      const url = window.location.origin + '/public/ai-visibility/' + res.data.token
      await navigator.clipboard.writeText(url).catch(() => {})
      showSnackbar('Share link copied to clipboard!', 'success')
    } catch { showSnackbar('Failed to generate share link', 'error') }
    setSharing(false)
  }

  async function downloadImage() {
    setSharing(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' })
      const link = document.createElement('a')
      link.download = 'ai-visibility-' + (domain || 'report') + '.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      showSnackbar('Image downloaded!', 'success')
    } catch { showSnackbar('Download failed', 'error') }
    setSharing(false)
  }

  const cited = (results || []).filter(r => r.cited).length
  const total = (results || []).length
  const score = total > 0 ? Math.round((cited / total) * 100) : null

  const engines = [
    { key: 'chatgpt', label: 'ChatGPT', bg: '#000', color: '#fff', initial: 'G', score, active: true },
    { key: 'claude', label: 'Claude', bg: '#D85A30', color: '#fff', initial: 'C', score: claudeResults?.score ?? null, pending: claudeResults === null },
    { key: 'perplexity', label: 'Perplexity', bg: '#20808D', color: '#fff', initial: 'P', soon: true },
    { key: 'gemini', label: 'Gemini', bg: '#4285F4', color: '#fff', initial: 'G', soon: true },
  ]

  const tipsToShow = improvements.length > 0 ? improvements : [
    { title: 'Submit sitemap to Bing Webmaster Tools', message: 'ChatGPT uses Bing. Not indexed on Bing = invisible to ChatGPT. Takes 10 mins at webmaster.bing.com.', priority: 'High' },
    { title: 'Get listed on Trustpilot or G2', message: 'AI engines use review platforms as trust signals. A free Trustpilot listing is enough to start.', priority: 'High' },
    { title: 'Add author schema to content pages', message: 'Named authors with credentials make content more citable by AI engines.', priority: 'Medium' },
    { title: 'Build Reddit presence', message: 'Perplexity heavily cites Reddit. Comment in relevant subreddits before posting.', priority: 'Medium' },
  ]

  const selectedEngineObj = ENGINES.find(e => e.key === selectedEngine) || ENGINES[0]

  return (
    <div ref={reportRef} style={{ padding: '1.5rem 2rem', maxWidth: 860 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#F97316' }} />
            AI Visibility
            {site && <span style={{ fontSize: 13, fontWeight: 400, color: '#6B7280', marginLeft: 4 }}>- {domain}</span>}
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Find out if AI engines cite <strong>{domain || 'this site'}</strong> when people ask relevant questions.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={downloadImage} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#374151', fontFamily: 'inherit' }}>
            <FontAwesomeIcon icon={faDownload} style={{ fontSize: 11 }} /> Download
          </button>
          <button onClick={shareReport} disabled={sharing} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#F97316', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#fff', fontFamily: 'inherit' }}>
            <FontAwesomeIcon icon={faShareNodes} style={{ fontSize: 11 }} /> {sharing ? 'Generating...' : 'Share'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
        {engines.map(e => (
          <div key={e.key} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, opacity: e.soon ? 0.45 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: e.bg, color: e.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{e.initial}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.label}</span>
            </div>
            {e.soon ? <div style={{ fontSize: 12, color: '#9CA3AF' }}>Coming soon</div>
            : e.pending ? <div style={{ fontSize: 12, color: '#9CA3AF' }}>Not tested yet</div>
            : e.score != null ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: SCORE_COLOR(e.score) }}>{e.score}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span></div>
                <div style={{ background: '#F3F4F6', borderRadius: 3, height: 4, overflow: 'hidden', margin: '8px 0 6px' }}>
                  <div style={{ width: e.score + '%', height: '100%', background: SCORE_COLOR(e.score), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: SCORE_BG(e.score), color: SCORE_COLOR(e.score) }}>{SCORE_LABEL(e.score)}</span>
              </>
            ) : <div style={{ fontSize: 12, color: '#9CA3AF' }}>Not tested yet</div>}
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Test queries for {domain}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Auto-generated based on <strong>{domain}</strong> keywords. Edit if needed.</div>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px', marginBottom: 14, display: 'flex', gap: 8 }}>
          <FontAwesomeIcon icon={faLightbulb} style={{ color: '#D97706', marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>Include your brand name or city. Generic queries like "web design" will never return your specific site.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {queries.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', width: 22, flexShrink: 0, fontWeight: 600 }}>#{i+1}</span>
              <input value={q} onChange={e => setQueries(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 7, border: '1px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111827' }}
                onFocus={e => e.target.style.borderColor = '#F97316'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
            </div>
          ))}
        </div>
        {!sharing && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={runTest} disabled={loading || claudeLoading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: loading ? '#D1D5DB' : '#F97316', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={loading ? faRotateRight : faWandMagicSparkles} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Asking ChatGPT...' : 'Test with ChatGPT'}
          </button>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>~$0.01 per run</span>
          <button onClick={runClaudeTest} disabled={claudeLoading || loading || analyseLoading} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D85A30', background: '#fff', color: '#D85A30', fontWeight: 700, fontSize: 14, cursor: claudeLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={claudeLoading ? faRotateRight : faWandMagicSparkles} style={{ animation: claudeLoading ? 'spin 1s linear infinite' : 'none', fontSize: 13 }} />
            {claudeLoading ? 'Asking Claude...' : 'Test with Claude'}
          </button>
        </div>}
      </div>

      {results && results.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Results - {cited}/{total} queries cited ({domain})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{ border: '1px solid ' + (r.cited ? '#BBF7D0' : '#FECACA'), borderRadius: 10, padding: 14, borderLeft: '4px solid ' + (r.cited ? '#16A34A' : '#DC2626') }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.excerpt ? 10 : 0 }}>
                  <FontAwesomeIcon icon={r.cited ? faCircleCheck : faCircleXmark} style={{ color: r.cited ? '#16A34A' : '#DC2626', fontSize: 16 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>{r.query}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: r.cited ? '#DCFCE7' : '#FEE2E2', color: r.cited ? '#16A34A' : '#DC2626' }}>{r.cited ? 'CITED' : 'NOT CITED'}</span>
                </div>
                {r.excerpt && (
                  <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', lineHeight: 1.7 }}>
                    <span style={{ fontWeight: 600, color: '#9CA3AF', fontSize: 11, display: 'block', marginBottom: 3 }}>{r.engine || 'AI'} said:</span>
                    {r.excerpt}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Site Analysis with VS Code-style engine picker */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#D85A30' }} />
          AI-powered site analysis
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Choose an AI engine to analyse your site content and get specific recommendations.</div>

        {!aiRecommendations ? (
          <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'visible', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <button
                onClick={() => analyseWithEngine(selectedEngine)}
                disabled={analyseLoading}
                style={{ padding: '10px 18px', border: 'none', background: analyseLoading ? '#D1D5DB' : selectedEngineObj.color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: analyseLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, borderRadius: '8px 0 0 8px', whiteSpace: 'nowrap' }}>
                <FontAwesomeIcon icon={analyseLoading ? faRotateRight : faWandMagicSparkles} style={{ animation: analyseLoading ? 'spin 1s linear infinite' : 'none' }} />
                {analyseLoading ? 'Analysing with ' + selectedEngine + '...' : 'Analyse with ' + selectedEngine}
              </button>
              <button
                onClick={() => setShowEngineMenu(m => !m)}
                disabled={analyseLoading}
                style={{ padding: '10px 12px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', background: analyseLoading ? '#D1D5DB' : selectedEngineObj.color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center' }}>
                <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 11, transition: 'transform 0.15s', transform: showEngineMenu ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
            </div>

            {showEngineMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 260, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F3F4F6' }}>Select AI engine</div>
                {ENGINES.map((eng, i) => (
                  <div
                    key={eng.key}
                    onClick={() => { setSelectedEngine(eng.key); setShowEngineMenu(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: i < ENGINES.length - 1 ? '1px solid #F9FAFB' : 'none', background: selectedEngine === eng.key ? '#F9FAFB' : '#fff', display: 'flex', alignItems: 'center', gap: 12 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                    onMouseLeave={e => e.currentTarget.style.background = selectedEngine === eng.key ? '#F9FAFB' : '#fff'}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: eng.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: selectedEngine === eng.key ? 700 : 500, color: '#111827' }}>{eng.label}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{eng.desc}</div>
                    </div>
                    {selectedEngine === eng.key && <span style={{ fontSize: 11, color: eng.color, fontWeight: 700 }}>selected</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ENGINES.find(e => e.key === aiRecommendations.engine)?.color || '#D85A30' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>Analysis by <strong>{aiRecommendations.engine}</strong> for <strong>{aiRecommendations.url}</strong></span>
            </div>
            {(aiRecommendations.recommendations || []).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 4 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: 5, background: r.priority === 'High' ? '#FEE2E2' : r.priority === 'Medium' ? '#FEF3C7' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 11, fontWeight: 700, color: r.priority === 'High' ? '#DC2626' : r.priority === 'Medium' ? '#D97706' : '#6B7280' }}>{i+1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.title}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: r.priority === 'High' ? '#FEE2E2' : r.priority === 'Medium' ? '#FEF3C7' : '#F3F4F6', color: r.priority === 'High' ? '#DC2626' : r.priority === 'Medium' ? '#D97706' : '#6B7280', fontWeight: 600 }}>{r.priority}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{r.action}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setAiRecommendations(null)} style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Re-analyse with different engine</button>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>How to improve {domain} AI visibility</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>{improvements.length > 0 ? 'Based on your actual audit results:' : 'Fix these to increase chances of being cited by ChatGPT, Claude and Perplexity.'}</div>
        {tipsToShow.map((tip, i) => {
          const isFixed = tip.status === 'pass'
          return (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < tipsToShow.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start', opacity: isFixed ? 0.7 : 1 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: isFixed ? '#DCFCE7' : '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <FontAwesomeIcon icon={isFixed ? faCircleCheck : faArrowRight} style={{ color: isFixed ? '#16A34A' : '#F97316', fontSize: 12 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isFixed ? '#16A34A' : '#111827', textDecoration: isFixed ? 'line-through' : 'none' }}>{tip.title}</span>
                {isFixed
                  ? <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#DCFCE7', color: '#16A34A', fontWeight: 600 }}>Fixed</span>
                  : <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: tip.priority === 'High' ? '#FEE2E2' : '#FEF3C7', color: tip.priority === 'High' ? '#DC2626' : '#D97706', fontWeight: 600 }}>{tip.priority}</span>
                }
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{isFixed ? 'Great work! This issue is now resolved.' : tip.message}</div>
            </div>
          </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faHistory} style={{ color: '#6B7280' }} /> Previous tests
          </div>
          {history.slice(0, 5).map((h, i) => {
            const r = h.results || []
            const c = r.filter(x => x.cited).length
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < Math.min(history.length,5)-1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 110 }}>{new Date(h.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: c > 0 ? '#16A34A' : '#DC2626', minWidth: 60 }}>{c}/{r.length} cited</span>
                <span style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.map(x => x.query).join(', ')}</span>
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}