import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faArrowsRotate, faPlay, faClock, faExternalLink, faPenToSquare,
  faMagnifyingGlassChart, faCircleXmark, faTriangleExclamation, faCircleCheck,
  faCamera, faShareNodes, faEnvelope, faChevronLeft, faChevronRight, faChevronDown,
  faAlignLeft, faAlignCenter, faAlignRight,
} from '@fortawesome/free-solid-svg-icons'
import html2canvas from 'html2canvas'
import { Button, Modal, Input } from '../components/UI'
import { useSnackbar } from '../App'
import { useAuth } from '../hooks/useAuth'
import api from '../utils/api'
import AuditScoreBanner from '../components/audit/AuditScoreBanner'
import AuditIssueRow from '../components/audit/AuditIssueRow'
import AuditSpeedPanel from '../components/audit/AuditSpeedPanel'

const CAT_ORDER = ['On-Page SEO', 'Technical SEO', 'Content Quality', 'Page Speed', 'Server & Security', 'Advanced SEO', 'AI Snippet', 'AEO']

function groupByCategory(checks = []) {
  const map = {}
  for (const c of checks) {
    const cat = c.category || 'On-Page SEO'
    if (!map[cat]) map[cat] = []
    map[cat].push(c)
  }
  const orderedNames = [...CAT_ORDER, ...Object.keys(map).filter((n) => !CAT_ORDER.includes(n))]
  return orderedNames.map((name) => {
    const issues = map[name] || []
    if (!issues.length) return null
    const score = Math.round(
      issues.reduce((s, i) => s + (i.status === 'pass' ? 100 : i.status === 'warning' ? 55 : 15), 0) / issues.length
    )
    return { name, id: name.toLowerCase().replace(/\s+/g, '_'), issues, score }
  }).filter(Boolean)
}

const IMPACT_W = { High: 3, Medium: 2, Low: 1 }
function sortByPriority(issues) {
  return [...issues].sort((a, b) => {
    const statusW = { error: 3, warning: 2, pass: 1 }
    const sw = (statusW[b.status] || 0) - (statusW[a.status] || 0)
    if (sw !== 0) return sw
    return (IMPACT_W[b.impact] || 0) - (IMPACT_W[a.impact] || 0)
  })
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return (url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
  }
}

function getSummarySubject(lang, url) {
  const domain = extractDomain(url) || "your website"
  return lang === "no"
    ? domain + " \u2013 fant noen SEO-forbedringer"
    : domain + " \u2013 found a few SEO improvements"
}

function getSummaryEmailText(lang, tone, auditData, allIssues) {
  const score    = auditData?.score ?? '-'
  const critical = (allIssues || []).filter((i) => i.status === 'error').length
  const warnings = (allIssues || []).filter((i) => i.status === 'warning').length
  const url      = auditData?.url || 'nettstedet'

  let techScore = null, contentScore = null
  if (Array.isArray(auditData?.checks)) {
    const grouped = groupByCategory(auditData.checks)
    for (const cat of grouped) {
      if (cat.name.toLowerCase().includes('technical seo') || cat.name.toLowerCase().includes('sikkerhet') || cat.name.toLowerCase().includes('security')) {
        techScore = cat.score
      }
      if (cat.name.toLowerCase().includes('content quality')) {
        contentScore = cat.score
      }
    }
  }
  techScore    = techScore ?? '-'
  contentScore = contentScore ?? '-'
  const techTick    = techScore === 100 ? ' &#10003;' : ''
  const contentTick = contentScore === 100 ? ' &#10003;' : ''

  // -- NORWEGIAN ----------------------------------------------------------------
  if (lang === 'no') {
    if (tone === 'formal') {
      return `Kjære [Navn/Team],<br><br>
Jeg har nylig gjennomført en teknisk SEO-analyse av <b>${url}</b> og ønsker å dele en oppsummering av funn som kan være relevante for deres digitale synlighet.<br><br>
<b>Revisjonsoppsummering:</b><br>
- Total helsescore: <b>${score}/100</b><br>
- Kritiske problemer: <b>${critical}</b> (påvirker direkte Googles indeksering)<br>
- Advarsler: <b>${warnings}</b><br>
- Teknisk SEO &amp; sikkerhet: <b>${techScore}</b>${techTick}<br>
- Innholdskvalitet: <b>${contentScore}</b>${contentTick}<br><br>
En fullstendig rapport med konkrete anbefalinger er tilgjengelig kostnadsfritt, dersom teamet ønsker å gjennomgå den.<br><br>
Med vennlig hilsen,<br>
<b>Mahadevan</b><br>
Devndespro – Webutvikling &amp; SEO<br>
<a href="https://www.devndespro.com">www.devndespro.com</a> | hello@devndespro.com`
    }
    // casual norsk
    return `Hei,<br><br>
Jeg har kjørt en teknisk SEO-analyse av <b>${url}</b> og ville dele noen av funnene med dere.<br><br>
<b>Kort oppsummert:</b><br>
- Total helsescore: <b>${score}/100</b><br>
- Kritiske problemer: <b>${critical}</b><br>
- Advarsler: <b>${warnings}</b><br>
- Teknisk SEO &amp; sikkerhet: <b>${techScore}</b>${techTick}<br>
- Innholdskvalitet: <b>${contentScore}</b>${contentTick}<br><br>
De kritiske problemene påvirker direkte hvordan Google crawler og rangerer siden.<br><br>
Analysen er gjort via mitt eget SEO-verktøy (<a href="https://seo.devndespro.com">seo.devndespro.com</a>), som jeg bruker til å hjelpe norske bedrifter med å forbedre synligheten sin på nett.<br><br>
Jeg har en fullstendig rapport klar med konkrete forslag til utbedring - gjerne gratis tilgjengelig for dere hvis det er av interesse.<br><br>
Med vennlig hilsen,<br>
<b>Mahadevan</b><br>
Devndespro – Webutvikling &amp; SEO<br>
<a href="https://www.devndespro.com">www.devndespro.com</a><br>
<a href="https://seo.devndespro.com">seo.devndespro.com</a>`
  }

  // -- ENGLISH ------------------------------------------------------------------
  if (tone === 'formal') {
    return `Dear [Name/Team],<br><br>
I recently conducted a technical SEO audit of <b>${url}</b> and wanted to share a summary of findings that may be relevant to your digital visibility.<br><br>
<b>Audit Summary:</b><br>
- Overall Health Score: <b>${score}/100</b><br>
- Critical Issues: <b>${critical}</b> (directly impacting Google crawling and indexing)<br>
- Warnings: <b>${warnings}</b><br>
- Technical SEO &amp; Security: <b>${techScore}</b>${techTick}<br>
- Content Quality: <b>${contentScore}</b>${contentTick}<br><br>
A full report with actionable recommendations is available at no cost, should your team wish to review it.<br><br>
Best regards,<br>
<b>Mahadevan</b><br>
Devndespro – Web Development &amp; SEO<br>
<a href="https://www.devndespro.com">www.devndespro.com</a> | hello@devndespro.com`
  }

  // casual english
  return `Hi,<br><br>
I've run a technical SEO audit of <b>${url}</b> and wanted to share some findings.<br><br>
<b>Summary:</b><br>
- Overall health score: <b>${score}/100</b><br>
- Critical issues: <b>${critical}</b><br>
- Warnings: <b>${warnings}</b><br>
- Technical SEO &amp; Security: <b>${techScore}</b>${techTick}<br>
- Content Quality: <b>${contentScore}</b>${contentTick}<br><br>
The critical issues directly affect how Google crawls and ranks the site.<br><br>
Analysis done using my own SEO tool (<a href="https://seo.devndespro.com">seo.devndespro.com</a>).<br><br>
I have a full report ready with concrete suggestions, available for free if you're interested.<br><br>
Best regards,<br>
<b>Mahadevan</b><br>
Devndespro – Web Development &amp; SEO<br>
<a href="https://www.devndespro.com">www.devndespro.com</a><br>
<a href="https://seo.devndespro.com">seo.devndespro.com</a>`
}

