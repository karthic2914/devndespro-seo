import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faArrowsRotate, faPlay, faClock, faExternalLink, faPenToSquare,
  faMagnifyingGlassChart, faCircleXmark, faTriangleExclamation, faCircleCheck,
  faCamera, faShareNodes, faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import html2canvas from 'html2canvas'
import { Button, Modal, Input } from '../components/UI'
import { useSnackbar } from '../App'
import { useAuth } from '../hooks/useAuth'
import api from '../utils/api'
import AuditScoreBanner from '../components/audit/AuditScoreBanner'
import AuditIssueRow from '../components/audit/AuditIssueRow'
import AuditSpeedPanel from '../components/audit/AuditSpeedPanel'

const CAT_ORDER = ['On-Page SEO', 'Technical SEO', 'Content Quality', 'Page Speed', 'Server & Security', 'Advanced SEO']

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

function getSummaryEmailText(lang, auditData, allIssues) {
  const score    = auditData?.score ?? '—'
  const critical = (allIssues || []).filter((i) => i.status === 'error').length
  const warnings = (allIssues || []).filter((i) => i.status === 'warning').length
  const url      = auditData?.url || 'nettstedet'

  // Find category scores
  let techScore = null, contentScore = null;
  if (Array.isArray(auditData?.checks)) {
    // Group by category and calculate scores
    const grouped = groupByCategory(auditData.checks);
    for (const cat of grouped) {
      if (cat.name.toLowerCase().includes('technical seo') || cat.name.toLowerCase().includes('sikkerhet') || cat.name.toLowerCase().includes('security')) {
        techScore = cat.score;
      }
      if (cat.name.toLowerCase().includes('content quality')) {
        contentScore = cat.score;
      }
    }
  }
  // Fallback to dash if not found
  techScore = techScore ?? '—';
  contentScore = contentScore ?? '—';
  const techTick = techScore === 100 ? ' &#10003;' : '';
  const contentTick = contentScore === 100 ? ' &#10003;' : '';

  if (lang === 'no') {
    return `Hei,<br><br>
Jeg har kjort en teknisk SEO-analyse av <b>${url}</b> og ville dele noen av funnene med dere.<br><br>
<b>Kort oppsummert:</b><br>
- Total helsescore: <b>${score}/100</b><br>
- Kritiske problemer: <b>${critical}</b><br>
- Advarsler: <b>${warnings}</b><br>
- Teknisk SEO &amp; sikkerhet: <b>${techScore}</b>${techTick}<br>
- Content Quality: <b>${contentScore}</b>${contentTick}<br><br>
De kritiske problemene pavirker direkte hvordan Google crawler og rangerer siden.<br><br>
Analysen er gjort via mitt eget SEO-verktoy (<a href="https://seo.devndespro.com">seo.devndespro.com</a>), som jeg bruker til a hjelpe norske bedrifter med a forbedre synligheten sin pa nett.<br><br>
Jeg har en fullstendig rapport klar med konkrete forslag til utbedring - gjerne gratis tilgjengelig for dere hvis det er av interesse.<br><br>
Med vennlig hilsen<br>
Mahadevan<br>
Devndespro - Webutvikling &amp; SEO<br>
<a href="https://www.devndespro.com">www.devndespro.com</a><br>
<a href="https://seo.devndespro.com">seo.devndespro.com</a>`
  }

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
Mahadevan<br>
Devndespro - Web Development &amp; SEO<br>
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
          Run a full site audit to get a real-time health check — title tags, meta descriptions,
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
  const tabIconColor = { errors: '#DC2626', warnings: '#D97706', passed: '#16A34A' }
  return (
    <div style={{
      display: 'flex', gap: 2, marginBottom: '1rem',
      background: '#F9FAFB', padding: 4, borderRadius: 10,
      border: '1px solid #E5E7EB', width: 'fit-content', flexWrap: 'wrap',
    }}>
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          background: active === tab.id ? '#fff' : 'transparent',
          border: 'none', padding: '6px 14px', borderRadius: 7, fontSize: 12,
          fontWeight: active === tab.id ? 600 : 400,
          color: active === tab.id ? '#111827' : '#6B7280',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: active === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.15s',
        }}>
          {tabIcon[tab.id] && (
            <FontAwesomeIcon icon={tabIcon[tab.id]} style={{ marginRight: 6, color: tabIconColor[tab.id] }} />
          )}
          {tab.label}
          {tab.count > 0 && (
            <span style={{
              marginLeft: 6, background: active === tab.id ? '#F3F4F6' : '#E5E7EB',
              borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700, color: '#6B7280',
            }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default function SiteAudit() {
  const showSnackbar = useSnackbar()
  const { siteId }   = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const [showEmailModal,    setShowEmailModal]    = useState(false)
  const [auditData,         setAuditData]         = useState(null)
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
  const [includeFullReport, setIncludeFullReport] = useState(false)
  const [sendingEmail,      setSendingEmail]      = useState(false)
  const [recipientEmail,    setRecipientEmail]    = useState('')
  const [loadingRecipient,  setLoadingRecipient]  = useState(false)
  const captureRef = useRef(null)

  // Bot-protection / low-content warning
  const isBotBlocked = useMemo(() => {
    if (!auditData?.crawl) return false
    const { wordCount, statusCode } = auditData.crawl
    return Number(wordCount || 0) === 0 && Number(statusCode || 0) !== 200
  }, [auditData])

  useEffect(() => {
    Promise.all([
      api.get(`/sites/${siteId}/audit/latest`).catch(() => null),
      // Fetch single site instead of all sites — avoids 400 errors and is more efficient
      api.get(`/sites/${siteId}`).catch(() => null),
    ]).then(([auditRes, siteRes]) => {
      if (auditRes?.data) setAuditData(auditRes.data)
      if (siteRes?.data?.name) setSiteName(siteRes.data.name)
      if (siteRes?.data?.url)  setSiteUrl(siteRes.data.url)
      // Fallback: pull URL from audit data if site fetch failed
      else if (auditRes?.data?.url) setSiteUrl(auditRes.data.url)
    }).finally(() => setLoading(false))
  }, [siteId])

  const categories = useMemo(() => groupByCategory(auditData?.checks), [auditData])
  const allIssues  = useMemo(() =>
    sortByPriority((auditData?.checks || []).map((issue, i) => ({ ...issue, _idx: i }))),
    [auditData]
  )

  useEffect(() => {
    if (!auditData) return
    setEmailMessage(getSummaryEmailText(emailLang, auditData, allIssues))
  }, [auditData, allIssues, emailLang, showEmailModal])

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
    } catch (e) {
      setRunError(e.response?.data?.error || 'Audit failed — check the site URL is accessible')
    }
    setRunning(false)
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
  const fmtMs    = (n) => (Number.isFinite(Number(n)) ? `${Math.round(Number(n))} ms` : '—')
  const fmtBytes = (n) => {
    const b = Number(n)
    if (!Number.isFinite(b) || b <= 0) return '—'
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`
    return `${(b / 1024).toFixed(2)} KB`
  }

  return (
    <div ref={captureRef} style={{ padding: '1.5rem 2rem' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={downloadSnapshot} disabled={exporting}>
            <FontAwesomeIcon icon={faCamera} style={{ marginRight: 6 }} />
            {exporting ? 'Capturing...' : 'Download Screenshot'}
          </Button>
          <Button variant="ghost" size="sm" onClick={shareSnapshot} disabled={exporting}>
            <FontAwesomeIcon icon={faShareNodes} style={{ marginRight: 6 }} />Share
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/actions`)}>
            <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: 6 }} />Fix in Actions
          </Button>
          <Button variant="primary" size="sm" onClick={runAudit} disabled={running || exporting}>
            <FontAwesomeIcon icon={faArrowsRotate}
              style={{ marginRight: 6, animation: running ? 'spin 1s linear infinite' : 'none' }} />
            {running ? 'Scanning...' : 'Re-run Audit'}
          </Button>
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

      {/* Bot-protection warning banner */}
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

      <AuditScoreBanner auditData={auditData} categories={categories} />
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
                Recipient Email:
                {loadingRecipient ? (
                  <span style={{ fontWeight: 400, marginLeft: 8, color: '#6B7280' }}>Loading...</span>
                ) : (
                  <Input style={{ marginLeft: 8, width: '100%' }} value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)} placeholder="No email found" label="" />
                )}
              </div>
              <Input label="Subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, justifyContent: 'flex-end' }}>
                <label style={{ fontWeight: 600, alignSelf: 'center' }}>Language:</label>
                <Button variant={emailLang === 'en' ? 'primary' : 'ghost'} size="sm"
                  onClick={() => setEmailLang('en')} style={{ minWidth: 80 }}>English</Button>
                <Button variant={emailLang === 'no' ? 'primary' : 'ghost'} size="sm"
                  onClick={() => setEmailLang('no')} style={{ minWidth: 80 }}>Norsk</Button>
              </div>
              <div
                style={{
                  border: '1px solid #E5E7EB', borderRadius: 6, padding: 8,
                  minHeight: 120, maxHeight: 220, background: '#fff',
                  marginBottom: 10, overflowY: 'auto', fontSize: 15, lineHeight: 1.6,
                  boxShadow: '0 2px 8px rgba(30,27,46,0.06)',
                }}
                contentEditable suppressContentEditableWarning
                onInput={(e) => setEmailMessage(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{
                  __html: `<div style='text-align:center;margin-bottom:16px;'><img src='/images/devndespro_seo.png' alt='Devndespro SEO' style='height:40px;'/></div>` + emailMessage,
                }}
              />
              <label style={{ fontSize: 14, fontWeight: 500, marginTop: 6 }}>
                <input type="checkbox" checked={includeFullReport}
                  onChange={(e) => setIncludeFullReport(e.target.checked)} style={{ marginRight: 6 }} />
                Include full audit report
              </label>
            </div>
          </Modal>

          {/* Crawl snapshot */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1rem', padding: '12px 14px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Crawl Snapshot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 10 }}>
              {[
                { label: 'Status code',    value: crawl.statusCode || '—' },
                { label: 'Response time',  value: fmtMs(crawl.responseTimeMs) },
                { label: 'File size',      value: fmtBytes(crawl.fileSizeBytes) },
                { label: 'Language',       value: crawl.language || '—' },
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
                  {crawl.finalUrl || '—'}
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

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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