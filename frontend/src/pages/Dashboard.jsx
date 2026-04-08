import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faMagnifyingGlassChart,
  faHeartPulse,
  faHandPointer,
  faEye,
  faLocationDot,
  faKey,
  faArrowTrendUp,
  faArrowTrendDown,
  faListCheck,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, Badge, Button, ProgressBar, SectionLabel, T } from '../components/UI'
import { HealthScore, ActionItem, NextBestAction, ScoreGauge } from '../components/seo/SeoComponents'
import { BarChart } from '../components/charts/Charts'
import api from '../utils/api'

const AUDIT_CATEGORIES = [
  { label: 'On-Page SEO', color: T.orange },
  { label: 'Technical SEO', color: T.blue },
  { label: 'Content Quality', color: T.amber },
  { label: 'Backlink Profile', color: T.red },
  { label: 'Page Speed', color: T.green },
]

export default function Dashboard() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const [site, setSite] = useState(null)
  const [actions, setActions] = useState([])
  const [metrics, setMetrics] = useState({ dr: 0, clicks: 0, impressions: 0, health: 0 })
  const [keywords, setKeywords] = useState([])
  const [backlinks, setBacklinks] = useState([])
  const [latestAudit, setLatestAudit] = useState(null)
  const [gscData, setGscData] = useState(null)
  const [auditRunning, setAuditRunning] = useState(false)
  const [gscConnecting, setGscConnecting] = useState(false)

  const loadDashboardData = () => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))

    api.get(`/sites/${siteId}/actions`).then(r => { if (Array.isArray(r.data)) setActions(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/metrics`).then(r => { if (r.data) setMetrics(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/keywords`).then(r => { if (Array.isArray(r.data)) setKeywords(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/backlinks`).then(r => { if (Array.isArray(r.data)) setBacklinks(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/audit/latest`).then(r => setLatestAudit(r.data || null)).catch(() => {})
    api.get(`/sites/${siteId}/gsc`).then(r => { if (r.data) setGscData(r.data) }).catch(() => {})
  }

  useEffect(() => {
    loadDashboardData()
  }, [siteId])

  const handleRunAudit = async () => {
    setAuditRunning(true)
    try { await api.post(`/sites/${siteId}/audit/run`) } catch {}
    loadDashboardData()
    setAuditRunning(false)
  }

  const connectGSC = async () => {
    setGscConnecting(true)
    try {
      const r = await api.get('/auth/gsc')
      const win = window.open(r.data.url, '_blank', 'width=520,height=620,left=200,top=100')
      const handler = (e) => {
        if (e.data === 'gsc_connected') {
          window.removeEventListener('message', handler)
          api.get(`/sites/${siteId}/gsc`).then(r2 => { if (r2.data) setGscData(r2.data) }).catch(() => {})
        }
      }
      window.addEventListener('message', handler)
    } catch {}
    setGscConnecting(false)
  }

  const handleActionDone = async (action) => {
    try {
      await api.put(`/sites/${siteId}/actions/${action.id}`, { done: true })
      setActions(p => p.map(a => a.id === action.id ? { ...a, done: true } : a))
    } catch {}
  }

  const handleActionSkip = async (action) => {
    try {
      await api.delete(`/sites/${siteId}/actions/${action.id}`)
      setActions(p => p.filter(a => a.id !== action.id))
    } catch {}
  }

  const categoryScores = AUDIT_CATEGORIES.map(c => {
    const checks = (latestAudit?.checks || []).filter(x => x.category === c.label)
    if (!checks.length) return { ...c, value: 0 }
    const total = checks.reduce((sum, chk) => sum + (chk.status === 'pass' ? 100 : chk.status === 'warning' ? 60 : 20), 0)
    return { ...c, value: Math.round(total / checks.length) }
  })

  const overallScore = Number.isFinite(Number(latestAudit?.score))
    ? Number(latestAudit.score)
    : Math.round(categoryScores.reduce((s, a) => s + a.value, 0) / Math.max(categoryScores.length, 1))

  const pendingActions = actions.filter(a => !a.done)
  const nextAction = pendingActions.find(a => String(a.impact || '').toLowerCase() === 'high') || pendingActions[0]
  const previewKeywords = keywords.slice(0, 5)
  const previewActions = pendingActions.slice(0, 3)
  const previewAuditScores = categoryScores.filter(s => s.value > 0).slice(0, 3)

  const toNum = (v, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  const healthValue = metrics.health != null ? toNum(metrics.health, 0) : overallScore
  const gscClicks = toNum(gscData?.totals?.clicks, toNum(metrics.clicks, 0))
  const gscImpressions = toNum(gscData?.totals?.impressions, toNum(metrics.impressions, 0))
  const gscPositionRaw = Number(gscData?.totals?.position)
  const gscPosition = Number.isFinite(gscPositionRaw) ? gscPositionRaw.toFixed(1) : 'N/A'
  const gscError = String(gscData?.error || '')
  const gscErrorCode = String(gscData?.errorCode || '')
  const gscAccountEmail = String(gscData?.accountEmail || '')
  const trackedKeywords = Array.isArray(keywords) ? keywords.length : 0
  const drValue = toNum(metrics.dr, 0)
  const backlinkCount = Array.isArray(backlinks) ? backlinks.length : 0
  const referringDomainCount = Array.isArray(backlinks)
    ? new Set(backlinks.map(b => String(b.name || '').trim().toLowerCase()).filter(Boolean)).size
    : 0
  const dofollowCount = Array.isArray(backlinks)
    ? backlinks.filter(b => String(b.type || '').toLowerCase() === 'dofollow').length
    : 0
  const dofollowPct = backlinkCount > 0 ? Math.round((dofollowCount / backlinkCount) * 100) : 0
  const rawDaily = Array.isArray(gscData?.daily) ? gscData.daily : []
  const weeklyTraffic = rawDaily
    .slice(-7)
    .map(d => ({
      label: new Date(d.keys?.[0] || d.date || Date.now()).toLocaleDateString('en-GB', { weekday: 'short' }),
      value: toNum(d.clicks, 0),
    }))
    .filter(d => d.value > 0)

  const gscConnected = gscData?.connected === true
  const hasTrafficData = weeklyTraffic.length > 0

  return (
    <div style={{ flex: 1 }}>

      {/* Page header */}
      <div style={{
        background: '#fff', borderBottom: `1px solid ${T.border}`,
        padding: '1rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
            Overview {site && <span style={{ color: T.muted, fontWeight: 400 }}>— {site.name}</span>}
          </h1>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadDashboardData}><FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} />Refresh Data</Button>
          <Button variant="primary" size="sm" onClick={handleRunAudit} disabled={auditRunning}>
            <FontAwesomeIcon icon={faMagnifyingGlassChart} style={{ marginRight: 6, animation: auditRunning ? 'spin 1s linear infinite' : 'none' }} />
            {auditRunning ? 'Scanning…' : 'Run Full Audit'}
          </Button>
        </div>
      </div>

      <div style={{ width: '100%', padding: '1.25rem 1rem 1.5rem' }}>

        {/* Next Best Action banner */}
        {nextAction && (
          <div style={{ marginBottom: '1.5rem' }}>
            <NextBestAction
              action={nextAction.text}
              impact={nextAction.impact}
              onDone={() => handleActionDone(nextAction)}
              onSkip={() => handleActionSkip(nextAction)}
            />
          </div>
        )}

        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: '1.5rem' }}>
          <StatCard label="Site Health"      value={healthValue}  sub="out of 100"          icon={<FontAwesomeIcon icon={faHeartPulse} />} color={T.orange} accentTop />
          <StatCard label="GSC Clicks"       value={gscClicks} sub="last 28 days" icon={<FontAwesomeIcon icon={faHandPointer} />} color={T.blue} accentTop />
          <StatCard label="Impressions"      value={gscImpressions} sub="last 28 days" icon={<FontAwesomeIcon icon={faEye} />} color={T.purple} accentTop />
          <StatCard label="Avg. Position"    value={gscPosition} sub="across tracked queries" icon={<FontAwesomeIcon icon={faLocationDot} />} color={T.green} accentTop />
          <StatCard label="Tracked Keywords" value={trackedKeywords}  sub="in DB"               icon={<FontAwesomeIcon icon={faKey} />} color={T.amber} accentTop />
        </div>

        {/* Main 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem', alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Traffic chart */}
            <Card padding="1.25rem">
              <SectionLabel action={
                <Badge variant={hasTrafficData ? 'info' : 'warning'}>
                  {hasTrafficData ? 'Last 7 days' : 'Last 28 days'}
                </Badge>
              }>Weekly Traffic</SectionLabel>
              {hasTrafficData ? (
                <BarChart data={weeklyTraffic} color={T.orange} height={140} />
              ) : gscConnected && gscError ? (
                <div style={{
                  height: 140, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: T.surface2, borderRadius: 8, textAlign: 'center', padding: '0 16px',
                }}>
                  {gscAccountEmail && (
                    <div style={{ fontSize: 11, color: T.muted }}>Connected as {gscAccountEmail}</div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>
                    {gscErrorCode === 'property_access' || gscErrorCode === 'site_mismatch'
                      ? 'This account cannot access this Search Console property'
                      : gscError || 'Unable to load Search Console data'}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {gscErrorCode === 'property_access' || gscErrorCode === 'site_mismatch'
                      ? 'Use a Google account that owns this property or add this account as a verified owner in GSC'
                      : 'Reconnect Google Search Console if the problem continues'}
                  </div>
                  <Button variant="secondary" size="sm" onClick={connectGSC} disabled={gscConnecting}>
                    {gscConnecting ? 'Connecting…' : 'Reconnect GSC'}
                  </Button>
                </div>
              ) : gscConnected ? (
                <div style={{
                  height: 140, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: T.surface2, borderRadius: 8,
                }}>
                  {gscAccountEmail && (
                    <div style={{ fontSize: 11, color: T.muted }}>Connected as {gscAccountEmail}</div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>
                    {gscClicks > 0
                      ? `${gscClicks} clicks · ${gscImpressions} impressions over 28 days`
                      : 'No traffic recorded in the last 28 days'}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    Google anonymises daily data for low-traffic sites — check back as traffic grows
                  </div>
                </div>
              ) : (
                <div style={{
                  height: 140, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: T.surface2, borderRadius: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>Connect Google Search Console to see traffic</div>
                  <Button variant="secondary" size="sm" onClick={connectGSC} disabled={gscConnecting}>
                    {gscConnecting ? 'Connecting…' : 'Connect GSC'}
                  </Button>
                </div>
              )}
            </Card>

            {/* Keyword rankings table */}
            <Card padding="0">
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}><FontAwesomeIcon icon={faKey} style={{ marginRight: 6 }} />Keyword Rankings (Preview)</div>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/keywords`)}>View all <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} /></Button>
              </div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px', padding: '8px 20px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {['Keyword', 'Position', 'Change', 'Volume'].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {previewKeywords.map((kw, i) => {
                const prevPos = Number(kw.prev)
                const currentPos = Number(kw.position)
                const hasValidPositions = Number.isFinite(prevPos) && Number.isFinite(currentPos)
                const improved = hasValidPositions ? prevPos > currentPos : false
                const change = hasValidPositions ? (prevPos - currentPos) : null
                return (
                  <div key={kw.keyword + i} style={{
                    display: 'grid', gridTemplateColumns: '2fr 80px 80px 80px',
                    padding: '11px 20px', alignItems: 'center',
                    borderBottom: i < previewKeywords.length - 1 ? `1px solid #F3F4F6` : 'none',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{kw.keyword}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: currentPos <= 3 ? T.green : currentPos <= 10 ? T.orange : T.text, fontFamily: 'DM Mono, monospace' }}>
                      {Number.isFinite(currentPos) && currentPos > 0 ? `#${currentPos}` : '—'}
                    </div>
                    <div>
                      {Number.isFinite(change) && change !== 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: improved ? T.greenDim : T.redDim, color: improved ? T.green : T.red }}>
                          <FontAwesomeIcon icon={improved ? faArrowTrendUp : faArrowTrendDown} style={{ marginRight: 4 }} />
                          {Math.abs(change)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.text2, fontFamily: 'DM Mono, monospace' }}>{(kw.volume || 0).toLocaleString()}</div>
                  </div>
                )
              })}
            </Card>

            {/* Action plan preview */}
            <Card padding="0">
              <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}><FontAwesomeIcon icon={faListCheck} style={{ marginRight: 6 }} />Action Plan</div>
                  <Badge variant="danger">{pendingActions.length} pending</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/actions`)}>View all <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} /></Button>
              </div>
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {previewActions.map(action => (
                  <ActionItem key={action.id} action={action} onComplete={handleActionDone} />
                ))}
                {previewActions.length === 0 && (
                  <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: '8px 0' }}>No pending actions.</div>
                )}
              </div>
            </Card>

          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Health score */}
            <Card padding="1.25rem">
              <SectionLabel action={<Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/audit`)}>Open Audit</Button>}>Site Health Score</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0' }}>
                <HealthScore score={overallScore} size="lg" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {previewAuditScores.map(s => (
                  <ScoreGauge key={s.label} label={s.label} value={s.value} color={s.color} />
                ))}
                {previewAuditScores.length === 0 && (
                  <div style={{ fontSize: 12, color: T.muted }}>Run Site Audit to see category scores.</div>
                )}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 10 }}>Showing top categories only. Open Site Audit for full breakdown.</div>
            </Card>

            {/* Domain Authority */}
            <Card padding="1.25rem">
              <SectionLabel>Domain Authority</SectionLabel>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '0.75rem 0' }}>
                <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 42, fontWeight: 800, color: T.text, fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{drValue}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Current DR</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.text2, marginBottom: 8, lineHeight: 1.5 }}>
                    Need <strong style={{ color: T.orange }}>20+</strong> to compete in your niche.
                    Focus on getting dofollow backlinks.
                  </div>
                  <ProgressBar value={drValue} max={20} color={T.orange} height={6} showLabel />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                {[
                  { label: 'Backlinks',      value: backlinkCount, goTo: `/site/${siteId}/backlinks` },
                  { label: 'Referring Domains', value: referringDomainCount, goTo: `/site/${siteId}/backlinks` },
                  { label: 'Dofollow',       value: `${dofollowPct}%`, goTo: `/site/${siteId}/backlinks` },
                  { label: 'Target DA',      value: '20+' },
                ].map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => m.goTo && navigate(m.goTo)}
                    style={{
                      background: T.surface2,
                      borderRadius: 8,
                      padding: '10px 12px',
                      border: `1px solid ${T.border}`,
                      textAlign: 'left',
                      cursor: m.goTo ? 'pointer' : 'default',
                      opacity: m.goTo ? 1 : 0.95,
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* GSC quick stats */}
            <Card padding="1.25rem">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <SectionLabel>GSC Insights</SectionLabel>
                {gscData?.connected
                  ? <Badge variant="success">Connected</Badge>
                  : <Badge variant="default">Not connected</Badge>
                }
              </div>

              {!gscData?.connected ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.25 }}><FontAwesomeIcon icon={faMagnifyingGlassChart} /></div>
                  <div style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.5 }}>
                    Connect Google Search Console to see real clicks, impressions, and top queries.
                  </div>
                  <Button variant="primary" size="sm" onClick={connectGSC} disabled={gscConnecting} fullWidth>
                    {gscConnecting ? 'Opening…' : 'Connect Google Search Console'}
                  </Button>
                </div>
              ) : gscData?.error ? (
                <div style={{ fontSize: 12, color: T.amber, background: T.amberDim, borderRadius: 7, padding: '8px 12px' }}>{gscData.error}</div>
              ) : (
                <>
                  {[
                    { label: 'Total Clicks',   value: gscData.totals?.clicks?.toLocaleString() || '0',   sub: 'last 28 days' },
                    { label: 'Impressions',    value: gscData.totals?.impressions?.toLocaleString() || '0', sub: 'last 28 days' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid #F3F4F6` }}>
                      <span style={{ fontSize: 12, color: T.text2 }}>{s.label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>{s.sub}</div>
                      </div>
                    </div>
                  ))}
                  {gscData.queries?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Top Queries</div>
                      {gscData.queries.slice(0, 3).map((q, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid #F3F4F6`, fontSize: 12 }}>
                          <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{q.keys?.[0] || '—'}</span>
                          <span style={{ color: T.muted, flexShrink: 0 }}>{q.clicks} clicks</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="secondary" size="sm" fullWidth style={{ marginTop: 12 }} onClick={() => navigate(`/site/${siteId}/integrations`)}>Open Integrations <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} /></Button>
                </>
              )}
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}

