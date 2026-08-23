import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWrench, faWandMagicSparkles, faCopy, faCheck, faLock, faLink, faFileLines,
  faFolder, faChevronRight, faChevronDown, faCircleExclamation, faCircleCheck,
  faDownload, faFloppyDisk, faShieldHalved, faLayerGroup, faBullseye, faClock,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/UI'
import AppSidebar from '../components/AppSidebar'
import api from '../utils/api'
import toast from '../utils/toast'

const SUB_SCORE_META = [
  { key: 'clearAnswer', label: 'Clear answer', icon: faCircleCheck, color: '#16A34A' },
  { key: 'structure', label: 'Structure', icon: faLayerGroup, color: '#2563EB' },
  { key: 'authority', label: 'Authority', icon: faShieldHalved, color: '#D97706' },
  { key: 'specificity', label: 'Specificity', icon: faBullseye, color: '#7C3AED' },
  { key: 'freshness', label: 'Freshness', icon: faClock, color: '#0891B2' },
]

const AUDIENCE_OPTIONS = ['General', 'Marketers', 'Developers', 'Business owners', 'Consumers']
const CONTENT_TYPE_OPTIONS = ['Blog post', 'Landing page', 'Product page', 'Documentation', 'FAQ']

function scoreColor(score) {
  if (score >= 80) return '#16A34A'
  if (score >= 55) return '#D97706'
  return '#DC2626'
}

