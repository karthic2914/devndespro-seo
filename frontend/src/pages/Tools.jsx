import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWrench, faWandMagicSparkles, faCopy, faCheck, faLock } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/UI'
import AppSidebar from '../components/AppSidebar'
import api from '../utils/api'
import toast from '../utils/toast'

const SCORE_COLORS = {
  'Poor': '#DC2626',
  'Below average': '#D97706',
  'Average': '#D97706',
  'Good': '#16A34A',
  'Excellent': '#16A34A',
}

export default function Tools() {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const isPremium = user?.id === 1 || user?.is_paid

  const analyze = async () => {
    if (!content.trim()) {
      toast.error('Paste some content first')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { data } = await api.post('/tools/rewrite-for-ai', { content })
      setResult(data)
    } catch (e) {
      const msg = e.response?.data?.error || 'Failed to analyze content'
      setError(msg)
      if (!e.response?.data?.locked) toast.error(msg)
    }
    setLoading(false)
  }

  const copyRewrite = () => {
    if (!result?.rewrite) return
    navigator.clipboard.writeText(result.rewrite)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <div className="topbar">
          <span className="topbar__title">Tools</span>
        </div>

        <div className="page-content" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <FontAwesomeIcon icon={faWrench} style={{ color: 'var(--orange)' }} />
              Content Rewriter for AI Citation
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              Paste any page content and get a citability score, plus a rewrite optimized to be more likely quoted by ChatGPT and Claude.
            </p>
          </div>

          {!isPremium ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ fontSize: 28, color: 'var(--orange)', marginBottom: 14 }}>
                <FontAwesomeIcon icon={faLock} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                This tool is available on paid plans
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
                Upgrade to unlock the AI Content Rewriter, along with backlinks tracking, keyword discovery, and full AI Visibility scans.
              </div>
              <Button variant="primary" onClick={() => window.location.href = '/settings'}>
                View plans
              </Button>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, display: 'block' }}>
                  Paste your content
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste a paragraph, blog post, or page copy here (up to 8,000 characters)..."
                  rows={10}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{content.length} / 8000 characters</span>
                  <Button variant="primary" loading={loading} onClick={analyze}>
                    <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 8 }} />
                    Analyze & Rewrite
                  </Button>
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${SCORE_COLORS[result.scoreLabel] || '#6B7280'}15`,
                        border: `2px solid ${SCORE_COLORS[result.scoreLabel] || '#6B7280'}`,
                      }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: SCORE_COLORS[result.scoreLabel] || '#6B7280' }}>
                          {result.citabilityScore}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Citability Score
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: SCORE_COLORS[result.scoreLabel] || 'var(--text)' }}>
                          {result.scoreLabel}
                        </div>
                      </div>
                    </div>

                    {Array.isArray(result.issues) && result.issues.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                          Why AI may skip this content:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {result.issues.map((issue, i) => (
                            <li key={i} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Rewritten for AI citation</div>
                      <Button variant="secondary" size="sm" onClick={copyRewrite}>
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ marginRight: 6 }} />
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <div style={{
                      fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap',
                      background: '#F9FAFB', border: '1px solid var(--dark4)', borderRadius: 10, padding: 16,
                    }}>
                      {result.rewrite}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