function EmptyAudit({ onRun, running, error }) {
  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 2rem' }}>Site Audit</h1>
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
        padding: '4rem 2rem', textAlign: 'center', maxWidth: 480, margin: '0 auto',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, color: '#E5E7EB' }}>
          <FontAwesomeIcon icon={faMagnifyingGlassChart} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>No audit run yet</h2>
        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, margin: '0 0 24px' }}>
          Run a full site audit to get a real-time health check - title tags, meta descriptions,
          H1s, canonicals, structured data, Core Web Vitals, and more.
        </p>
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16,
          }}>{error}</div>
        )}
        <Button variant="primary" onClick={onRun} disabled={running}>
          <FontAwesomeIcon icon={running ? faArrowsRotate : faPlay}
            style={{ marginRight: 8, animation: running ? 'spin 1s linear infinite' : 'none' }} />
          {running ? 'Scanning your site...' : 'Run First Audit'}
        </Button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function TabBar({ tabs, active, onChange }) {
  const tabIcon = { errors: faCircleXmark, warnings: faTriangleExclamation, passed: faCircleCheck }
  const tabColor = { errors: '#DC2626', warnings: '#D97706', passed: '#16A34A' }
  const tabBg    = { errors: '#FEF2F2', warnings: '#FFFBEB', passed: '#F0FDF4' }
  const scrollRef = useRef(null)

  const scrollTabs = (dir) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({
      left: dir === 'right' ? 180 : -180,
      behavior: 'smooth'
    })
  }

  return (
    <div style={{ position: 'relative', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        onClick={() => scrollTabs('left')}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid #E5E7EB',
          background: '#fff',
          color: '#6B7280',
          cursor: 'pointer',
          flexShrink: 0
        }}
      ><FontAwesomeIcon icon={faChevronLeft} /></button>

      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollBehavior: 'smooth',
          flex: 1,
          paddingBottom: 4
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const color = tabColor[tab.id]
          const bg = tabBg[tab.id]

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 14px',
                borderRadius: 20,
                border: isActive ? '1.5px solid ' + (color || '#F97316') : '1.5px solid #E5E7EB',
                background: isActive ? (bg || '#FFF4ED') : '#fff',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? (color || '#F97316') : '#6B7280',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap'
              }}
            >
              {tabIcon[tab.id] && (
                <FontAwesomeIcon icon={tabIcon[tab.id]} style={{ fontSize: 11, color }} />
              )}
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  background: isActive ? (color || '#F97316') : '#E5E7EB',
                  color: isActive ? '#fff' : '#6B7280',
                  borderRadius: 10,
                  padding: '1px 6px',
                  fontSize: 10,
                  fontWeight: 700
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => scrollTabs('right')}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid #E5E7EB',
          background: '#fff',
          color: '#6B7280',
          cursor: 'pointer',
          flexShrink: 0
        }}
      ><FontAwesomeIcon icon={faChevronRight} /></button>
    </div>
  )
}

