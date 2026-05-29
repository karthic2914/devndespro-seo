import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faRobot, faCircleCheck, faCircleXmark, faHistory } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'

export default function AIVisibility() {
  const { siteId } = useParams()
  const showSnackbar = useSnackbar()
  const [queries, setQueries] = useState(['', '', ''])
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [domain, setDomain] = useState('')

  useEffect(() => {
    api.get(`/sites/${siteId}/keywords`).then(res => {
      const kws = (res.data || []).slice(0, 3).map(k => k.keyword || k.query || '')
      if (kws.some(k => k)) setQueries([kws[0] || '', kws[1] || '', kws[2] || ''])
    }).catch(() => {})
    api.get(`/sites/${siteId}/ai-visibility/history`).then(res => {
      setHistory(res.data || [])
    }).catch(() => {})
  }, [siteId])

  async function runTest() {
    const q = queries.filter(q => q.trim())
    if (!q.length) { showSnackbar('Enter at least one query', 'error'); return }
    setLoading(true)
    try {
      const res = await api.post(`/sites/${siteId}/ai-visibility/test`, { queries: q })
      setResults(res.data.results)
      setDomain(res.data.domain)
      setHistory(h => [{ results: res.data.results, created_at: new Date().toISOString() }, ...h].slice(0, 10))
      showSnackbar('Test completed!', 'success')
    } catch (e) {
      showSnackbar('Test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setLoading(false)
  }

  const cited = (results || []).filter(r => r.cited).length
  const total = (results || []).length
  const score = total > 0 ? Math.round((cited / total) * 100) : null
  const scoreLabel = score === null ? 'Not tested' : score >= 80 ? 'Excellent' : score >= 50 ? 'Average' : score > 0 ? 'Below Average' : 'Poor'
  const scoreColor = score === null ? '#9CA3AF' : score >= 80 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#F97316' }} />
          AI Visibility
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
          Test if ChatGPT cites your website when answering questions relevant to your business.
        </p>
      </div>

      {/* Score cards - only show after test */}
      {results && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'ChatGPT Citations', value: `${cited}/${total}`, sub: 'queries cited', color: cited > 0 ? '#16A34A' : '#DC2626' },
            { label: 'Domain Checked', value: domain, sub: 'your site', color: '#111827' },
            { label: 'Visibility Score', value: score !== null ? `${score}%` : '-', sub: 'AI citation rate', color: score > 0 ? '#16A34A' : '#DC2626' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Query inputs */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          <FontAwesomeIcon icon={faRobot} style={{ marginRight: 8, color: '#F97316' }} />
          Test Queries
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
          Enter questions someone might ask ChatGPT about your business or industry. We will check if your site appears in the answer.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queries.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', width: 24, flexShrink: 0, fontWeight: 600 }}>#{i + 1}</span>
              <input
                value={q}
                onChange={e => setQueries(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                placeholder={i === 0 ? 'e.g. best web developer in Stavanger' : i === 1 ? 'e.g. SEO agency Norway' : 'e.g. web design Stavanger'}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 7,
                  border: '1px solid #E5E7EB', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', color: '#111827',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#F97316'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>
          ))}
        </div>
        <button
          onClick={runTest}
          disabled={loading}
          style={{
            marginTop: 16, padding: '10px 28px', borderRadius: 8, border: 'none',
            background: loading ? '#D1D5DB' : '#F97316', color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Asking ChatGPT...' : 'Test with ChatGPT'}
        </button>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
          Each test uses GPT-4o-mini. Approx cost: $0.01 per run.
        </div>
      </div>

      {/* Results */}
      {results && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Results</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map((r, i) => (
              <div key={i} style={{
                background: '#fff', border: `1px solid ${r.cited ? '#BBF7D0' : '#FECACA'}`,
                borderRadius: 12, padding: 16,
                borderLeft: `4px solid ${r.cited ? '#16A34A' : '#DC2626'}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.excerpt ? 10 : 0 }}>
                  <FontAwesomeIcon icon={r.cited ? faCircleCheck : faCircleXmark} style={{ color: r.cited ? '#16A34A' : '#DC2626', fontSize: 16 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', flex: 1 }}>{r.query}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                    background: r.cited ? '#DCFCE7' : '#FEE2E2',
                    color: r.cited ? '#16A34A' : '#DC2626',
                  }}>
                    {r.cited ? 'CITED' : 'NOT CITED'}
                  </span>
                </div>
                {r.excerpt && (
                  <div style={{ fontSize: 12, color: '#6B7280', background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', lineHeight: 1.7, marginTop: 8 }}>
                    <span style={{ fontWeight: 600, color: '#9CA3AF', fontSize: 11, display: 'block', marginBottom: 4 }}>ChatGPT response excerpt:</span>
                    {r.excerpt}
                  </div>
                )}
                {r.error && (
                  <div style={{ fontSize: 12, color: '#DC2626', marginTop: 6 }}>Error: {r.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faHistory} style={{ color: '#6B7280' }} />
            Previous Tests
          </div>
          {history.slice(0, 5).map((h, i) => {
            const r = h.results || []
            const c = r.filter(x => x.cited).length
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                borderBottom: i < Math.min(history.length, 5) - 1 ? '1px solid #F3F4F6' : 'none',
              }}>
                <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 100 }}>
                  {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: c > 0 ? '#16A34A' : '#DC2626',
                  minWidth: 60,
                }}>{c}/{r.length} cited</span>
                <span style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.map(x => x.query).join(', ')}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}