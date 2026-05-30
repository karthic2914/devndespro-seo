import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faCircleXmark, faLightbulb, faArrowRight, faRotateRight, faHistory, faShareNodes, faDownload } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'

function genQueries(domain, brand, keywords) {
  const kw1 = keywords[0] || 'web developer'
  const kw2 = keywords[1] || 'web design'
  return [`${brand} review`, `best ${kw1} ${brand}`, `${brand} ${kw2} agency`]
}

const SCORE_LABEL = s => s >= 80 ? 'Excellent' : s >= 50 ? 'Average' : s > 0 ? 'Below average' : 'Poor'
const SCORE_COLOR = s => s >= 80 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'
const SCORE_BG = s => s >= 80 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2'

export default function AIVisibility() {
  const { siteId } = useParams()
  const showSnackbar = useSnackbar()
  const reportRef = useRef(null)
  const [site, setSite] = useState(null)
  const [queries, setQueries] = useState(['', '', ''])
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [domain, setDomain] = useState('')

  useEffect(() => {
    api.get('/sites').then(res => {
      const s = (res.data || []).find(x => String(x.id) === String(siteId))
      if (s) {
        setSite(s)
        const d = (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()
        setDomain(d)
        const brand = d.split('.')[0]
        api.get('/sites/' + siteId + '/keywords').then(kr => {
          const kws = (kr.data || []).slice(0, 3).map(k => k.keyword || k.query || '').filter(Boolean)
          setQueries(genQueries(d, brand, kws))
        }).catch(() => setQueries(genQueries(d, brand, [])))
      }
    }).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/history').then(res => {
      const h = res.data || []
      setHistory(h)
      if (h.length > 0) { setResults(h[0].results || []) }
    }).catch(() => {})
  }, [siteId])

  async function runTest() {
    const q = queries.filter(q => q.trim())
    if (!q.length) { showSnackbar('Enter at least one query', 'error'); return }
    setLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/test', { queries: q })
      setResults(res.data.results)
      setHistory(h => [{ results: res.data.results, created_at: new Date().toISOString() }, ...h].slice(0, 10))
      showSnackbar('Test completed!', 'success')
    } catch (e) {
      showSnackbar('Test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setLoading(false)
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
    try {
      const html2canvas = (await import('html2canvas')).default
      const el = reportRef.current
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' })
      const link = document.createElement('a')
      link.download = 'ai-visibility-' + (domain || 'report') + '.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      showSnackbar('Image downloaded!', 'success')
    } catch { showSnackbar('Download failed', 'error') }
  }

  const cited = (results || []).filter(r => r.cited).length
  const total = (results || []).length
  const score = total > 0 ? Math.round((cited / total) * 100) : null

  const engines = [
    { key: 'chatgpt', label: 'ChatGPT', bg: '#000', color: '#fff', initial: 'G', score, active: true },
    { key: 'claude', label: 'Claude', bg: '#D85A30', color: '#fff', initial: 'C', score: null, pending: true },
    { key: 'perplexity', label: 'Perplexity', bg: '#20808D', color: '#fff', initial: 'P', soon: true },
    { key: 'gemini', label: 'Gemini', bg: '#4285F4', color: '#fff', initial: 'G', soon: true },
  ]

  return (
    <div ref={reportRef} style={{ padding: '1.5rem 2rem', maxWidth: 860 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#F97316' }} />
            AI Visibility
            {site && <span style={{ fontSize: 13, fontWeight: 400, color: '#6B7280', marginLeft: 4 }}>- {domain}</span>}
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
            Find out if AI engines cite <strong>{domain || 'this site'}</strong> when people ask relevant questions.
          </p>
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
            {e.soon ? (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Coming soon</div>
            ) : e.pending ? (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Run ChatGPT test first</div>
            ) : score != null ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 800, color: SCORE_COLOR(score), marginBottom: 2 }}>{score}<span style={{ fontSize: 14, fontWeight: 400 }}>/100</span></div>
                <div style={{ background: '#F3F4F6', borderRadius: 3, height: 4, overflow: 'hidden', margin: '8px 0 6px' }}>
                  <div style={{ width: score + '%', height: '100%', background: SCORE_COLOR(score), borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: SCORE_BG(score), color: SCORE_COLOR(score) }}>{SCORE_LABEL(score)}</span>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Not tested yet</div>
            )}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={runTest} disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: loading ? '#D1D5DB' : '#F97316', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={loading ? faRotateRight : faWandMagicSparkles} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Asking ChatGPT...' : 'Test with ChatGPT'}
          </button>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>~$0.01 per run - GPT-4o mini</span>
        </div>
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
                    <span style={{ fontWeight: 600, color: '#9CA3AF', fontSize: 11, display: 'block', marginBottom: 3 }}>ChatGPT said:</span>
                    {r.excerpt}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>How to improve {domain} AI visibility</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>Fix these to increase chances of being cited by ChatGPT, Claude and Perplexity.</div>
        {[
          { title: 'Submit sitemap to Bing Webmaster Tools', desc: 'ChatGPT uses Bing. Not indexed on Bing = invisible to ChatGPT. Takes 10 mins at webmaster.bing.com.', priority: 'High' },
          { title: 'Get listed on Trustpilot or G2', desc: 'AI engines use review platforms as trust signals. A free Trustpilot listing is enough to start.', priority: 'High' },
          { title: 'Add author schema to content pages', desc: 'Named authors with credentials make content more citable by AI engines.', priority: 'Medium' },
          { title: 'Build Reddit presence', desc: 'Perplexity heavily cites Reddit. Comment in relevant subreddits before posting.', priority: 'Medium' },
        ].map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <FontAwesomeIcon icon={faArrowRight} style={{ color: '#F97316', fontSize: 12 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{tip.title}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: tip.priority === 'High' ? '#FEE2E2' : '#FEF3C7', color: tip.priority === 'High' ? '#DC2626' : '#D97706', fontWeight: 600 }}>{tip.priority}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{tip.desc}</div>
            </div>
          </div>
        ))}
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