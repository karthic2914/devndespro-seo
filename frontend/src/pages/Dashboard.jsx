import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
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
  faChevronUp,
  faBullseye,
} from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, Badge, Button, ProgressBar, SectionLabel, T } from '../components/UI'
import ScoreInfoTip from '../components/ScoreInfoTip'
import { auditCategoryScoreKey } from '../utils/scoreHelp'
import AppProcessTopBar from '../components/AppProcessTopBar'
import { OVERVIEW_PAGE_FLOW } from '../constants/pageFlows'
import useProcessScrollSpy from '../hooks/useProcessScrollSpy'
import { BarChart } from '../components/charts/Charts'
import { useAuth } from '../hooks/useAuth'
import api from '../utils/api'
import toast from '../utils/toast'

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
  const auditMenuAnchorRef = useRef(null)
  const [auditMenuPos, setAuditMenuPos] = useState({ top: 0, left: 0, width: 260 })
  const [overviewSections, setOverviewSections] = useState({
    decisionSnapshot: true,
    weeklyTraffic: false,
    keywordRankings: true,
    actionPlan: true,
    siteHealth: true,
    backlinkProfile: true,
    gscInsights: true,
  })
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(OVERVIEW_PAGE_FLOW, [actions.length, keywords.length])

  useLayoutEffect(() => {
    if (!showAuditMenu) return
    const place = () => {
      const el = auditMenuAnchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const width = Math.min(280, window.innerWidth - 16)
      let left = rect.right - width
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      setAuditMenuPos({ top: rect.bottom + 6, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [showAuditMenu])

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
    Promise.all([
      api.get(`/sites/${siteId}/audit/latest`).then(r => { setLatestAudit(r.data || null); return r.data }).catch(() => null),
      api.get(`/sites/${siteId}/audit/multipage-latest`).then(r => { setMultipageLatest(r.data || null); return r.data }).catch(() => null),
    ]).then(() =>
      api.post(`/sites/${siteId}/actions/sync-from-audit`)
        .then(r => {
          if (Array.isArray(r.data?.actions)) setActions(r.data.actions)
          if (r.data?.health != null) {
            setMetrics(m => ({ ...m, health: r.data.health }))
            window.dispatchEvent(new CustomEvent('site-health-updated', { detail: { health: r.data.health } }))
            setMultipageLatest(prev => {
              if (!prev?.results) return prev
              return {
                ...prev,
                site_health_pct: r.data.health,
                results: { ...prev.results, siteHealthPct: r.data.health },
              }
            })
          }
        })
        .catch(() => {})
    )
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

  const applyHealthFromAction = (data) => {
    const delta = Number(data?.healthDelta) || 0
    if (delta > 0) {
      const nextHealth = data.health != null
        ? data.health
        : null
      setMetrics(m => {
        const health = nextHealth != null
          ? nextHealth
          : Math.min(100, Number(m.health || 0) + delta)
        window.dispatchEvent(new CustomEvent('site-health-updated', { detail: { health } }))
        return { ...m, health }
      })
      setMultipageLatest(prev => {
        if (!prev?.results) return prev
        const prevPct = Number(prev.results.siteHealthPct ?? prev.site_health_pct ?? 0)
        const nextPct = data.health != null ? data.health : Math.min(100, prevPct + delta)
        return {
          ...prev,
          site_health_pct: nextPct,
          results: { ...prev.results, siteHealthPct: nextPct },
        }
      })
      setLatestAudit(prev => {
        if (!prev || prev.score == null) return prev
        return { ...prev, score: Math.min(100, Number(prev.score) + delta) }
      })
    }
  }

  const handleActionDone = async (action) => {
    if (!action?.id) {
      toast.error('Open Action Plan to mark this task fixed')
      navigate(`/site/${siteId}/actions`)
      return
    }
    try {
      const { data } = await api.put(`/sites/${siteId}/actions/${action.id}`, { done: true })
      const remaining = actions.filter(a => !a.done && a.id !== action.id)
      setActions(p => p.map(a => a.id === action.id ? { ...a, done: true } : a))
      applyHealthFromAction(data)
      const nextUp = [...remaining].sort((a, b) => {
        const rank = (impact) => {
          const i = String(impact || '').toLowerCase()
          if (i === 'critical') return 0
          if (i === 'high') return 1
          if (i === 'medium') return 2
          if (i === 'low') return 3
          return 4
        }
        return rank(a.impact) - rank(b.impact)
      })[0]
      if (data?.healthDelta) {
        toast.success(
          `Marked fixed. Site Health +${data.healthDelta}` +
            (data.health != null ? ` → ${data.health}` : '') +
            (nextUp?.text ? `. Next: ${String(nextUp.text).slice(0, 70)}` : '')
        )
      } else if (nextUp?.text) {
        toast.success(`Marked fixed. Next: ${String(nextUp.text).slice(0, 70)}`)
      } else {
        toast.success('Marked fixed - Action Plan clear for now')
      }
    } catch {
      toast.error('Could not update action')
    }
  }

  const handleActionSkip = async (action) => {
    try {
      await api.delete(`/sites/${siteId}/actions/${action.id}`)
      setActions(p => p.filter(a => a.id !== action.id))
    } catch {}
  }

  const categoryScores = AUDIT_CATEGORIES.map(c => {
    const homeChecks = Array.isArray(latestAudit?.checks)
      ? latestAudit.checks
      : Array.isArray(latestAudit?.results?.checks)
      ? latestAudit.results.checks
      : []
    const checks = homeChecks.filter(x => x.category === c.label)
    if (!checks.length) return { ...c, value: 0 }
    const total = checks.reduce((sum, chk) => sum + (chk.status === 'pass' ? 100 : chk.status === 'warning' ? 60 : 20), 0)
    return { ...c, value: Math.round(total / checks.length) }
  })

  const overallScore = Number.isFinite(Number(latestAudit?.score))
    ? Number(latestAudit.score)
    : Math.round(categoryScores.reduce((s, a) => s + a.value, 0) / Math.max(categoryScores.length, 1))
  const auditChecks = Array.isArray(latestAudit?.checks)
    ? latestAudit.checks
    : Array.isArray(latestAudit?.results?.checks)
    ? latestAudit.results.checks
    : []
  const auditErrorCount = auditChecks.filter(c => c.status === 'error').length
  const auditWarningCount = auditChecks.filter(c => c.status === 'warning').length
  const auditPassCount = auditChecks.filter(c => c.status === 'pass').length

  const pendingActions = actions.filter(a => !a.done)
  const impactRank = (impact) => {
    const i = String(impact || '').toLowerCase()
    if (i === 'critical') return 0
    if (i === 'high') return 1
    if (i === 'medium') return 2
    if (i === 'low') return 3
    return 4
  }
  const sortedPending = [...pendingActions].sort((a, b) => impactRank(a.impact) - impactRank(b.impact))
  const nextStoredAction = sortedPending[0] || null

  const inferCategory = (text = '') => {
    const t = String(text).toLowerCase()
    if (/backlink|authority|referr/.test(t)) return 'Backlinks'
    if (/speed|lcp|cls|performance|core web/.test(t)) return 'Page Speed'
    if (/schema|snippet|ai |chatgpt|aeo|llm/.test(t)) return 'AI Visibility'
    if (/https?|canonical|robots|sitemap|redirect|404|status|index|crawl|ssl|technical/.test(t)) return 'Technical SEO'
    if (/content|word count|thin|heading|h1|readab/.test(t)) return 'Content Quality'
    return 'On-Page SEO'
  }

  /** Prefer Action Plan task; else top live audit issue so banner is never generic fluff */
  const auditIssueCandidates = (() => {
    const out = []
    const seen = new Set()
    const pushIssue = (raw, status = 'warning') => {
      const text = String(
        raw?.sampleMessage || raw?.message || raw?.title || raw?.check || raw?.text || ''
      ).trim()
      if (!text) return
      const key = text.toLowerCase().slice(0, 160)
      if (seen.has(key)) return
      seen.add(key)
      const impactFromRaw = String(raw?.impact || '').toLowerCase()
      const impact =
        impactFromRaw === 'high' || impactFromRaw === 'critical' || status === 'error' || status === 'fail'
          ? 'High'
          : impactFromRaw === 'low'
          ? 'Low'
          : 'Medium'
      const count = Number(raw?.count) || 0
      const category =
        raw?.category ||
        inferCategory(text)
      out.push({
        id: null,
        text: text.slice(0, 180),
        impact,
        category,
        count,
        source: 'audit-live',
        done: false,
      })
    }

    const mp = multipageLatest?.results
    if (Array.isArray(mp?.issueSummary)) {
      const sorted = [...mp.issueSummary]
        .filter(i => {
          const st = String(i.status || '').toLowerCase()
          return st === 'error' || st === 'warning' || st === 'fail' || Number(i.count) > 0
        })
        .sort((a, b) => {
          const rank = (s) => (String(s).toLowerCase() === 'error' ? 0 : 1)
          return rank(a.status) - rank(b.status) || (b.count || 0) - (a.count || 0)
        })
      for (const issue of sorted.slice(0, 8)) {
        pushIssue(issue, issue.status)
      }
    }
    if (Array.isArray(mp?.topIssues)) {
      for (const i of mp.topIssues.slice(0, 5)) pushIssue(i, i.status || 'warning')
    }
    if (Array.isArray(mp?.checks)) {
      for (const c of mp.checks.filter(x => x.status === 'error' || x.status === 'warning').slice(0, 5)) {
        pushIssue(c, c.status)
      }
    }
    const homeChecks = Array.isArray(latestAudit?.checks) ? latestAudit.checks
      : Array.isArray(latestAudit?.results?.checks) ? latestAudit.results.checks
      : []
    for (const c of homeChecks.filter(x => x.status === 'error' || x.status === 'warning').slice(0, 5)) {
      pushIssue(c, c.status)
    }
    return out
  })()

  const nextAction = nextStoredAction
    ? {
        ...nextStoredAction,
        category: nextStoredAction.category || inferCategory(nextStoredAction.text),
      }
    : auditIssueCandidates[0] || null
  const nextActionCategory = nextAction?.category || inferCategory(nextAction?.text)
  const pendingCount = pendingActions.length || auditIssueCandidates.length
  const previewKeywords = keywords.slice(0, 5)
  // First page: show many important website fixes (Action Plan, else live audit issues)
  const fixItems = (sortedPending.length ? sortedPending : auditIssueCandidates).slice(0, 8)

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
      const pages = Number(nextAction.count) || 0
      if (pages > 1) return `${nextAction.text} (${pages} pages)`
      return nextAction.text
    }
    if (!hasLatestAudit && !hasMultipageAudit) {
      return 'Run a site audit to generate your next best SEO moves.'
    }
    if (healthValue >= 90) {
      return 'Excellent health. Keep publishing content and earning quality backlinks.'
    }
    if (healthValue < 75) {
      return 'Health is below target. Open Site Audit and fix the highest-impact failing checks first.'
    }
    return 'Your latest audit looks clear. Add a task or re-run audit to find new opportunities.'
  })()

  const nextMoveMeta = (() => {
    if (nextAction) {
      const fromPlan = Boolean(nextAction.id)
      return {
        impact: nextAction.impact || 'High',
        category: nextActionCategory,
        statusLabel: fromPlan
          ? (pendingCount > 1 ? `${pendingCount} in Action Plan` : 'In Action Plan')
          : (pendingCount > 1 ? `${pendingCount} from latest audit` : 'Latest audit'),
      }
    }
    if (!hasLatestAudit && !hasMultipageAudit) {
      return { impact: 'High', category: 'Site Audit', statusLabel: 'No audit yet' }
    }
    return { impact: 'Low', category: 'Maintenance', statusLabel: 'All caught up' }
  })()

  const nextMoveImpactColor = (() => {
    const i = String(nextMoveMeta.impact || '').toLowerCase()
    if (i === 'high' || i === 'critical') return '#F97316'
    if (i === 'low') return '#34D399'
    return '#FBBF24'
  })()

  const handleNextMoveClick = async () => {
    if (nextAction?.id) {
      await handleActionDone(nextAction)
      return
    }
    if (nextAction && !nextAction.id) {
      // Live audit issue not yet in Action Plan → seed then open plan
      try {
        await api.post(`/sites/${siteId}/actions/sync-from-audit`)
      } catch { /* ignore */ }
      navigate(`/site/${siteId}/actions`)
      return
    }
    if (!hasLatestAudit && !hasMultipageAudit) {
      navigate(`/site/${siteId}/audit`)
      return
    }
    navigate(`/site/${siteId}/audit`)
  }

  const nextMoveButtonLabel = nextAction?.id
    ? 'Mark as fixed'
    : nextAction
    ? 'Fix in Action Plan'
    : (!hasLatestAudit && !hasMultipageAudit)
    ? 'Run Audit'
    : 'Review Audit'
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


  const renderCollapseHeader = (label, section, extra = null, scoreKey = null) => (
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}>
        {label}
        {scoreKey ? <ScoreInfoTip scoreKey={scoreKey} /> : null}
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
            icon={overviewSections[section] ? faChevronUp : faChevronDown}
            style={{ fontSize: 11 }}
          />
        </button>
      </div>
    </div>
  )
  return (
    <div style={{ flex: 1 }}>
      <AppProcessTopBar
        steps={OVERVIEW_PAGE_FLOW.map((s) => ({
          ...s,
          done: s.id === 'fix' ? pendingActions.length === 0 && actions.length > 0 : false,
          active: scrollFlowId === s.id,
          onClick: () => {
            setScrollFlowId(s.id)
            if (s.sectionId) {
              document.getElementById(s.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          },
        }))}
      />

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
          <div className="overview-audit-split" ref={auditMenuAnchorRef} style={{ display: 'flex', alignItems: 'start', gap: 0, position: 'relative' }}>
            <Button variant="primary" size="sm" onClick={handleRunAudit} disabled={auditRunning} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              <FontAwesomeIcon icon={faMagnifyingGlassChart} style={{ marginRight: 6, animation: auditRunning ? 'spin 1s linear infinite' : 'none' }} />
              <span className='btn-label'>{auditRunning ? 'Scanning...' : 'Run Full Audit'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAuditMenu(v => !v)} disabled={auditRunning} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
              <FontAwesomeIcon icon={faChevronDown} />
            </Button>

            {showAuditMenu && createPortal(
              <>
                <div className="overview-audit-menu-backdrop" onClick={() => setShowAuditMenu(false)} />
                <div
                  className="overview-audit-menu"
                  style={{
                    position: 'fixed',
                    top: auditMenuPos.top,
                    left: auditMenuPos.left,
                    width: auditMenuPos.width,
                    background: '#fff',
                    border: '1px solid #E5E7EB',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                  }}
                >
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
              </>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', padding: '1.25rem 1rem 1.5rem' }}>

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

        {/* Next Best Move */}
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
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: nextMoveImpactColor }} />
                  <span style={{ fontWeight: 700 }}>{nextMoveMeta.impact} impact</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399' }} />
                  <span style={{ fontWeight: 700 }}>{nextMoveMeta.category}</span>
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
                    {nextMoveMeta.statusLabel}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {nextAction?.id ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleActionSkip(nextAction)}
                  style={{
                    height: 36,
                    background: 'transparent',
                    color: '#94A3B8',
                    border: '1px solid #334155',
                    fontWeight: 650,
                  }}
                >
                  Skip
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNextMoveClick}
                style={{
                  minWidth: 118,
                  height: 36,
                  background: 'transparent',
                  color: '#34D399',
                  border: '1px solid #34D399',
                  fontWeight: 750,
                }}
              >
                {nextMoveButtonLabel}
                <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 7 }} />
              </Button>
            </div>
          </div>
        </Card>

        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 0 }}>
          <StatCard label="Site Health"      value={healthValue}       sub="out of 100"             icon={<FontAwesomeIcon icon={faHeartPulse} />}         color={T.orange} accentTop scoreKey="siteHealth" />
          <StatCard label="GSC Clicks"       value={gscClicks}         sub={gscSubLabel}             icon={<FontAwesomeIcon icon={faHandPointer} />}        color={T.blue}   accentTop scoreKey="gscClicks" />
          <StatCard label="Impressions"      value={gscImpressions}    sub={gscSubLabel}             icon={<FontAwesomeIcon icon={faEye} />}                color={T.purple} accentTop scoreKey="impressions" />
          <StatCard label="Avg. Position"    value={gscPosition}       sub={gscSubLabel} icon={<FontAwesomeIcon icon={faLocationDot} />}        color={T.green}  accentTop scoreKey="avgPosition" />
          <StatCard label="Tracked Keywords" value={trackedKeywords}   sub="in DB"                  icon={<FontAwesomeIcon icon={faKey} />}                color={T.amber}  accentTop scoreKey="trackedKeywords" />
        </div>

        {/* Step 1: website fixes first on Overview */}
        <Card
          id="overview-section-fixes"
          padding="0"
          style={{
            scrollMarginTop: 72,
            border: `1px solid ${T.orange}55`,
            boxShadow: '0 2px 10px rgba(230, 106, 57, 0.06)',
          }}
        >
          <div style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
            flexWrap: 'wrap',
            background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#9A3412',
                  background: '#FFEDD5', borderRadius: 99, padding: '3px 10px',
                }}>Step 1</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                  <FontAwesomeIcon icon={faListCheck} style={{ marginRight: 6, color: T.orange }} />
                  Fix your website
                </div>
                <Badge variant={fixItems.length > 0 ? 'danger' : 'success'}>
                  {fixItems.length} important
                </Badge>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                Highest-impact issues first. Fix these before keywords, backlinks, or AI PR.
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/site/${siteId}/actions`)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Full Action Plan
              <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
            </Button>
          </div>

          {fixItems.length > 0 ? (
            <div>
              {fixItems.map((action, i) => {
                const impact = String(action.impact || 'Medium')
                const high = impact.toLowerCase() === 'high' || impact.toLowerCase() === 'critical'
                return (
                  <div
                    key={action.id || `fix-${i}`}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: i < fixItems.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: i === 0 ? '#FFF7ED' : '#F8FAFC',
                      border: `1px solid ${i === 0 ? '#FDBA74' : T.border}`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      color: i === 0 ? '#C2410C' : T.muted,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    {action.id ? (
                      <button
                        type="button"
                        onClick={() => handleActionDone(action)}
                        title="Mark complete"
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          border: `1px solid ${T.border}`,
                          background: '#fff',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                    ) : null}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: i === 0 ? 750 : 650,
                        color: T.text,
                        lineHeight: 1.35,
                      }}>
                        {action.text}
                        {Number(action.count) > 1 ? ` (${action.count} pages)` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        {action.category || inferCategory(action.text)}
                        {i === 0 ? ' · Start here' : ''}
                      </div>
                    </div>
                    <Badge variant={high ? 'danger' : 'warning'}>{impact}</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (action.id) navigate(`/site/${siteId}/actions`)
                        else navigate(`/site/${siteId}/audit`)
                      }}
                      style={{ flexShrink: 0, height: 32, fontWeight: 700 }}
                    >
                      Fix
                      <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 5 }} />
                    </Button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>No open website fixes</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                Run a Site Audit or refresh Action Plan to find new issues.
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/site/${siteId}/audit`)}
                style={{ marginTop: 10 }}
              >
                Open Site Audit
              </Button>
            </div>
          )}
        </Card>

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

                    {/* Step 2: Keyword Rankings */}
            <div id="overview-section-keywords" style={{ scrollMarginTop: 72 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#9A3412',
                  background: '#FFF7ED', border: '1px solid #FED7AA',
                  borderRadius: 99, padding: '3px 10px',
                }}>Step 2</span>
                <span style={{ fontSize: 12, color: T.muted }}>After website fixes - improve keyword rankings</span>
              </div>
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
            </div>

            {/* Step 3: Grow - must sit in the left column after Keywords so scroll-spy order is correct */}
            <Card
              id="overview-section-grow"
              padding="0"
              style={{ scrollMarginTop: 72 }}
            >
              <div style={{
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: '#9A3412',
                      background: '#FFF7ED', border: '1px solid #FED7AA',
                      borderRadius: 99, padding: '3px 10px',
                    }}>Step 3</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                      Grow with backlinks & AI Visibility
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                    After fixes and keywords, build authority and get mentioned in AI answers.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/site/${siteId}/backlinks`)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Backlinks
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/site/${siteId}/ai-visibility`)}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    AI Visibility
                    <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                  </Button>
                </div>
              </div>
            </Card>

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
                </Button>,
                'siteHealth'
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
                        <div style={{ fontSize: 8, color: T.muted, marginTop: 4, fontWeight: 600 }} className="score-label-with-tip">
                          warnings
                          <ScoreInfoTip scoreKey="auditWarnings" />
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
                        <div style={{ fontSize: 8, color: T.muted, marginTop: 4, fontWeight: 600 }} className="score-label-with-tip">
                          {hasMultipageAudit ? 'healthy pages' : 'passed'}
                          <ScoreInfoTip scoreKey="healthyPages" />
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
                          <span style={{ fontSize: 9, fontWeight: 650, color: T.text2 }} className="score-label-with-tip">
                            {score.label}
                            {auditCategoryScoreKey(score.label) ? (
                              <ScoreInfoTip scoreKey={auditCategoryScoreKey(score.label)} asSpan />
                            ) : null}
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

            {/* Backlink Profile removed from Overview - use Backlinks page (admin only) */}


          </div>
        </div>
      </div>
    </div>
  )
}