export default function Tools() {
  const { user } = useAuth()
  const isPremium = user?.id === 1 || user?.is_paid

  const [tab, setTab] = useState('paste')
  const [content, setContent] = useState('')
  const [url, setUrl] = useState('')
  const [sites, setSites] = useState([])
  const [siteId, setSiteId] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [audience, setAudience] = useState('')
  const [contentType, setContentType] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [mobilePanel, setMobilePanel] = useState('improve')
  const [showAllImprovements, setShowAllImprovements] = useState(false)

  useEffect(() => {
    if (!isPremium || tab !== 'project') return
    api.get('/sites').then(({ data }) => setSites(Array.isArray(data) ? data : [])).catch(() => {})
  }, [isPremium, tab])

  const analyze = async () => {
    if (tab === 'paste' && !content.trim()) return toast.error('Paste some content first')
    if (tab === 'paste' && content.trim().length < 40) return toast.error('Please paste at least a full sentence or two (40+ characters) for an accurate score')
    if (tab === 'url' && !url.trim()) return toast.error('Enter a URL first')
    if (tab === 'project' && !siteId) return toast.error('Choose a project first')

    setLoading(true)
    setError('')
    setResult(null)
    setExpanded(null)
    setShowAllImprovements(false)
    try {
      const body = { targetKeyword: targetKeyword || undefined, audience: audience || undefined, contentType: contentType || undefined }
      if (tab === 'paste') body.content = content
      if (tab === 'url') body.url = url
      if (tab === 'project') body.siteId = siteId
      const { data } = await api.post('/tools/rewrite-for-ai', body)
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
    const plain = result.rewrite.replace(/<\/?mark>/g, '')
    navigator.clipboard.writeText(plain)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const exportRewrite = () => {
    if (!result?.rewrite) return
    const plain = result.rewrite.replace(/<\/?mark>/g, '')
    const blob = new Blob([plain], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'ai-citation-rewrite.txt'
    link.click()
  }

  const saveToProject = async () => {
    if (!siteId) return toast.error('Choose a project first (use the "Choose Project" tab) to save')
    setSaving(true)
    try {
      await api.post('/tools/rewrite-for-ai/save', {
        siteId,
        sourceUrl: url || null,
        targetKeyword, audience, contentType,
        originalContent: content || null,
        originalScore: result.originalScore,
        optimizedScore: result.optimizedScore,
        subScores: result.subScores,
        improvements: result.improvements,
        rewrite: result.rewrite,
      })
      toast.success('Saved to project')
    } catch {
      toast.error('Failed to save to project')
    }
    setSaving(false)
  }

  const renderRewrite = (html) => {
    return { __html: html.replace(/<mark>/g, '<mark style="background:#EDE9FE;color:#5B21B6;padding:0 3px;border-radius:3px;font-weight:600;">') }
  }

  const allImprovements = result?.improvements || []
  const visibleImprovements = showAllImprovements ? allImprovements : allImprovements.slice(0, 3)

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <div className="topbar">
          <span className="topbar__title">Tools</span>
        </div>

        <div className="page-content" style={{ maxWidth: 1200 }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <FontAwesomeIcon icon={faWrench} style={{ color: 'var(--orange)' }} />
              AI Citation Optimizer
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              Improve your content so AI search engines can understand, trust, and cite it.
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
                Upgrade to unlock the AI Citation Optimizer, along with backlinks tracking, keyword discovery, and full AI Visibility scans.
              </div>
              <Button variant="primary" onClick={() => window.location.href = '/settings'}>
                View plans
              </Button>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="ai-tools-tab-row" style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--dark4)', marginBottom: 18 }}>
                  {[
                    { key: 'url', label: 'Enter URL', icon: faLink },
                    { key: 'paste', label: 'Paste Content', icon: faFileLines },
                    { key: 'project', label: 'Choose Project', icon: faFolder },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        padding: '12px 4px', fontSize: 13, fontWeight: 700, minHeight: 44,
                        color: tab === t.key ? 'var(--brand)' : 'var(--muted)',
                        borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
                        display: 'flex', alignItems: 'center', gap: 7, marginBottom: -1,
                      }}
                    >
                      <FontAwesomeIcon icon={t.icon} />{t.label}
                    </button>
                  ))}
                </div>

                {tab === 'url' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>URL</label>
                    <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/page" />
                  </div>
                )}

                {tab === 'paste' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>Paste your content</label>
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Paste a paragraph, blog post, or page copy here (up to 8,000 characters)..."
                      rows={8}
                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{content.length} / 8000 characters</div>
                  </div>
                )}

                {tab === 'project' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, display: 'block' }}>Project</label>
                    <select value={siteId} onChange={e => setSiteId(e.target.value)}>
                      <option value="">Select a project...</option>
                      {sites.map(s => <option key={s.id} value={s.id}>{s.name} ({s.url})</option>)}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, display: 'block' }}>Target question or keyword (optional)</label>
                    <input type="text" value={targetKeyword} onChange={e => setTargetKeyword(e.target.value)} placeholder="e.g. how to optimize for AI search" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, display: 'block' }}>Audience (optional)</label>
                    <select value={audience} onChange={e => setAudience(e.target.value)}>
                      <option value="">Any</option>
                      {AUDIENCE_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5, display: 'block' }}>Content type (optional)</label>
                    <select value={contentType} onChange={e => setContentType(e.target.value)}>
                      <option value="">Any</option>
                      {CONTENT_TYPE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ai-tools-analyze-row" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="primary" loading={loading} onClick={analyze}>
                    <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 8 }} />
                    Analyze Content
                  </Button>
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {loading && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                  <div style={{
                    width: 40, height: 40, margin: '0 auto 16px', borderRadius: '50%',
                    border: '3px solid var(--dark4)', borderTopColor: 'var(--brand)',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Analyzing your content...
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Checking clarity, structure, authority, and freshness
                  </div>
                </div>
              )}

              {result && (
                <>
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Citation Readiness</div>
                    <div
  className="ai-tools-score-layout"
  style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}
>
                      <div
  className="ai-tools-score-summary"
  style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 220 }}