function IssueSparkline({ checkId, history }) {
  const points = (history || []).map(h => {
    const found = (h.issueSummary || []).find(i => i.check === checkId)
    return found ? found.count : 0
  })
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const w = 60, h = 20
  const stepX = w / (points.length - 1)
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * stepX} ${h - (v / max) * h}`).join(' ')
  const trendUp = points[points.length - 1] > points[0]
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <path d={path} fill="none" stroke={trendUp ? '#DC2626' : '#16A34A'} strokeWidth="1.5" />
    </svg>
  )
}

export default function SiteAudit() {
  const showSnackbar = useSnackbar()
  const { siteId }   = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const [showEmailModal,    setShowEmailModal]    = useState(false)
  const [auditData,         setAuditData]         = useState(null)
  const [cronEnabled,       setCronEnabled]       = useState(false)
  const toggleCron = async (val) => {
    setCronEnabled(val)
    await api.patch('/sites/' + siteId + '/ai-cron', { enabled: val }).catch(() => {})
  }
  const [loading,           setLoading]           = useState(true)
  const [running,           setRunning]           = useState(false)
  const [runError,          setRunError]          = useState(null)
  const [activeTab,         setActiveTab]         = useState('all')
  const [expandedIdx,       setExpandedIdx]       = useState(null)
  const [siteName,          setSiteName]          = useState('')
  const [siteUrl,           setSiteUrl]           = useState('')
  const [exporting,         setExporting]         = useState(false)
  const [shareMsg,          setShareMsg]          = useState('')
  const [emailSubject,      setEmailSubject]      = useState('Your SEO Audit Summary')
  const [emailMessage,      setEmailMessage]      = useState('')
  const [emailLang,         setEmailLang]         = useState('no')
  const [emailTone,         setEmailTone]         = useState('casual')
  const [includeFullReport, setIncludeFullReport] = useState(false)
  const [sendingEmail,      setSendingEmail]      = useState(false)
  const [recipientEmail,    setRecipientEmail]    = useState('')
  const [loadingRecipient,  setLoadingRecipient]  = useState(false)
  const captureRef = useRef(null)
  const emailBodyRef = useRef(null)
  const isProgrammatic = useRef(false)
  const issuesRef = useRef(null)
  const [logoAlign, setLogoAlign] = useState('center')
  const [authorityScore, setAuthorityScore] = useState(null)
  const [authorityUpdatedAt, setAuthorityUpdatedAt] = useState(null)
  const [refreshingAuthority, setRefreshingAuthority] = useState(false)
  const [showAuditMenu, setShowAuditMenu] = useState(false)
  const [multipageStatus, setMultipageStatus] = useState(null)
  const [multipageProgress, setMultipageProgress] = useState(null)
  const [multipageResults, setMultipageResults] = useState(null)
  const [multipageLatestPages, setMultipageLatestPages] = useState([])
  const [multipageBuckets, setMultipageBuckets] = useState(null)
  const [showDupTitles, setShowDupTitles] = useState(false)
  const [showDupMeta, setShowDupMeta] = useState(false)
  const [issueHistory, setIssueHistory] = useState([])
  const [expandedIssueKey, setExpandedIssueKey] = useState(null)
  const [issueFixes, setIssueFixes] = useState({})
  const [loadingFixKey, setLoadingFixKey] = useState(null)

  const isBotBlocked = useMemo(() => {
    if (!auditData?.crawl) return false
    const { wordCount, statusCode } = auditData.crawl
    return Number(wordCount || 0) === 0 && Number(statusCode || 0) !== 200
  }, [auditData])

  useEffect(() => {
    Promise.all([
      api.get(`/sites/${siteId}/audit/latest`).catch(() => null),
      api.get(`/sites/${siteId}`).catch(() => null),
      api.get(`/sites/${siteId}/audit/multipage-latest`).catch(() => null),
      api.get(`/sites/${siteId}/audit/multipage-history`).catch(() => null),
    ]).then(([auditRes, siteRes, multipageRes, historyRes]) => {
      if (auditRes?.data) setAuditData(auditRes.data)
      if (siteRes?.data?.name) setSiteName(siteRes.data.name)
      if (siteRes?.data?.url)  setSiteUrl(siteRes.data.url)
      else if (auditRes?.data?.url) setSiteUrl(auditRes.data.url)
      if (siteRes?.data?.authority_score !== undefined) setAuthorityScore(siteRes.data.authority_score)
      if (siteRes?.data?.authority_updated_at) setAuthorityUpdatedAt(siteRes.data.authority_updated_at)
      if (multipageRes?.data && multipageRes.data.status === 'complete' && multipageRes.data.results) {
        setMultipageResults(multipageRes.data.results)
        setMultipageStatus('complete')
      }
      if (historyRes?.data?.history) setIssueHistory(historyRes.data.history)
    }).finally(() => setLoading(false))
  }, [siteId])

  const categories = useMemo(() => groupByCategory(auditData?.checks), [auditData])
  const allIssues  = useMemo(() =>
    sortByPriority((auditData?.checks || []).map((issue, i) => ({ ...issue, _idx: i }))),
    [auditData]
  )

  useEffect(() => {
    if (!auditData) return
    const html = getSummaryEmailText(emailLang, emailTone, auditData, allIssues)
    setEmailMessage(html)
    setEmailSubject(getSummarySubject(emailLang, siteUrl || auditData?.url))
    isProgrammatic.current = true
    if (emailBodyRef.current) emailBodyRef.current.innerHTML = html
    isProgrammatic.current = false
  }, [auditData, allIssues, emailLang, emailTone, showEmailModal])

  useEffect(() => {
    if (showEmailModal && siteId) {
      setLoadingRecipient(true)
      api.get(`/sites/${siteId}/cold-emails`)
        .then((res) => {
          const found = (res.data || []).find((e) => e.email && e.email.trim())
          setRecipientEmail(found?.email || '')
        })
        .catch(() => setRecipientEmail(''))
        .finally(() => setLoadingRecipient(false))
    }
  }, [showEmailModal, siteId])

  function toFileSafeSlug(value) {
    return String(value || '').toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  }

  function buildSnapshotFilename(date) {
    const fromUrl = (() => { try { return new URL(siteUrl || auditData?.url || '').hostname } catch { return '' } })()
    const slug = toFileSafeSlug(siteName) || toFileSafeSlug(fromUrl) || `site-${siteId}`
    return `site-audit-${slug}-${date}.png`
  }

  async function makeSnapshotBlob() {
    if (!captureRef.current) throw new Error('Capture area not found')
    const canvas = await html2canvas(captureRef.current, { scale: 2, useCORS: true, backgroundColor: '#F3F4F6', logging: false })
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Could not create screenshot blob'))
        resolve(blob)
      }, 'image/png')
    })
  }

  async function downloadSnapshot() {
    setExporting(true); setShareMsg('')
    try {
      const blob = await makeSnapshotBlob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = blobUrl; a.download = buildSnapshotFilename(date)
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      setShareMsg('Screenshot downloaded')
    } catch { setShareMsg('Could not capture screenshot') }
    setExporting(false)
  }

  async function shareSnapshot() {
    setExporting(true); setShareMsg('')
    try {
      const blob = await makeSnapshotBlob()
      const date = new Date().toISOString().slice(0, 10)
      const file = new File([blob], buildSnapshotFilename(date), { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Site Audit Report', text: 'Site audit snapshot', files: [file] })
        setShareMsg('Shared successfully')
      } else {
        await downloadSnapshot()
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(window.location.href)
          setShareMsg('Screenshot downloaded. Link copied for sharing')
        } else {
          setShareMsg('Screenshot downloaded. Attach it in email/WhatsApp/Teams')
        }
      }
    } catch { setShareMsg('Share cancelled or failed') }
    setExporting(false)
  }

  async function runAudit() {
    setRunning(true); setRunError(null)
    try {
      const r = await api.post(`/sites/${siteId}/audit/run`)
      setAuditData(r.data); setActiveTab('all'); setExpandedIdx(null)
      showSnackbar('Audit completed successfully!', 'success')
    } catch (e) {
      setRunError(e.response?.data?.error || 'Audit failed - check the site URL is accessible')
    }
    setRunning(false)
  }

  async function runMultipageAudit() {
    setMultipageStatus('running')
    setMultipageProgress({ pagesCrawled: 0, pagesTotal: 0 })
    setMultipageResults(null)
    try {
      const start = await api.post(`/sites/${siteId}/audit/run-multipage`)
      const auditRunId = start.data.auditRunId
      const poll = async () => {
        try {
          const p = await api.get(`/sites/${siteId}/audit/multipage-progress/${auditRunId}`)
          setMultipageProgress({ pagesCrawled: p.data.pagesCrawled, pagesTotal: p.data.pagesTotal })
          setMultipageLatestPages(p.data.latestPages || [])
          setMultipageBuckets(p.data.statusBuckets || null)
          if (p.data.status === 'complete') {
            setMultipageStatus('complete')
            setMultipageResults(p.data.results)
            showSnackbar('Full site audit completed!', 'success')
            api.get(`/sites/${siteId}/audit/multipage-history`).then(h => { if (h?.data?.history) setIssueHistory(h.data.history) }).catch(() => {})
          } else if (p.data.status === 'failed') {
            setMultipageStatus('failed')
            showSnackbar('Full site audit failed', 'error')
          } else {
            setTimeout(poll, 2000)
          }
        } catch (e) {
          setMultipageStatus('failed')
          showSnackbar('Lost connection while checking audit progress', 'error')
        }
      }
      poll()
    } catch (e) {
      setMultipageStatus('failed')
      showSnackbar('Failed to start full site audit', 'error')
    }
  }

  async function fetchIssueFix(issue) {
    const key = issue.check
    if (issueFixes[key]) {
      setExpandedIssueKey(expandedIssueKey === key ? null : key)
      return
    }
    setLoadingFixKey(key)
    setExpandedIssueKey(key)
    try {
      const r = await api.post(`/sites/${siteId}/audit/ai-fix`, {
        issue: { message: issue.sampleMessage, category: issue.category, impact: issue.impact, status: issue.status },
        siteUrl: siteUrl || auditData?.url,
      })
      setIssueFixes(prev => ({ ...prev, [key]: r.data }))
    } catch (e) {
      setIssueFixes(prev => ({ ...prev, [key]: { fix: 'Could not generate fix suggestion. Please try again.' } }))
    }
    setLoadingFixKey(null)
  }

  async function refreshAuthorityScore() {
    setRefreshingAuthority(true)
    try {
      const r = await api.post(`/sites/${siteId}/authority-score`)
      setAuthorityScore(r.data.authority_score)
      setAuthorityUpdatedAt(r.data.authority_updated_at)
      showSnackbar('Authority score updated!', 'success')
    } catch (e) {
      showSnackbar('Failed to update authority score', 'error')
    }
    setRefreshingAuthority(false)
  }

  async function sendSummaryEmail() {
    setSendingEmail(true)
    try {
      await api.post('/admin-email/send-summary', {
        siteId: Number(siteId),
        subject: emailSubject,
        message: emailMessage,
        includeFullReport,
        overrideEmail: recipientEmail && recipientEmail.trim() ? recipientEmail.trim() : undefined,
      })
      setShowEmailModal(false)
      showSnackbar('Summary email sent successfully!', 'success')
    } catch (e) {
      showSnackbar('Failed to send: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setSendingEmail(false)
  }

  function scrollToCategory(categoryId) {
    setActiveTab(categoryId)
    setExpandedIdx(null)
    requestAnimationFrame(() => {
      issuesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const tabOptions = useMemo(() => [
    { id: 'all',      label: 'All Issues', count: allIssues.filter((i) => i.status !== 'pass').length },
    { id: 'errors',   label: 'Critical',   count: allIssues.filter((i) => i.status === 'error').length },
    { id: 'warnings', label: 'Warnings',   count: allIssues.filter((i) => i.status === 'warning').length },
    { id: 'passed',   label: 'Passed',     count: allIssues.filter((i) => i.status === 'pass').length },
    ...categories.map((c) => ({ id: c.id, label: c.name, count: c.issues.filter((i) => i.status !== 'pass').length })),
  ], [allIssues, categories])

  const visibleIssues = useMemo(() => {
    if (activeTab === 'all')      return allIssues
    if (activeTab === 'errors')   return allIssues.filter((i) => i.status === 'error')
    if (activeTab === 'warnings') return allIssues.filter((i) => i.status === 'warning')
    if (activeTab === 'passed')   return allIssues.filter((i) => i.status === 'pass')
    return allIssues.filter((i) => (i.category || 'On-Page SEO').toLowerCase().replace(/\s+/g, '_') === activeTab)
  }, [allIssues, activeTab])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9CA3AF', fontSize: 14 }}>
        <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 10, opacity: 0.4 }} />
        Loading audit data...
      </div>
    )
  }

  if (!auditData) {
    return <EmptyAudit onRun={runAudit} running={running} error={runError} />
  }

  const scannedDate = auditData.scannedAt
    ? new Date(auditData.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown'
  const crawl    = auditData.crawl || null
  const fmtMs    = (n) => (Number.isFinite(Number(n)) ? `${Math.round(Number(n))} ms` : '-')
  const fmtBytes = (n) => {
    const b = Number(n)
    if (!Number.isFinite(b) || b <= 0) return '-'
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`
    return `${(b / 1024).toFixed(2)} KB`
  }

  return (
    <div ref={captureRef} style={{ padding: 'clamp(1rem, 4vw, 1.5rem) clamp(0.75rem, 4vw, 2rem)' }}>

      {/* Page header */}
      <div className='audit-page-header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Site Audit</h1>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FontAwesomeIcon icon={faClock} />
            Last scanned: {scannedDate}
            {auditData.url && (
              <a href={auditData.url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#3B82F6', textDecoration: 'none', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <FontAwesomeIcon icon={faExternalLink} style={{ fontSize: 10 }} />
                {auditData.url}
              </a>
            )}
          </div>
        </div>
        <div className='audit-header-btns' style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={downloadSnapshot} disabled={exporting}>
            <FontAwesomeIcon icon={faCamera} style={{ marginRight: 6 }} /><span className='btn-label'>{exporting ? 'Capturing...' : 'Download Screenshot'}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={shareSnapshot} disabled={exporting}>
            <FontAwesomeIcon icon={faShareNodes} style={{ marginRight: 6 }} /><span className='btn-label'>Share</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/actions`)}>
            <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: 6 }} /><span className='btn-label'>Fix in Actions</span>
          </Button>
          <Button variant="primary" size="sm" onClick={runAudit} disabled={running || exporting || multipageStatus === 'running'}>
            <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6, animation: running ? 'spin 1s linear infinite' : 'none' }} /><span className='btn-label'>{running ? 'Scanning...' : 'Re-run Audit'}</span>
          </Button>
          <div style={{ position: 'relative' }}>
            <Button variant="primary" size="sm" onClick={() => setShowAuditMenu(v => !v)} disabled={running || exporting || multipageStatus === 'running'}>
              <FontAwesomeIcon icon={faChevronDown} />
            </Button>
            {showAuditMenu && (
              <>
                <div onClick={() => setShowAuditMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 240, zIndex: 40, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setShowAuditMenu(false); runAudit() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Quick Audit</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Homepage only - a few seconds</div>
                  </button>
                  <button
                    onClick={() => { setShowAuditMenu(false); runMultipageAudit() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Full Site Audit <span style={{ fontSize: 10, color: '#F97316', fontWeight: 700 }}>BETA</span></div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Up to 100 pages - a few minutes</div>
                  </button>
                </div>
              </>
            )}
          </div>
          {!!shareMsg && (
            <div style={{ width: '100%', textAlign: 'right', fontSize: 11, color: '#6B7280' }}>{shareMsg}</div>
          )}
        </div>
      </div>

      {runError && (
        <div style={{
          background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: '1rem',
        }}>{runError}</div>
      )}

      {isBotBlocked && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '12px 16px', marginBottom: '1rem',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              Site appears to be behind bot protection or a CAPTCHA wall
            </div>
            <div style={{ fontSize: 12, color: '#92400E', marginTop: 3, lineHeight: 1.6 }}>
              The crawler received no content (0 words, status {auditData.crawl?.statusCode}).
              Audit scores may be inaccurate. The site owner should check if their host is blocking automated crawlers.
            </div>
          </div>
        </div>
      )}

      {multipageStatus === 'running' && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
          padding: '12px 16px', marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FontAwesomeIcon icon={faArrowsRotate} style={{ color: '#2563EB', animation: 'spin 1s linear infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>
                Running full site audit{multipageProgress?.pagesTotal ? ` (${multipageProgress.pagesCrawled}/${multipageProgress.pagesTotal} pages)` : ' (discovering pages...)'}
              </div>
              {multipageProgress?.pagesTotal > 0 && (
                <div style={{ background: '#DBEAFE', borderRadius: 4, height: 6, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((multipageProgress.pagesCrawled / multipageProgress.pagesTotal) * 100)}%`,
                    height: '100%', background: '#2563EB', transition: 'width 0.3s',
                  }} />
                </div>
              )}
            </div>
          </div>

          {multipageBuckets && (multipageBuckets.c2xx + multipageBuckets.c3xx + multipageBuckets.c4xx + multipageBuckets.c5xx + multipageBuckets.cerror) > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                {['c2xx', 'c3xx', 'c4xx', 'c5xx', 'cerror'].map((key) => {
                  const total = multipageBuckets.c2xx + multipageBuckets.c3xx + multipageBuckets.c4xx + multipageBuckets.c5xx + multipageBuckets.cerror
                  const val = multipageBuckets[key]
                  if (!val) return null
                  const colors = { c2xx: '#16A34A', c3xx: '#D97706', c4xx: '#DC2626', c5xx: '#991B1B', cerror: '#6B7280' }
                  return <div key={key} style={{ width: `${(val / total) * 100}%`, background: colors[key] }} />
                })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#6B7280', flexWrap: 'wrap' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16A34A', marginRight: 4 }} />2xx: {multipageBuckets.c2xx}</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#D97706', marginRight: 4 }} />3xx: {multipageBuckets.c3xx}</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#DC2626', marginRight: 4 }} />4xx: {multipageBuckets.c4xx}</span>
                {multipageBuckets.c5xx > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#991B1B', marginRight: 4 }} />5xx: {multipageBuckets.c5xx}</span>}
                {multipageBuckets.cerror > 0 && <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#6B7280', marginRight: 4 }} />Failed: {multipageBuckets.cerror}</span>}
              </div>
            </div>
          )}

          {multipageLatestPages.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                Latest URLs Crawled
              </div>
              <div style={{ border: '1px solid #DBEAFE', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Time</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>URL</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Errors</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multipageLatestPages.map((p, i) => (
                      <tr key={p.url + i} style={{ borderTop: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '6px 10px', color: '#9CA3AF' }}>{new Date(p.crawled_at).toLocaleTimeString()}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{
                            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: p.status_code >= 200 && p.status_code < 300 ? '#F0FDF4' : p.status_code >= 400 ? '#FEF2F2' : '#FFFBEB',
                            color: p.status_code >= 200 && p.status_code < 300 ? '#16A34A' : p.status_code >= 400 ? '#DC2626' : '#D97706',
                          }}>{p.status_code || 'Err'}</span>
                        </td>
                        <td style={{ padding: '6px 10px', color: '#2563EB', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.url}</td>
                        <td style={{ padding: '6px 10px', color: p.error_count > 0 ? '#DC2626' : '#9CA3AF' }}>{p.error_count}</td>
                        <td style={{ padding: '6px 10px', color: p.warning_count > 0 ? '#D97706' : '#9CA3AF' }}>{p.warning_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {multipageStatus === 'complete' && multipageResults && (
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '16px 18px', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Full Site Audit Results (Beta) - {multipageResults.pagesTotal} pages crawled
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{
                fontSize: 30, fontWeight: 800,
                color: multipageResults.siteHealthPct >= 80 ? '#16A34A' : multipageResults.siteHealthPct >= 55 ? '#D97706' : '#DC2626',
              }}>
                {multipageResults.siteHealthPct}%
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF' }}>Site Health</div>
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
              <div>{multipageResults.totalErrors ?? 0} total error(s) across all pages</div>
              <div>{multipageResults.totalWarnings ?? 0} total warning(s) across all pages</div>
              <div>{multipageResults.healthyCount} healthy page(s)</div>
              <div>{multipageResults.brokenCount} broken page(s)</div>
              <div>{multipageResults.duplicateTitles?.length || 0} duplicate title group(s)</div>
              <div>{multipageResults.duplicateMetaDescriptions?.length || 0} duplicate meta description group(s)</div>
            </div>
          </div>

          {multipageResults.duplicateTitles?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowDupTitles(v => !v)}
                style={{ fontSize: 12, fontWeight: 600, color: '#F97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
              >
                <FontAwesomeIcon icon={showDupTitles ? faChevronDown : faChevronRight} style={{ fontSize: 10 }} />
                {showDupTitles ? 'Hide' : 'View'} duplicate title groups ({multipageResults.duplicateTitles.length})
              </button>
              {showDupTitles && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {multipageResults.duplicateTitles.map((g, i) => (
                    <div key={i} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>&quot;{g.title}&quot; ({g.pages.length} pages)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.pages.map((url, j) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none' }}>{url}</a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {multipageResults.duplicateMetaDescriptions?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowDupMeta(v => !v)}
                style={{ fontSize: 12, fontWeight: 600, color: '#F97316', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
              >
                <FontAwesomeIcon icon={showDupMeta ? faChevronDown : faChevronRight} style={{ fontSize: 10 }} />
                {showDupMeta ? 'Hide' : 'View'} duplicate meta description groups ({multipageResults.duplicateMetaDescriptions.length})
              </button>
              {showDupMeta && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {multipageResults.duplicateMetaDescriptions.map((g, i) => (
                    <div key={i} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 4 }}>&quot;{g.metaDescription}&quot; ({g.pages.length} pages)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {g.pages.map((url, j) => (
                          <a key={j} href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#2563EB', textDecoration: 'none' }}>{url}</a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {multipageResults.issueSummary?.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                Top Issues Across All Pages
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {multipageResults.issueSummary.slice(0, 15).map((issue) => {
                  const key = issue.check
                  const isExpanded = expandedIssueKey === key
                  const fix = issueFixes[key]
                  const isLoadingFix = loadingFixKey === key
                  return (
                    <div key={key} style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fff' }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: issue.status === 'error' ? '#DC2626' : '#D97706',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                            {issue.count} page{issue.count === 1 ? '' : 's'} - {issue.sampleMessage}
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{issue.category}</div>
                        </div>
                        <IssueSparkline checkId={key} history={issueHistory} />
                        <button
                          onClick={() => fetchIssueFix(issue)}
                          style={{
                            fontSize: 11, fontWeight: 600, color: '#F97316', background: '#FFF7ED',
                            border: '1px solid #FED7AA', borderRadius: 6, padding: '5px 10px',
                            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
                          }}
                        >
                          {isLoadingFix ? 'Loading...' : 'How to fix'}
                        </button>
                      </div>
                      {isExpanded && fix && (
                        <div style={{ padding: '12px 14px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                          {fix.why && <div style={{ marginBottom: 8 }}><strong>Why it matters:</strong> {fix.why}</div>}
                          {fix.fix && <div style={{ marginBottom: 8 }}><strong>Fix:</strong> {fix.fix}</div>}
                          {fix.before && <div style={{ marginBottom: 4 }}><strong>Before:</strong> <code style={{ background: '#FEF2F2', padding: '1px 5px', borderRadius: 4 }}>{fix.before}</code></div>}
                          {fix.after && <div style={{ marginBottom: 8 }}><strong>After:</strong> <code style={{ background: '#F0FDF4', padding: '1px 5px', borderRadius: 4 }}>{fix.after}</code></div>}
                          {fix.timeToFix && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Estimated time: {fix.timeToFix}</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <AuditScoreBanner auditData={auditData} categories={categories} aiScores={{ chatgpt: auditData?.chatgptScore, claude: auditData?.claudeScore }} cronEnabled={cronEnabled} onCronToggle={toggleCron} authorityScore={authorityScore} onCategoryClick={scrollToCategory} />
      <AuditSpeedPanel speed={auditData.speed} />

      {crawl && (
        <div>
          <button
            onClick={() => setShowEmailModal(true)}
            style={{
              marginBottom: 12, marginTop: 12, display: 'inline-flex', alignItems: 'center',
              gap: 8, padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#F97316', color: '#fff', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <FontAwesomeIcon icon={faEnvelope} />
            Send summary email
          </button>

          <Modal
            open={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            title="Send Audit Summary Email"
            width={480}
            footer={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" onClick={() => setShowEmailModal(false)}>Cancel</Button>
                <Button variant="primary" loading={sendingEmail} onClick={sendSummaryEmail}>Send Email</Button>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                Project: <span style={{ fontWeight: 400 }}>{siteName || siteUrl || `Site #${siteId}`}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                Recipient Email(s):
                {loadingRecipient ? (
                  <span style={{ fontWeight: 400, marginLeft: 8, color: '#6B7280' }}>Loading...</span>
                ) : (
                  <>
                    <Input style={{ marginLeft: 8, width: '100%' }} value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)} placeholder="e.g. info@site.com, owner@site.com" label="" />
                    <div style={{ fontSize: 11, fontWeight: 400, color: '#6B7280', marginTop: 4 }}>
                      Separate multiple addresses with a comma
                    </div>
                  </>
                )}
              </div>
              <Input label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />

              {/* Language + Tone selectors */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Language:</label>
                  <Button variant={emailLang === 'en' ? 'primary' : 'ghost'} size="sm"
                    onClick={() => setEmailLang('en')} style={{ minWidth: 72 }}>English</Button>
                  <Button variant={emailLang === 'no' ? 'primary' : 'ghost'} size="sm"
                    onClick={() => setEmailLang('no')} style={{ minWidth: 72 }}>Norsk</Button>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ fontWeight: 600, fontSize: 13 }}>Tone:</label>
                  <Button variant={emailTone === 'casual' ? 'primary' : 'ghost'} size="sm"
                    onClick={() => setEmailTone('casual')} style={{ minWidth: 72 }}>Casual</Button>
                  <Button variant={emailTone === 'formal' ? 'primary' : 'ghost'} size="sm"
                    onClick={() => setEmailTone('formal')} style={{ minWidth: 72 }}>Formal</Button>
                </div>
              </div>

              {/* Tone hint */}
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: -8 }}>
                {emailTone === 'formal'
                  ? '?? Formal - suited for corporate and enterprise prospects'
                  : '?? Casual - suited for SMB and local businesses'}
              </div>

              {/* Logo alignment controls */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Logo:</span>
                {[
                  { id: 'left',   icon: faAlignLeft   },
                  { id: 'center', icon: faAlignCenter  },
                  { id: 'right',  icon: faAlignRight   },
                ].map(({ id, icon }) => (
                  <button key={id} onClick={() => setLogoAlign(id)} title={id} style={{
                    padding: '5px 10px', borderRadius: 5, border: '1px solid #E5E7EB', fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit',
                    background: logoAlign === id ? '#F97316' : '#fff',
                    color: logoAlign === id ? '#fff' : '#6B7280',
                  }}>
                    <FontAwesomeIcon icon={icon} />
                  </button>
                ))}
              </div>
              <div style={{
                border: '1px solid #E5E7EB', borderRadius: 6,
                minHeight: 120, maxHeight: 220, background: '#fff',
                marginBottom: 10, overflowY: 'auto', fontSize: 15, lineHeight: 1.6,
                boxShadow: '0 2px 8px rgba(30,27,46,0.06)',
              }}>
                <div style={{ textAlign: logoAlign, padding: '12px 8px 8px', borderBottom: '1px solid #F3F4F6' }}>
                  <img src='/images/devndespro_seo.png' alt='Devndespro SEO' style={{ height: 60 }} />
                </div>
                <div
                  ref={emailBodyRef}
                  style={{ padding: '10px 12px' }}
                  contentEditable suppressContentEditableWarning
                  onInput={(e) => { if (!isProgrammatic.current) setEmailMessage(e.currentTarget.innerHTML) }}
                />
              </div>
              <label style={{ fontSize: 14, fontWeight: 500, marginTop: 6 }}>
                <input type="checkbox" checked={includeFullReport}
                  onChange={(e) => setIncludeFullReport(e.target.checked)} style={{ marginRight: 6 }} />
                Include full audit report
              </label>
            </div>
          </Modal>

          {/* Authority Score */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1rem',
            padding: 'clamp(10px, 3vw, 14px) clamp(10px, 3vw, 16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                Authority Score
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>
                {authorityScore ?? '-'}<span style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF' }}>/100</span>
              </div>
              {authorityUpdatedAt && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  Updated: {new Date(authorityUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={refreshAuthorityScore} disabled={refreshingAuthority}>
              <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6, animation: refreshingAuthority ? 'spin 1s linear infinite' : 'none' }} />
              <span className='btn-label'>{refreshingAuthority ? 'Calculating...' : 'Refresh Score'}</span>
            </Button>
          </div>

          {/* Crawl snapshot */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1rem', padding: '12px 14px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Crawl Snapshot
            </div>
            <div className='crawl-snapshot-grid' style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Status code',    value: crawl.statusCode || '-' },
                { label: 'Response time',  value: fmtMs(crawl.responseTimeMs) },
                { label: 'File size',      value: fmtBytes(crawl.fileSizeBytes) },
                { label: 'Language',       value: crawl.language || '-' },
                { label: 'Word count',     value: Number(crawl.wordCount || 0).toLocaleString() },
                { label: 'Internal links', value: Number(crawl.internalLinks || 0).toLocaleString() },
                { label: 'External links', value: Number(crawl.externalLinks || 0).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{value}</div>
                </div>
              ))}
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Final URL</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#2563EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={crawl.finalUrl || ''}>
                  {crawl.finalUrl || '-'}
                </div>
              </div>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>robots.txt</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: crawl.robots?.valid ? '#16A34A' : '#B45309' }}>
                  {crawl.robots?.valid ? 'Valid' : 'Needs Fix'}
                </div>
              </div>
            </div>
            {!crawl.robots?.valid && Array.isArray(crawl.robots?.issues) && crawl.robots.issues.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' }}>
                robots.txt issue: {crawl.robots.issues[0].message}
                {Number(crawl.robots.issues[0].line) > 0 ? ` (line ${crawl.robots.issues[0].line})` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      <TabBar tabs={tabOptions} active={activeTab} onChange={(id) => { setActiveTab(id); setExpandedIdx(null) }} />

      <div ref={issuesRef} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {visibleIssues.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            No issues in this category.
          </div>
        ) : visibleIssues.map((issue) => (
          <AuditIssueRow
            key={issue._idx}
            issue={issue}
            siteId={siteId}
            siteUrl={siteUrl || auditData.url}
            expanded={expandedIdx === issue._idx}
            onToggle={() => setExpandedIdx(expandedIdx === issue._idx ? null : issue._idx)}
          />
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}


