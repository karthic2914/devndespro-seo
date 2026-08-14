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
  faChevronDown,
  faChevronRight,
  faBullseye,
} from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, Badge, Button, ProgressBar, SectionLabel, T } from '../components/UI'
import { HealthScore, ActionItem, NextBestAction, ScoreGauge } from '../components/seo/SeoComponents'
import { BarChart } from '../components/charts/Charts'
import { useAuth } from '../hooks/useAuth'
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
  const { user } = useAuth()
  const [site, setSite] = useState(null)
  const [actions, setActions] = useState([])
  const [metrics, setMetrics] = useState({ dr: 0, clicks: 0, impressions: 0, health: 0 })
  const [keywords, setKeywords] = useState([])

  const [latestAudit, setLatestAudit] = useState(null)
  const [multipageLatest, setMultipageLatest] = useState(null)
  const [gscData, setGscData] = useState(null)
  const [auditRunning, setAuditRunning] = useState(false)
  const [gscConnecting, setGscConnecting] = useState(false)
  const [showAuditMenu, setShowAuditMenu] = useState(false)
  const [overviewSections, setOverviewSections] = useState({
    decisionSnapshot: true,
    weeklyTraffic: true,
    keywordRankings: true,
    actionPlan: true,
    siteHealth: true,
    backlinkProfile: true,
    gscInsights: true,
  })

  const toggleOverviewSection = (section) => {
    setOverviewSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }))
  }

  const loadDashboardData = () => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))

    api.get(`/sites/${siteId}`).then(r => {
      if (r.data) setSite(r.data)
    }).catch(() => {})

    api.get(`/sites/${siteId}/actions`).then(r => { if (Array.isArray(r.data)) setActions(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/metrics`).then(r => { if (r.data) setMetrics(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/keywords`).then(r => { if (Array.isArray(r.data)) setKeywords(r.data) }).catch(() => {})
    api.get(`/sites/${siteId}/audit/latest`).then(r => setLatestAudit(r.data || null)).catch(() => {})
    api.get(`/sites/${siteId}/audit/multipage-latest`).then(r => setMultipageLatest(r.data || null)).catch(() => {})
    api.get(`/sites/${siteId}/gsc`).then(r => { if (r.data) setGscData(r.data) }).catch(() => {})
  }

  useEffect(() => { loadDashboardData() }, [siteId])

  const handleRunAudit = async () => {
    setAuditRunning(true)
    try { await api.post(`/sites/${siteId}/audit/run`) } catch {}
    loadDashboardData()
    setAuditRunning(false)
  }

  const runFullSiteAudit = async () => {
    try {
      await api.post(`/sites/${siteId}/audit/run-multipage`)
    } catch {}
    navigate(`/site/${siteId}/audit`)
  }

  const connectGSC = async () => {
    setGscConnecting(true)
    try {
      const r = await api.get('/auth/gsc')
      const popup = window.open(r.data.url, '_blank', 'width=520,height=620,left=200,top=100')

      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        popup?.close()
        api.get(`/sites/${siteId}/gsc`).then(r2 => { if (r2.data) setGscData(r2.data) }).catch(() => {})
      }

      const handler = (e) => {
        if (e.data === 'gsc_connected') {
          window.removeEventListener('message', handler)
          finish()
        }
      }

      window.addEventListener('message', handler)

      const interval = window.setInterval(async () => {
        try {
          const status = await api.get('/auth/gsc/status')
          if (status?.data?.connected) {
            window.clearInterval(interval)
            window.removeEventListener('message', handler)
            finish()
          }
        } catch {
          // Ignore transient polling failures while the popup is still open
        }
      }, 1000)

      window.setTimeout(() => {
        window.clearInterval(interval)
        window.removeEventListener('message', handler)
      }, 20000)
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
  const auditChecks = Array.isArray(latestAudit?.checks) ? latestAudit.checks : []
  const auditErrorCount = auditChecks.filter(c => c.status === 'error').length
  const auditWarningCount = auditChecks.filter(c => c.status === 'warning').length
  const auditPassCount = auditChecks.filter(c => c.status === 'pass').length

  const pendingActions = actions.filter(a => !a.done)
  const nextAction = pendingActions.find(a => String(a.impact || '').toLowerCase() === 'high') || pendingActions[0]
  const previewKeywords = keywords.slice(0, 5)
  const previewActions = pendingActions.slice(0, 3)

  const toNum = (v, fallback = 0) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  const hasMultipageAudit = !!(
    multipageLatest &&
    multipageLatest.status === 'complete' &&
    multipageLatest.results
  )

  const multipageResults = hasMultipageAudit ? multipageLatest.results : null

  const siteWideHealth = hasMultipageAudit
    ? toNum(multipageResults?.siteHealthPct, 0)
    : null

  const hasLatestAudit = !!latestAudit

  const homepageHealthValue = hasLatestAudit
    ? overallScore
    : (metrics.health != null ? toNum(metrics.health, 0) : overallScore)

  const healthValue = hasMultipageAudit
    ? siteWideHealth
    : homepageHealthValue

  /*
   * Full-site category scores.
   *
   * IMPORTANT:
   * The overall gauge uses the multipage audit when available,
   * so the category bars must use the SAME audit source.
   *
   * The backend has changed shape during development, so this helper
   * safely supports:
   *   results.categoryScores as array/object
   *   results.categories as array/object
   *   direct score properties
   *
   * It falls back to the homepage category score only if the
   * multipage payload genuinely has no category value.
   */
  const getMultipageCategoryScore = (label, fallbackValue = 0) => {
    if (!hasMultipageAudit || !multipageResults) {
      return fallbackValue
    }

    const normalize = (value) => {
      if (value && typeof value === 'object') {
        const candidate =
          value.value ??
          value.score ??
          value.pct ??
          value.percentage

        const n = Number(candidate)
        return Number.isFinite(n) ? Math.round(n) : null
      }

      const n = Number(value)
      return Number.isFinite(n) ? Math.round(n) : null
    }

    const normalizedLabel = String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const collections = [
      multipageResults.categoryScores,
      multipageResults.categories,
      multipageResults.scores,
      multipageResults.categoryBreakdown,
    ]

    for (const collection of collections) {
      if (Array.isArray(collection)) {
        const found = collection.find((item) => {
          const itemLabel = String(
            item?.label ??
            item?.name ??
            item?.category ??
            ''
          )
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')

          return itemLabel === normalizedLabel
        })

        const parsed = normalize(found)
        if (parsed != null) return parsed
      }

      if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
        for (const [key, value] of Object.entries(collection)) {
          const normalizedKey = String(key)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')

          if (normalizedKey === normalizedLabel) {
            const parsed = normalize(value)
            if (parsed != null) return parsed
          }
        }
      }
    }

    const directCandidates = {
      'onpageseo': [
        multipageResults.onPageSeoScore,
        multipageResults.onPageScore,
        multipageResults.onpageSeoScore,
        multipageResults.onpageScore,
        multipageResults.onPageSEO,
      ],
      'technicalseo': [
        multipageResults.technicalSeoScore,
        multipageResults.technicalScore,
        multipageResults.technicalSEO,
      ],
      'contentquality': [
        multipageResults.contentQualityScore,
        multipageResults.contentScore,
        multipageResults.contentQuality,
      ],
      'backlinkprofile': [
        multipageResults.backlinkProfileScore,
        multipageResults.backlinkScore,
      ],
      'pagespeed': [
        multipageResults.pageSpeedScore,
        multipageResults.performanceScore,
      ],
    }

    const candidates = directCandidates[normalizedLabel] || []

    for (const candidate of candidates) {
      const parsed = normalize(candidate)
      if (parsed != null) return parsed
    }

    return fallbackValue
  }

  const previewAuditScores = categoryScores
    .map((score) => ({
      ...score,
      value: getMultipageCategoryScore(score.label, score.value),
    }))
    .filter((score) => score.value > 0)
    .slice(0, 3)
  const gscError = String(gscData?.error || '')
  const gscErrorCode = String(gscData?.errorCode || '')
  const gscAccountEmail = String(gscData?.accountEmail || '')
  const gscConnected = gscData?.connected === true
  const hasLiveGscTotals = gscConnected && !gscError
  const gscClicks = hasLiveGscTotals ? toNum(gscData?.totals?.clicks, 0) : 0
  const gscImpressions = hasLiveGscTotals ? toNum(gscData?.totals?.impressions, 0) : 0
  const gscPositionRaw = hasLiveGscTotals ? Number(gscData?.totals?.position) : NaN
  const gscPosition = Number.isFinite(gscPositionRaw) ? gscPositionRaw.toFixed(1) : 'N/A'
  const gscSubLabel = hasLiveGscTotals ? 'last 28 days (GSC)' : (gscConnected ? 'GSC data unavailable' : 'connect GSC')
  const trackedKeywords = Array.isArray(keywords) ? keywords.length : 0
  const authorityScoreValue =
    site?.authority_score != null
      ? toNum(site.authority_score, 0)
      : toNum(metrics.dr, 0)

  const criticalIssueCount =
    Number(multipageLatest?.results?.brokenCount || 0) ||
    Number(multipageLatest?.results?.errors || 0) ||
    0

  const overviewRecommendation = (() => {
    if (nextAction?.text) {
      return nextAction.text
    }

    if (criticalIssueCount > 0) {
      return 'Critical issues found. Fix the highest-impact problems first.'
    }

    if (healthValue < 60) {
      return 'Site needs attention. Start with the most important technical and content issues.'
    }

    if (healthValue < 80) {
      return 'Good progress. Review the remaining high-impact improvements.'
    }

    if (healthValue < 90) {
      return 'Strong foundation. A few improvements can raise overall performance.'
    }

    return 'Excellent health. Focus on smaller optimization opportunities.'
  })()
  const rawDaily = Array.isArray(gscData?.daily) ? gscData.daily : []
  const weeklyTraffic = rawDaily
    .slice(-7)
    .map(d => ({
      label: new Date(d.keys?.[0] || d.date || Date.now()).toLocaleDateString('en-GB', { weekday: 'short' }),
      value: toNum(d.clicks, 0),
    }))
    .filter(d => d.value > 0)

  const hasTrafficData = weeklyTraffic.length > 0
  const isClientSiteError = gscErrorCode === 'property_access' || gscErrorCode === 'site_mismatch'
  const allowedAuditEmails = new Set(['hello@devndespro.com', 'karthic2914@gmail.com'])
  const canRunFullAudit = Boolean(user?.is_paid || allowedAuditEmails.has(user?.email))


  const renderCollapseHeader = (label, section, extra = null) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      width: '100%',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 800,
        color: T.text,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {extra}

        <button
          type="button"
          onClick={() => toggleOverviewSection(section)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${T.border}`,
            background: '#fff',
            color: T.muted,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={overviewSections[section] ? 'Collapse' : 'Expand'}
        >
          <FontAwesomeIcon
            icon={overviewSections[section] ? faChevronDown : faChevronRight}
            style={{ fontSize: 11 }}
          />
        </button>
      </div>
    </div>
  )
  return (
    <div style={{ flex: 1 }}>

      {/* Page header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '1rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>
            Overview {site && <span style={{ color: T.muted, fontWeight: 400 }}>- {site.name}</span>}
          </h1>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={loadDashboardData}>
            <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} /><span className='btn-label'>Refresh Data</span>
          </Button>
          <div className="overview-audit-split" style={{ display: 'flex', alignItems: 'start', gap: 0, position: 'relative' }}>
            <Button variant="primary" size="sm" onClick={handleRunAudit} disabled={auditRunning} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              <FontAwesomeIcon icon={faMagnifyingGlassChart} style={{ marginRight: 6, animation: auditRunning ? 'spin 1s linear infinite' : 'none' }} />
              <span className='btn-label'>{auditRunning ? 'Scanning...' : 'Run Full Audit'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAuditMenu(v => !v)} disabled={auditRunning} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
              <FontAwesomeIcon icon={faChevronDown} />
            </Button>

            {showAuditMenu && (
              <>
                <div className="overview-audit-menu-backdrop" onClick={() => setShowAuditMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div className="overview-audit-menu" style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 260, zIndex: 40, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setShowAuditMenu(false); handleRunAudit() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Quick Audit</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Homepage only - a few seconds</div>
                  </button>
                  <button
                    onClick={() => { if (!canRunFullAudit) return; setShowAuditMenu(false); runFullSiteAudit() }}
                    disabled={!canRunFullAudit}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                      background: canRunFullAudit ? '#fff' : '#F9FAFB',
                      cursor: canRunFullAudit ? 'pointer' : 'not-allowed',
                      opacity: canRunFullAudit ? 1 : 0.55,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: canRunFullAudit ? '#111827' : '#9CA3AF' }}>Full Site Audit <span style={{ fontSize: 10, color: '#F97316', fontWeight: 700 }}>BETA</span></div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Up to 100 pages - opens Site Audit to watch progress</div>
                  </button>
                </div>
              </>
            )}
          </div>
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


        <style>{`
          @media (max-width: 1050px) {
            .overview-work-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
        {/* Main 2-col grid */}
        <div className='dash-main-grid' style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: '0.85rem', alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Decision Snapshot */}
        <Card
          padding="0"
          style={{
            marginBottom: 0,
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid #0E2A47',
            boxShadow: '0 4px 14px rgba(15,23,42,0.08)',
          }}
        >
          <div style={{
            minHeight: 84,
            padding: '13px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            background: 'linear-gradient(115deg, #06172E 0%, #082746 62%, #071C36 100%)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              flex: 1,
              minWidth: 300,
            }}>
              <div style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'rgba(52,211,153,0.13)',
                color: '#34D399',
                fontSize: 27,
              }}>
                <FontAwesomeIcon icon={faBullseye} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#34D399',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  Next Best Move
                </div>

                <div style={{
                  fontSize: 15,
                  fontWeight: 800,
                  lineHeight: 1.25,
                  color: '#FFFFFF',
                  letterSpacing: '-0.015em',
                }}>
                  {overviewRecommendation}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 7,
                  fontSize: 12,
                  color: '#CBD5E1',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316' }} />
                  <span style={{ fontWeight: 700 }}>{nextAction?.impact || 'High'} impact</span>
<span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
                  <span style={{ fontWeight: 700 }}>{nextAction?.category || 'On-Page SEO'}</span>
<span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: '#CBD5E1',
                    fontWeight: 600,
                  }}>
                    <span style={{
                      color: '#34D399',
                      fontWeight: 800,
                      fontSize: 12,
                      lineHeight: 1,
                    }}>
                      &#10003;
                    </span>
                    Latest audit
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                nextAction
                  ? navigate(`/site/${siteId}/actions`)
                  : navigate(`/site/${siteId}/audit`)
              }
              style={{
                minWidth: 118,
                height: 36,
                background: 'transparent',
                color: '#34D399',
                border: '1px solid #34D399',
                fontWeight: 750,
              }}
            >
              {nextAction ? 'Fix now' : 'Review Audit'}
              <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 7 }} />
            </Button>
          </div>
        </Card>

        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 0 }}>
          <StatCard label="Site Health"      value={healthValue}       sub="out of 100"             icon={<FontAwesomeIcon icon={faHeartPulse} />}         color={T.orange} accentTop />
          <StatCard label="GSC Clicks"       value={gscClicks}         sub={gscSubLabel}             icon={<FontAwesomeIcon icon={faHandPointer} />}        color={T.blue}   accentTop />
          <StatCard label="Impressions"      value={gscImpressions}    sub={gscSubLabel}             icon={<FontAwesomeIcon icon={faEye} />}                color={T.purple} accentTop />
          <StatCard label="Avg. Position"    value={gscPosition}       sub={gscSubLabel} icon={<FontAwesomeIcon icon={faLocationDot} />}        color={T.green}  accentTop />
          <StatCard label="Tracked Keywords" value={trackedKeywords}   sub="in DB"                  icon={<FontAwesomeIcon icon={faKey} />}                color={T.amber}  accentTop />
        </div>


            {/* Traffic chart */}
            <Card padding="1rem">
              {renderCollapseHeader(
                'Search Performance & GSC',
                'weeklyTraffic',
                <Badge variant={hasTrafficData ? 'info' : 'warning'}>
                  {hasTrafficData ? 'Last 7 days' : 'Last 28 days'}
                </Badge>
              )}

              {overviewSections.weeklyTraffic && (
                <div style={{ marginTop: 6 }}>
                  {hasTrafficData ? (
                    <BarChart data={weeklyTraffic} color={T.blue} height={150} />

                  ) : gscConnected && gscError ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(260px, 1.5fr)',
                      gap: 14,
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      background: '#FAFBFC',
                      padding: 14,
                      alignItems: 'start',
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        padding: '4px 6px',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
                          {isClientSiteError ? 'No GSC access for this property' : 'Search performance unavailable'}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.55, marginTop: 5 }}>
                          {isClientSiteError
                            ? 'This client property needs its own Google Search Console connection.'
                            : 'Reconnect Google Search Console to restore clicks, impressions and position insights.'}
                        </div>
                        {gscAccountEmail && (
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 5 }}>
                            Connected as {gscAccountEmail}
                          </div>
                        )}
                        {!isClientSiteError && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={connectGSC}
                            disabled={gscConnecting}
                            style={{ marginTop: 6, alignSelf: 'flex-start' }}
                          >
                            {gscConnecting ? 'Connecting...' : 'Reconnect GSC'}
                          </Button>
                        )}
                      </div>

                      <div style={{
                        minHeight: 108,
                        borderLeft: '1px solid #E5E7EB',
                        paddingLeft: 14,
                        display: 'flex',
                        alignItems: 'end',
                        gap: 7,
                        opacity: 0.75,
                      }}>
                        {[34, 52, 42, 68, 50, 78, 62, 88, 70, 76, 54, 61].map((h, i) => (
                          <div key={i} style={{
                            flex: 1,
                            minWidth: 5,
                            height: `${h}%`,
                            borderRadius: '5px 5px 2px 2px',
                            background: 'linear-gradient(180deg, rgba(59,130,246,0.38), rgba(59,130,246,0.08))',
                          }} />
                        ))}
                      </div>
                    </div>

                  ) : gscConnected ? (
                    <div style={{
                      minHeight: 92,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: 5,
                      background: '#FAFBFC',
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      padding: '14px 16px',
                    }}>
                      {gscAccountEmail && <div style={{ fontSize: 10, color: T.muted }}>Connected as {gscAccountEmail}</div>}
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        {gscClicks > 0
                          ? `${gscClicks} clicks, ${gscImpressions} impressions over 28 days`
                          : 'No traffic recorded in the last 28 days'}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        Search Console may suppress daily data for low-traffic properties.
                      </div>
                    </div>

                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      background: '#FAFBFC',
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      padding: '14px 16px',
                      flexWrap: 'wrap',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>
                          Connect Google Search Console
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                          Unlock clicks, impressions and search-position trends.
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={connectGSC} disabled={gscConnecting}>
                        {gscConnecting ? 'Connecting...' : 'Connect GSC'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>

                    {/* Keyword Rankings + Action Plan compact row */}
            <div
              className="overview-work-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.08fr) minmax(0, 0.92fr)',
                gap: '0.85rem',
                alignItems: 'start',
              }}
            >

              {/* Keyword Rankings */}
              <Card padding="0" style={{ minWidth: 0 }}>
                <div style={{
                  padding: '0.75rem 0.9rem',
                  borderBottom: overviewSections.keywordRankings ? `1px solid ${T.border}` : 'none',
                }}>
                  {renderCollapseHeader(
                    'Keyword Rankings (Preview)',
                    'keywordRankings',
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/site/${siteId}/keywords`)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      View all
                      <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                    </Button>
                  )}
                </div>

                {overviewSections.keywordRankings && (
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) 60px 58px 68px',
                      padding: '7px 12px',
                      background: T.surface2,
                      borderBottom: `1px solid ${T.border}`,
                    }}>
                      {['Keyword', 'Pos.', 'Change', 'Volume'].map(h => (
                        <div key={h} style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: T.muted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {h}
                        </div>
                      ))}
                    </div>

                    {previewKeywords.length === 0 ? (
                      <div style={{
                        padding: '1.1rem',
                        textAlign: 'center',
                        fontSize: 11,
                        color: T.muted,
                      }}>
                        No tracked keywords yet.
                      </div>
                    ) : (
                      previewKeywords.slice(0, 4).map((kw, i) => {
                        const prevPos = Number(kw.prev)
                        const currentPos = Number(kw.position)
                        const hasValidPositions = Number.isFinite(prevPos) && Number.isFinite(currentPos)
                        const improved = hasValidPositions ? prevPos > currentPos : false
                        const change = hasValidPositions ? (prevPos - currentPos) : null

                        return (
                          <div
                            key={kw.keyword + i}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) 60px 58px 68px',
                              padding: '8px 12px',
                              alignItems: 'center',
                              minHeight: 40,
                              borderBottom:
                                i < Math.min(previewKeywords.length, 4) - 1
                                  ? '1px solid #F3F4F6'
                                  : 'none',
                            }}
                          >
                            <div style={{
                              minWidth: 0,
                              fontSize: 11,
                              fontWeight: 650,
                              color: T.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {kw.keyword}
                            </div>

                            <div style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color:
                                Number.isFinite(currentPos) && currentPos <= 3
                                  ? T.green
                                  : Number.isFinite(currentPos) && currentPos <= 10
                                  ? T.orange
                                  : T.text,
                            }}>
                              {Number.isFinite(currentPos) && currentPos > 0 ? `#${currentPos}` : ''}
                            </div>

                            <div>
                              {Number.isFinite(change) && change !== 0 ? (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: improved ? T.green : T.red,
                                  whiteSpace: 'nowrap',
                                }}>
                                  <FontAwesomeIcon
                                    icon={improved ? faArrowTrendUp : faArrowTrendDown}
                                    style={{ marginRight: 3 }}
                                  />
                                  {Math.abs(change)}
                                </span>
                              ) : null
                              }
                            </div>

                            <div style={{ fontSize: 10, color: T.text2 }}>
                              {(kw.volume || 0).toLocaleString()}
                            </div>
                          </div>
                        )
                      })
                    )}

                    <div style={{
                      padding: '6px 12px',
                      borderTop: '1px solid #F3F4F6',
                      fontSize: 9,
                      color: T.muted,
                    }}>
                      Showing {Math.min(previewKeywords.length, 4)} of {keywords.length} tracked keywords
                    </div>
                  </>
                )}
              </Card>


              {/* Action Plan */}
              <Card padding="0" style={{ minWidth: 0 }}>
                <div style={{
                  padding: '0.75rem 0.9rem',
                  borderBottom: `1px solid ${T.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    minWidth: 0,
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: T.text,
                      whiteSpace: 'nowrap',
                    }}>
                      <FontAwesomeIcon icon={faListCheck} style={{ marginRight: 6 }} />
                      Action Plan
                    </div>

                    <Badge variant={pendingActions.length > 0 ? "danger" : "success"}>
                      {pendingActions.length} pending
                    </Badge>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/site/${siteId}/actions`)}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    View all
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                  </Button>
                </div>

                {previewActions.length > 0 ? (
                  <div>
                    {previewActions.slice(0, 4).map((action, i) => (
                      <div
                        key={action.id}
                        style={{
                          padding: '8px 11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minHeight: 42,
                          borderBottom:
                            i < Math.min(previewActions.length, 4) - 1
                              ? '1px solid #F3F4F6'
                              : 'none',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleActionDone(action)}
                          title="Mark complete"
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 999,
                            border: `1px solid ${T.border}`,
                            background: '#fff',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 11,
                            fontWeight: 650,
                            color: T.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {action.text}
                          </div>

                          {action.category && (
                            <div style={{
                              fontSize: 9,
                              color: T.muted,
                              marginTop: 2,
                            }}>
                              {action.category}
                            </div>
                          )}
                        </div>

                        <Badge
                          variant={
                            String(action.impact || '').toLowerCase() === 'high'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {action.impact || 'Medium'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    minHeight: 166,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0.8rem 1rem',
                  }}>
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#F0FDF4',
                      color: '#16A34A',
                      marginBottom: 7,
                      fontSize: 14,
                    }}>
                      <FontAwesomeIcon icon={faListCheck} />
                    </div>

                    <div style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: T.text,
                    }}>
                      You're all caught up
                    </div>

                    <div style={{
                      fontSize: 9,
                      color: T.muted,
                      marginTop: 3,
                      maxWidth: 240,
                      lineHeight: 1.45,
                    }}>
                      No pending actions right now. Review your latest audit for new opportunities.
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/site/${siteId}/audit`)}
                      style={{ marginTop: 8 }}
                    >
                      Review Audit
                      <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                    </Button>
                  </div>
                )}
              </Card>

            </div>


          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

            {/* Health score */}
            <Card padding="1rem">

              {renderCollapseHeader(
                hasMultipageAudit
                  ? `Site Health (${multipageLatest.results.pagesTotal} pages)`
                  : 'Site Health',
                'siteHealth',
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/site/${siteId}/audit`)}
                  style={{
                    whiteSpace: 'nowrap',
                    minWidth: 96,
                    flexShrink: 0,
                  }}
                >
                  Open Audit
                </Button>
              )}

              {overviewSections.siteHealth && (
                <>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 84px',
                    gap: 10,
                    alignItems: 'center',
                    padding: '5px 0 4px',
                  }}>
                    <div style={{
                      position: 'relative',
                      height: 126,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <svg
                        viewBox="0 0 220 125"
                        style={{
                          width: '100%',
                          maxWidth: 220,
                          height: 125,
                          overflow: 'visible',
                        }}
                      >
                        <path
                          d="M 28 102 A 82 82 0 0 1 192 102"
                          fill="none"
                          stroke="#E4E9F0"
                          strokeWidth="13"
                          strokeLinecap="round"
                          pathLength="100"
                        />
                        <path
                          d="M 28 102 A 82 82 0 0 1 192 102"
                          fill="none"
                          stroke={
                            healthValue >= 90
                              ? '#16A34A'
                              : healthValue >= 80
                              ? '#22C55E'
                              : healthValue >= 60
                              ? '#F97316'
                              : '#DC2626'
                          }
                          strokeWidth="13"
                          strokeLinecap="round"
                          pathLength="100"
                          strokeDasharray={`${Math.max(0, Math.min(100, Number(healthValue || 0)))} 100`}
                        />
                      </svg>

                      <div style={{
                        position: 'absolute',
                        top: 52,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        textAlign: 'center',
                        minWidth: 90,
                      }}>
                        <div style={{
                          fontSize: 31,
                          lineHeight: 1,
                          fontWeight: 800,
                          color: T.text,
                          letterSpacing: '-0.04em',
                        }}>
                          {healthValue}
                        </div>

                        <div style={{
                          fontSize: 10,
                          color: T.muted,
                          fontWeight: 600,
                          marginTop: 2,
                        }}>
                          /100
                        </div>

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 6,
                          padding: '3px 9px',
                          borderRadius: 999,
                          background:
                            healthValue >= 80 ? '#F0FDF4'
                            : healthValue >= 60 ? '#FFF7ED'
                            : '#FEF2F2',
                          color:
                            healthValue >= 80 ? '#15803D'
                            : healthValue >= 60 ? '#EA580C'
                            : '#DC2626',
                          fontSize: 8,
                          fontWeight: 800,
                        }}>
                          {
                            healthValue >= 90 ? 'Excellent'
                            : healthValue >= 80 ? 'Strong'
                            : healthValue >= 60 ? 'Needs Work'
                            : 'Priority'
                          }
                        </div>
                      </div>
                    </div>

                    <div style={{
                      borderLeft: '1px solid #E5E7EB',
                      paddingLeft: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 14,
                      minHeight: 100,
                    }}>
                      <div>
                        <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 800, color: '#F97316' }}>
                          {
                            hasMultipageAudit
                              ? multipageLatest.results.totalWarnings || 0
                              : auditWarningCount
                          }
                        </div>
                        <div style={{ fontSize: 8, color: T.muted, marginTop: 4, fontWeight: 600 }}>
                          warnings
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 800, color: '#16A34A' }}>
                          {
                            hasMultipageAudit
                              ? multipageLatest.results.healthyCount || 0
                              : auditPassCount
                          }
                        </div>
                        <div style={{ fontSize: 8, color: T.muted, marginTop: 4, fontWeight: 600 }}>
                          {hasMultipageAudit ? 'healthy pages' : 'passed'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 3,
                  }}>
                    {previewAuditScores.map((score) => (
                      <div
                        key={score.label}
                        className="overview-audit-score-row"
                        role="link"
                        tabIndex={0}
                        title={`Open ${score.label} audit details`}
                        onClick={() =>
                          navigate(
                            `/site/${siteId}/audit?category=${encodeURIComponent(score.label)}`
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(
                              `/site/${siteId}/audit?category=${encodeURIComponent(score.label)}`
                            )
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 4,
                        }}>
                          <span style={{ fontSize: 9, fontWeight: 650, color: T.text2 }}>
                            {score.label}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: score.color }}>
                            {score.value}/100
                          </span>
                        </div>

                        <div style={{
                          width: '100%',
                          height: 4,
                          borderRadius: 999,
                          background: '#E9EDF2',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.max(0, Math.min(100, Number(score.value || 0)))}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: score.color,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth
                    style={{
                      marginTop: 6,
                      border: 'none',
                      color: '#4F46E5',
                      paddingTop: 5,
                      paddingBottom: 5,
                    }}
                    onClick={() => navigate(`/site/${siteId}/audit`)}
                  >
                    View full audit report
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 7 }} />
                  </Button>
                </>
              )}

            </Card>

            {/* Backlink Profile removed from Overview — use Backlinks page (admin only) */}


          </div>
        </div>
      </div>
    </div>
  )
}