>
                        <div style={{
                          width: 84, height: 84, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                          border: `4px solid ${scoreColor(result.optimizedScore)}`,
                          background: `${scoreColor(result.optimizedScore)}0D`,
                        }}>
                          <span style={{ fontSize: 24, fontWeight: 800, color: scoreColor(result.optimizedScore), lineHeight: 1 }}>{result.optimizedScore}</span>
                          <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>/100</span>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '3px 8px', borderRadius: 99, display: 'inline-block', marginBottom: 6 }}>
                            +{Math.max(result.optimizedScore - result.originalScore, 0)} potential
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, maxWidth: 200 }}>
                            Great start! Implement the recommendations below to boost your chances of being cited by AI.
                          </div>
                        </div>
                      </div>

                      <div className="ai-tools-subscore-scroll" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                        {SUB_SCORE_META.map(m => {
                          const val = result.subScores?.[m.key] ?? 0
                          return (
                            <div key={m.key} style={{ border: '1px solid var(--dark4)', borderRadius: 10, padding: '10px 14px', minWidth: 110, textAlign: 'center' }}>
                              <div style={{ color: m.color, marginBottom: 4 }}><FontAwesomeIcon icon={m.icon} /></div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>{m.label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{val}</div>
                              <div style={{ fontSize: 9, color: 'var(--muted)' }}>/100</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ai-tools-mobile-switch">
                    <button type="button" className={mobilePanel === 'improve' ? 'is-active' : ''} onClick={() => setMobilePanel('improve')}>
                      <FontAwesomeIcon icon={faCircleExclamation} />
                      What to improve
                      <span className="ai-tools-switch-badge">{allImprovements.length}</span>
                    </button>
                    <button type="button" className={mobilePanel === 'rewrite' ? 'is-active' : ''} onClick={() => setMobilePanel('rewrite')}>
                      <FontAwesomeIcon icon={faWandMagicSparkles} />
                      Rewrite
                    </button>
                  </div>
                  <div className="ai-tools-panels-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 16, marginBottom: 16 }}>
                    <div className={`card ai-tools-panel-improve ${mobilePanel === 'improve' ? 'is-active-mobile' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Priority improvements</div>
                        {allImprovements.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setShowAllImprovements(v => !v)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
                          >
                            {showAllImprovements ? 'Show less' : `View all ${allImprovements.length}`}
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {visibleImprovements.map((imp, i) => (
                          <div key={i} style={{ border: '1px solid var(--dark4)', borderRadius: 10, overflow: 'hidden' }}>
                            <button
                              onClick={() => setExpanded(expanded === i ? null : i)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                background: '#fff', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                              }}
                            >
                              <FontAwesomeIcon
                                icon={imp.done ? faCircleCheck : faCircleExclamation}
                                style={{ color: imp.done ? '#16A34A' : '#D97706', fontSize: 14, flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{imp.title}</div>
                                {expanded !== i && (
                                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.detail}</div>
                                )}
                              </div>
                              <FontAwesomeIcon icon={expanded === i ? faChevronDown : faChevronRight} style={{ color: 'var(--muted)', fontSize: 11 }} />
                            </button>
                            {expanded === i && (
                              <div style={{ padding: '0 12px 12px 36px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                                {imp.detail}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`card ai-tools-panel-rewrite ${mobilePanel === 'rewrite' ? 'is-active-mobile' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Citation-ready rewrite</div>
                      </div>
                      <div
                        className="ai-tools-rewrite-body"
                        style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text)', background: '#F9FAFB', border: '1px solid var(--dark4)', borderRadius: 10, padding: 16, maxHeight: 420, overflowY: 'auto' }}
                        dangerouslySetInnerHTML={renderRewrite(result.rewrite || '')}
                      />
                      <div className="ai-tools-rewrite-actions" style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <Button variant="secondary" size="sm" onClick={copyRewrite}>
                          <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ marginRight: 6 }} />{copied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={exportRewrite}>
                          <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} />Export
                        </Button>
                        <Button variant="primary" size="sm" loading={saving} onClick={saveToProject}>
                          <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 6 }} />Save to Project
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 90 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
                      Original <span style={{ color: scoreColor(result.originalScore), fontWeight: 800, fontSize: 16 }}>{result.originalScore}</span>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--muted)' }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
                      Optimized <span style={{ color: scoreColor(result.optimizedScore), fontWeight: 800, fontSize: 16 }}>{result.optimizedScore}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 160, height: 8, borderRadius: 99, background: 'var(--dark4)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${result.originalScore}%`, background: '#F97316' }} />
                      <div style={{ position: 'absolute', left: `${result.originalScore}%`, top: 0, bottom: 0, width: `${Math.max(result.optimizedScore - result.originalScore, 0)}%`, background: '#16A34A' }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '4px 10px', borderRadius: 99 }}>
                      +{Math.max(result.optimizedScore - result.originalScore, 0)} improvement
                    </div>
                  </div>

                  <div className="ai-tools-sticky-actions">
                    <Button variant="secondary" size="sm" onClick={copyRewrite}>
                      <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ marginRight: 6 }} />{copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={exportRewrite}>
                      <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} />Export
                    </Button>
                    <Button variant="primary" size="sm" loading={saving} onClick={saveToProject}>
                      <FontAwesomeIcon icon={faFloppyDisk} style={{ marginRight: 6 }} />Save
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
