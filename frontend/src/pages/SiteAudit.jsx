import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass, faArrowsRotate, faPlay, faClock, faExternalLink, faPenToSquare,
  faMagnifyingGlassChart, faCircleXmark, faTriangleExclamation, faCircleCheck,
  faCamera, faShareNodes, faEnvelope, faChevronLeft, faChevronRight, faChevronDown,
  faAlignLeft, faAlignCenter, faAlignRight, faCircleStop, faPaperclip,
} from '@fortawesome/free-solid-svg-icons'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button, Modal, Input } from '../components/UI'
import AppProcessTopBar from '../components/AppProcessTopBar'
import { AUDIT_PAGE_FLOW } from '../constants/pageFlows'
import useProcessScrollSpy from '../hooks/useProcessScrollSpy'
import { useSnackbar } from '../App'
import { useAuth } from '../hooks/useAuth'
import api from '../utils/api'
import AuditScoreBanner from '../components/audit/AuditScoreBanner'
import AuditIssueRow from '../components/audit/AuditIssueRow'
import AuditSpeedPanel from '../components/audit/AuditSpeedPanel'
import MultipageScoreBanner from '../components/audit/MultipageScoreBanner'
import DecisionCenter from '../components/dashboard/DecisionCenter'

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
  const domain = extractDomain(url) || 'your website'
  return lang === 'no'
    ? `Gratis teknisk analyse av ${domain}`
    : `Free technical website analysis for ${domain}`
}
function getSummaryEmailText(lang, tone, auditData, allIssues) {
  const rawScore = Number(auditData?.score)
  const score = Number.isFinite(rawScore) ? rawScore : '-'
  const numericScore = Number.isFinite(rawScore) ? rawScore : 0

  const critical = (allIssues || []).filter(
    (issue) => issue.status === 'error'
  ).length

  const warnings = (allIssues || []).filter(
    (issue) => issue.status === 'warning'
  ).length

  const url =
    auditData?.url ||
    (lang === 'no' ? 'nettstedet' : 'the website')

  let techScore = null
  let contentScore = null

  if (Array.isArray(auditData?.checks)) {
    const grouped = groupByCategory(auditData.checks)

    for (const category of grouped) {
      const categoryName = String(category.name || '').toLowerCase()

      if (
        categoryName.includes('technical seo') ||
        categoryName.includes('sikkerhet') ||
        categoryName.includes('security')
      ) {
        techScore = category.score
      }

      if (categoryName.includes('content quality')) {
        contentScore = category.score
      }
    }
  }

  techScore = techScore ?? '-'
  contentScore = contentScore ?? '-'

  const techTick = techScore === 100 ? ' &#10003;' : ''
  const contentTick = contentScore === 100 ? ' &#10003;' : ''

  let assessmentNo = ''
  let assessmentEn = ''
  let reportNo = ''
  let reportEn = ''

  // ----------------------------------------------------------
  // Dynamic wording based on health score and critical issues
  // ----------------------------------------------------------

  if (numericScore >= 90) {
    assessmentNo =
      critical > 0
        ? `Nettstedet fremst\u00e5r som teknisk solid. Vi fant likevel ${
            critical === 1
              ? 'ett viktig punkt'
              : `${critical} viktige punkter`
          } som kan v\u00e6re fornuftige \u00e5 prioritere, i tillegg til noen mindre forbedringsmuligheter.`
        : `Nettstedet fremst\u00e5r som teknisk solid. Analysen avdekket hovedsakelig mindre forbedringspunkter som kan bidra til \u00e5 finjustere synlighet, ytelse og teknisk kvalitet ytterligere.`

    assessmentEn =
      critical > 0
        ? `The website appears technically strong. We did, however, identify ${
            critical === 1
              ? 'one important item'
              : `${critical} important items`
          } worth prioritizing, along with a few smaller opportunities.`
        : `The website appears technically strong. The review mainly identified smaller opportunities that could further refine visibility, performance, and technical quality.`

    reportNo =
      `Jeg har samlet observasjonene i en kort rapport med konkrete anbefalinger, som jeg gjerne deler kostnadsfritt.`

    reportEn =
      `I have summarized the observations in a concise report with practical recommendations and would be happy to share it free of charge.`

  } else if (numericScore >= 80) {
    assessmentNo =
      critical > 0
        ? `Nettstedet har et godt teknisk fundament. Analysen avdekket likevel ${
            critical === 1
              ? 'ett viktig teknisk punkt'
              : `${critical} viktige tekniske punkter`
          }, i tillegg til noen mindre forbedringsmuligheter.`
        : `Nettstedet har et godt teknisk fundament. Analysen avdekket noen forbedringsomr\u00e5der som kan bidra til bedre synlighet, ytelse og brukeropplevelse.`

    assessmentEn =
      critical > 0
        ? `The website has a good technical foundation. The review still identified ${
            critical === 1
              ? 'one important technical item'
              : `${critical} important technical items`
          }, along with a few smaller opportunities.`
        : `The website has a good technical foundation. The review identified several opportunities that could improve visibility, performance, and user experience.`

    reportNo =
      `Jeg har utarbeidet en kostnadsfri rapport med de viktigste anbefalingene og prioriterte tiltakene.`

    reportEn =
      `I have prepared a complimentary report with the main recommendations and prioritized actions.`

  } else if (numericScore >= 60) {
    assessmentNo =
      critical > 0
        ? `Nettstedet har flere sterke sider, men analysen avdekket ogs\u00e5 ${
            critical === 1
              ? 'ett kritisk punkt'
              : `${critical} kritiske punkter`
          } og noen andre forbedringsomr\u00e5der. Ved \u00e5 prioritere de viktigste funnene f\u00f8rst kan nettstedet f\u00e5 et sterkere teknisk fundament.`
        : `Nettstedet har flere sterke sider, men analysen viser ogs\u00e5 noen tekniske forbedringsomr\u00e5der som kan bidra til bedre synlighet og ytelse.`

    assessmentEn =
      critical > 0
        ? `The website has several strengths, but the review also identified ${
            critical === 1
              ? 'one critical item'
              : `${critical} critical items`
          } and some additional improvement areas. Prioritizing the most important findings first could provide a stronger technical foundation.`
        : `The website has several strengths, but the review also identified technical opportunities that could improve visibility and performance.`

    reportNo =
      `Jeg har utarbeidet en detaljert rapport med prioriterte tiltak og konkrete anbefalinger. Dersom dette er av interesse, sender jeg den gjerne kostnadsfritt.`

    reportEn =
      `I have prepared a detailed report with prioritized actions and practical recommendations. I would be happy to share it free of charge.`

  } else {
    assessmentNo =
      critical > 0
        ? `Det mest presserende er ${
            critical === 1
              ? 'det kritiske funnet'
              : `de ${critical} kritiske funnene`
          }. Ved \u00e5 prioritere ${
            critical === 1 ? 'dette' : 'disse'
          } f\u00f8rst kan nettstedet f\u00e5 et sterkere teknisk grunnlag, samtidig som de \u00f8vrige forbedringene blir enklere \u00e5 gjennomf\u00f8re.`
        : `Selv om analysen ikke viser kritiske problemer, finnes det flere tekniske forbedringer som samlet kan ha betydning for synlighet, ytelse og brukeropplevelse.`

    assessmentEn =
      critical > 0
        ? `The most immediate priority is ${
            critical === 1
              ? 'the critical finding'
              : `the ${critical} critical findings`
          }. Addressing ${
            critical === 1 ? 'this item' : 'these items'
          } first could give the website a stronger technical foundation and make the remaining improvements easier to implement.`
        : `Although the review did not identify critical issues, several technical improvements could collectively affect visibility, performance, and user experience.`

    reportNo =
      `Jeg har utarbeidet en detaljert rapport med skjermbilder, forklaringer og konkrete anbefalinger. Dersom dette er av interesse, sender jeg den gjerne kostnadsfritt.`

    reportEn =
      `I have prepared a detailed report with screenshots, explanations, and practical recommendations. I would be happy to share it free of charge.`
  }

  // ----------------------------------------------------------
  // Norwegian
  // ----------------------------------------------------------

  if (lang === 'no') {
    const greeting =
      tone === 'formal'
        ? 'Kj\u00e6re [Navn/Team],'
        : 'Hei,'

    const introduction =
      tone === 'formal'
        ? `Mitt navn er <b>Mahadevan Sivasubramanian</b>, og jeg er <b>Founder &amp; Chief Technology Officer (CTO)</b> i <b>Devndespro</b>, et norsk teknologiselskap som arbeider med webutvikling, AI-l\u00f8sninger, DevOps og teknisk SEO.`
        : `Mitt navn er <b>Mahadevan Sivasubramanian</b>, og jeg er <b>Founder &amp; Chief Technology Officer (CTO)</b> i <b>Devndespro</b>, et norsk teknologiselskap som hjelper bedrifter med webutvikling, AI-l\u00f8sninger, DevOps og teknisk SEO.`

    return `${greeting}<br><br>

${introduction}<br><br>

Vi har utviklet et analyseverkt\u00f8y for teknisk SEO og nettstedskvalitet. Som en del av den videre utviklingen gjennomg\u00e5r vi jevnlig offentlig tilgjengelige bedriftsnettsider. N\u00e5r vi oppdager forhold som kan v\u00e6re nyttige for virksomheten, deler vi gjerne observasjonene kostnadsfritt og uten forpliktelser.<br><br>

Jeg kom nylig over nettsiden deres, <b>${url}</b>, og valgte \u00e5 gjennomf\u00f8re en teknisk analyse. Jeg \u00f8nsket derfor \u00e5 dele en kort oppsummering av funnene med dere.<br><br>

<b>Kort oppsummert:</b><br>
- Total helsescore: <b>${score}/100</b><br>
- Kritiske problemer: <b>${critical}</b><br>
- Advarsler: <b>${warnings}</b><br>
- Teknisk SEO &amp; sikkerhet: <b>${techScore}</b>${techTick}<br>
- Innholdskvalitet: <b>${contentScore}</b>${contentTick}<br><br>

${assessmentNo}<br><br>

Analysen er utf\u00f8rt med v\u00e5rt egenutviklede analyseverkt\u00f8y, <a href="https://seo.devndespro.com">seo.devndespro.com</a>.<br><br>

${reportNo}<br><br>

Dersom dere \u00f8nsker \u00e5 gjennomf\u00f8re forbedringene selv, kan rapporten selvf\u00f8lgelig brukes av deres interne utviklingsteam eller eksisterende leverand\u00f8r. Skulle dere \u00f8nske bistand, hjelper vi ogs\u00e5 med <b>webutvikling, modernisering av nettsider, AI-l\u00f8sninger, DevOps, teknisk SEO og systemintegrasjoner</b>.<br><br>

Gi meg gjerne beskjed dersom dere \u00f8nsker rapporten, s\u00e5 sender jeg den over uten noen forpliktelser.<br><br>

Med vennlig hilsen,<br><br>

<b>Mahadevan Sivasubramanian</b><br>
Founder &amp; Chief Technology Officer (CTO)<br>
<b>Devndespro</b><br>
Web Development | AI Solutions | DevOps | Technical SEO<br><br>

<a href="https://www.devndespro.com">www.devndespro.com</a><br>
<a href="https://seo.devndespro.com">seo.devndespro.com</a><br>
<a href="mailto:hello@devndespro.com">hello@devndespro.com</a>`
  }

  // ----------------------------------------------------------
  // English
  // ----------------------------------------------------------

  const greeting =
    tone === 'formal'
      ? 'Dear [Name/Team],'
      : 'Hi,'

  const introduction =
    tone === 'formal'
      ? `My name is <b>Mahadevan Sivasubramanian</b>, and I am the <b>Founder &amp; Chief Technology Officer (CTO)</b> at <b>Devndespro</b>, a Norway-based technology company working across web development, AI solutions, DevOps, and technical SEO.`
      : `My name is <b>Mahadevan Sivasubramanian</b>, and I am the <b>Founder &amp; Chief Technology Officer (CTO)</b> at <b>Devndespro</b>, a Norway-based technology company helping businesses with web development, AI solutions, DevOps, and technical SEO.`

  return `${greeting}<br><br>

${introduction}<br><br>

We have developed a platform for technical SEO and website-quality analysis. As part of its continued development, we regularly review publicly available business websites. When we identify something that may be useful to the business, we are happy to share our observations free of charge and without obligation.<br><br>

I recently came across your website, <b>${url}</b>, and chose to conduct a technical review. I wanted to share a brief summary of the findings with you.<br><br>

<b>Summary:</b><br>
- Overall health score: <b>${score}/100</b><br>
- Critical issues: <b>${critical}</b><br>
- Warnings: <b>${warnings}</b><br>
- Technical SEO &amp; security: <b>${techScore}</b>${techTick}<br>
- Content quality: <b>${contentScore}</b>${contentTick}<br><br>

${assessmentEn}<br><br>

The analysis was completed using our internally developed platform, <a href="https://seo.devndespro.com">seo.devndespro.com</a>.<br><br>

${reportEn}<br><br>

If you prefer to implement the improvements internally, the report can of course be used by your development team or existing provider. Should you need assistance, we also support <b>web development, website modernization, AI solutions, DevOps, technical SEO, and system integrations</b>.<br><br>

Please let me know if you would like the report, and I will send it over with no obligation.<br><br>

Best regards,<br><br>

<b>Mahadevan Sivasubramanian</b><br>
Founder &amp; Chief Technology Officer (CTO)<br>
<b>Devndespro</b><br>
Web Development | AI Solutions | DevOps | Technical SEO<br><br>

<a href="https://www.devndespro.com">www.devndespro.com</a><br>
<a href="https://seo.devndespro.com">seo.devndespro.com</a><br>
<a href="mailto:hello@devndespro.com">hello@devndespro.com</a>`
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
  const [collapsedSections, setCollapsedSections] = useState({
    decisionCenter: false,
    fullSiteAudit: false,
    aiVisibility: false,
    authority: false,
    crawlSnapshot: false,
    issues: false,
  })

  const toggleSection = (section) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }))
  }

  const showSnackbar = useSnackbar()
  const { siteId }   = useParams()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const allowedAuditEmails = new Set(['hello@devndespro.com', 'karthic2914@gmail.com'])
  const canRunFullAudit = Boolean(user?.is_paid || allowedAuditEmails.has(user?.email))

  const [showEmailModal,    setShowEmailModal]    = useState(false)
  const [auditData,         setAuditData]         = useState(null)
  const [cronEnabled,       setCronEnabled]       = useState(false)
  const toggleCron = async (val) => {
    setCronEnabled(val)
    await api.patch('/sites/' + siteId + '/ai-cron', { enabled: val }).catch(() => {})
  }
  const [loading,           setLoading]           = useState(true)
  const [running,           setRunning]           = useState(false)
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(AUDIT_PAGE_FLOW, [loading, running])
  const [runError,          setRunError]          = useState(null)
  const [activeTab,         setActiveTab]         = useState('all')
  const auditIssuesRef = useRef(null)
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
  const [domainRank, setDomainRank] = useState(null)
  const [authorityDetails, setAuthorityDetails] = useState(null)
  const [authorityUpdatedAt, setAuthorityUpdatedAt] = useState(null)
  const [refreshingAuthority, setRefreshingAuthority] = useState(false)
  useEffect(() => {
    let cancelled = false

    async function loadAuthorityBreakdownFromBacklinks() {
      if (!siteId) return

      try {
        const response = await api.get(`/sites/${siteId}/backlinks`)
        const rows = Array.isArray(response?.data) ? response.data : []

        const live = rows.filter(
          (item) => String(item?.status || '').toLowerCase() === 'live'
        )

        const totalBacklinks = live.length

        const referringDomains = new Set(
          live
            .map((item) => String(item?.name || '').trim().toLowerCase())
            .filter(Boolean)
        ).size

        const avgDr =
          totalBacklinks > 0
            ? live.reduce((sum, item) => {
                const rank = Number(
                  item?.provider_rank ||
                  item?.dr ||
                  item?.quality_score ||
                  0
                )
                return sum + rank
              }, 0) / totalBacklinks
            : 0

        const dofollowCount = live.filter(
          (item) =>
            String(item?.type || '').toLowerCase() === 'dofollow'
        ).length

        const dofollowRatio =
          totalBacklinks > 0
            ? (dofollowCount / totalBacklinks) * 100
            : 0

        const logScore = (value, target) => {
          if (!value || value <= 0) return 0

          return Math.min(
            100,
            Math.round(
              (100 * Math.log10(value + 1)) /
              Math.log10(target + 1)
            )
          )
        }

        const referringDomainScore =
          logScore(referringDomains, 200)

        const drScore =
          Math.round(Math.max(0, Math.min(100, avgDr)))

        const dofollowScore =
          Math.min(
            100,
            Math.round((dofollowRatio / 70) * 100)
          )

        const backlinkVolumeScore =
          logScore(totalBacklinks, 1000)

        if (!cancelled) {
          setAuthorityDetails((prev) => {
            const existing = prev?.breakdown || {}
            // Do not overwrite calibrated server Link Score components
            // with the simpler client estimate (e.g. dofollow → 100 at ≥70%).
            const hasServerLinkScore = Boolean(
              existing.domainDiversity ||
              existing.followNaturality ||
              existing.verifiedLinkQuality
            )

            if (hasServerLinkScore) {
              return {
                ...(prev || {}),
                breakdown: {
                  ...existing,
                  domainRank:
                    existing.domainRank ??
                    prev?.domain_rank ??
                    null,
                },
                domain_rank: prev?.domain_rank ?? null,
              }
            }

            return {
              ...(prev || {}),
              breakdown: {
                ...existing,
                referringDomains: {
                  value: referringDomains,
                  score: referringDomainScore,
                  weight: 40,
                },
                averageDR: {
                  value: Math.round(avgDr * 10) / 10,
                  score: drScore,
                  weight: 30,
                },
                dofollow: {
                  count: dofollowCount,
                  ratio: Math.round(dofollowRatio * 10) / 10,
                  score: dofollowScore,
                  weight: 15,
                },
                backlinks: {
                  value: totalBacklinks,
                  score: backlinkVolumeScore,
                  weight: 15,
                },
                domainRank:
                  existing.domainRank ??
                  prev?.domain_rank ??
                  null,
              },
              domain_rank: prev?.domain_rank ?? null,
            }
          })
        }
      } catch (error) {
        console.warn(
          'Unable to load Authority Intelligence breakdown:',
          error
        )
      }
    }

    loadAuthorityBreakdownFromBacklinks()

    return () => {
      cancelled = true
    }
  }, [siteId])
  const [showAuditMenu, setShowAuditMenu] = useState(false)
  const [multipageStatus, setMultipageStatus] = useState(null)
  const [multipageProgress, setMultipageProgress] = useState(null)
  
  const [currentAuditRunId, setCurrentAuditRunId] = useState(null)
  const cancelPollingRef = useRef(false)
  const multipagePollFailuresRef = useRef(0)
  const [multipageResults, setMultipageResults] = useState(null)
  const [multipageLatestPages, setMultipageLatestPages] = useState([])
  const [multipageBuckets, setMultipageBuckets] = useState(null)
  const [showDupTitles, setShowDupTitles] = useState(false)
  const [showDupMeta, setShowDupMeta] = useState(false)
  const [showCrawledPages, setShowCrawledPages] = useState(false)

  // Major Site Audit section visibility
  const [showFullSiteResults, setShowFullSiteResults] = useState(true)
  const [showAuthoritySection, setShowAuthoritySection] = useState(true)
  const [showCrawlSnapshot, setShowCrawlSnapshot] = useState(true)
  const [issueHistory, setIssueHistory] = useState([])
  const [expandedIssueKey, setExpandedIssueKey] = useState(null)
  const issueFixStorageKey = `site-audit-fixes:${siteId}`

  const [issueFixes, setIssueFixes] = useState(() => {
    try {
      const saved = localStorage.getItem(`site-audit-fixes:${siteId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [loadingFixKey, setLoadingFixKey] = useState(null)


  // Persist generated issue fixes so they survive refreshes and re-runs
  useEffect(() => {
    try {
      localStorage.setItem(
        issueFixStorageKey,
        JSON.stringify(issueFixes)
      )
    } catch {
      // Ignore browser storage errors
    }
  }, [issueFixes, issueFixStorageKey])

  // Remove saved fixes automatically when the corresponding
  // issue no longer exists in the latest full-site audit
  useEffect(() => {
    if (!multipageResults?.issueSummary) return

    const activeIssueKeys = new Set(
      multipageResults.issueSummary
        .map((issue) => issue.check)
        .filter(Boolean)
    )

    setIssueFixes((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([key]) =>
          activeIssueKeys.has(key)
        )
      )

      const previousKeys = Object.keys(previous)
      const nextKeys = Object.keys(next)

      const changed =
        previousKeys.length !== nextKeys.length ||
        previousKeys.some((key) => !nextKeys.includes(key))

      return changed ? next : previous
    })
  }, [multipageResults])
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

      // Only trust an explicit Domain Rank fetch — never fall back to
      // default seo_metrics.dr=0 (that made the UI show 0 before any refresh).
      const hasFetchedDomainRank = Boolean(
        siteRes?.data?.domain_rank_updated_at ||
        siteRes?.data?.domain_rank_meta?.fetchedAt ||
        siteRes?.data?.authority_breakdown?.domainRankMeta?.fetchedAt
      )
      const storedRank = hasFetchedDomainRank
        ? (
            siteRes?.data?.domain_rank ??
            siteRes?.data?.authority_breakdown?.domainRank ??
            null
          )
        : (siteRes?.data?.domain_rank ?? null)

      if (storedRank !== undefined && storedRank !== null && Number.isFinite(Number(storedRank))) {
        setDomainRank(Number(storedRank))
      } else {
        setDomainRank(null)
      }

      if (siteRes?.data?.authority_breakdown) {
        setAuthorityDetails((prev) => ({
          ...(prev || {}),
          breakdown: siteRes.data.authority_breakdown,
          domain_rank: siteRes.data.domain_rank ?? storedRank ?? null,
          methodology: prev?.methodology,
        }))
      }

      // Auto-fetch industry Domain Rank once if missing
      if (siteRes?.data?.domain_rank == null && siteRes?.data?.id) {
        api.post(`/sites/${siteId}/authority-score`)
          .then((r) => {
            if (r?.data?.authority_score != null) {
              setAuthorityScore(r.data.authority_score ?? r.data.link_score)
            }
            if (r?.data?.authority_updated_at) {
              setAuthorityUpdatedAt(r.data.authority_updated_at)
            }
            if (r?.data) {
              setAuthorityDetails((prev) => ({
                ...(prev || {}),
                ...r.data,
                breakdown: {
                  ...(prev?.breakdown || {}),
                  ...(r.data.breakdown || {}),
                },
              }))
            }
            if (r?.data?.domain_rank != null) {
              setDomainRank(Number(r.data.domain_rank))
            } else if (r?.data?.domain_rank_meta?.error) {
              console.warn(
                'Domain Rank fetch failed:',
                r.data.domain_rank_meta.error
              )
            }
          })
          .catch((err) => {
            console.warn(
              'Domain Rank refresh failed:',
              err?.response?.data?.detail || err?.message || err
            )
          })
      }
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


  async function rerunCompleteAudit() {
    setRunning(true)
    setRunError(null)

    try {
      // Refresh the homepage audit
      const quickResponse = await api.post(`/sites/${siteId}/audit/run`)

      setAuditData(quickResponse.data)
      setActiveTab('all')
      setExpandedIdx(null)

      // Refresh the full-site audit
      if (canRunFullAudit) {
        setMultipageStatus('running')
        setMultipageProgress({
          pagesCrawled: 0,
          pagesTotal: 0,
        })
        setMultipageLatestPages([])
        setMultipageBuckets(null)
        setMultipageResults(null)
        setShowDupTitles(false)
        setShowDupMeta(false)

        const fullResponse = await api.post(
          `/sites/${siteId}/audit/run-multipage`
        )

        const auditRunId = fullResponse?.data?.auditRunId

        if (!auditRunId) {
          throw new Error('Full-site audit did not return an audit run ID')
        }

        cancelPollingRef.current = false
        multipagePollFailuresRef.current = 0
        setCurrentAuditRunId(auditRunId)
        pollMultipageProgress(auditRunId)

        showSnackbar(
          'Homepage audit completed. Full-site audit is now running.',
          'success'
        )
      } else {
        showSnackbar('Audit completed successfully!', 'success')
      }
    } catch (e) {
      const message =
        e.response?.data?.error ||
        e.message ||
        'Audit failed - check the site URL is accessible'

      setRunError(message)

      setMultipageStatus((currentStatus) =>
        currentStatus === 'running' ? 'failed' : currentStatus
      )

      showSnackbar(message, 'error')
    } finally {
      setRunning(false)
    }
  }
  async function pollMultipageProgress(auditRunId) {
    if (cancelPollingRef.current) return

    try {
      const response = await api.get(
        `/sites/${siteId}/audit/multipage-progress/${auditRunId}`
      )

      if (cancelPollingRef.current) return

      const data = response.data

      // Successful progress response - clear transient polling failures
      multipagePollFailuresRef.current = 0

      setMultipageProgress({
        pagesCrawled: data.pagesCrawled,
        pagesTotal: data.pagesTotal,
      })

      setMultipageLatestPages(data.latestPages || [])
      setMultipageBuckets(data.statusBuckets || null)

      if (data.status === 'complete') {
        setMultipageStatus('complete')
        setCurrentAuditRunId(null)
        setMultipageResults(data.results)

        showSnackbar('Full site audit completed!', 'success')

        api.get(`/sites/${siteId}/audit/multipage-history`)
          .then((historyResponse) => {
            if (historyResponse?.data?.history) {
              setIssueHistory(historyResponse.data.history)
            }
          })
          .catch(() => {})
      } else if (data.status === 'failed') {
        setMultipageStatus('failed')
        setCurrentAuditRunId(null)
        showSnackbar('Full site audit failed', 'error')
      } else if (data.status === 'cancelled') {
        setMultipageStatus('cancelled')
        setCurrentAuditRunId(null)
        showSnackbar('Full site audit cancelled', 'success')
      } else if (!cancelPollingRef.current) {
        setTimeout(() => {
          pollMultipageProgress(auditRunId)
        }, 2000)
      }
    } catch (error) {
      if (cancelPollingRef.current) return

      multipagePollFailuresRef.current += 1

      const failureCount = multipagePollFailuresRef.current
      const maxFailures = 5

      console.warn(
        `Full-site audit polling failed (${failureCount}/${maxFailures})`,
        error
      )

      // Temporary network/API problems must not immediately
      // terminate an otherwise running server-side audit.
      if (failureCount < maxFailures) {
        setMultipageStatus('running')

        setTimeout(() => {
          if (!cancelPollingRef.current) {
            pollMultipageProgress(auditRunId)
          }
        }, 3000)

        return
      }

      setMultipageStatus('failed')
      setCurrentAuditRunId(null)

      showSnackbar(
        'Could not reconnect to the running audit after several attempts.',
        'error'
      )
    }
  }

  async function runMultipageAudit() {
    if (multipageStatus === 'running' || currentAuditRunId) {
      showSnackbar('A full site audit is already in progress.', 'warning')
      return
    }

    if (!canRunFullAudit) {
      showSnackbar(
        'Full Site Audit is available only for approved admin accounts',
        'error'
      )
      return
    }

    cancelPollingRef.current = false
    multipagePollFailuresRef.current = 0
    setMultipageStatus('running')
    setMultipageProgress({
      pagesCrawled: 0,
      pagesTotal: 0,
    })
    setMultipageLatestPages([])
    setMultipageBuckets(null)
    setMultipageResults(null)
    setShowDupTitles(false)
    setShowDupMeta(false)

    try {
      const response = await api.post(
        `/sites/${siteId}/audit/run-multipage`
      )

      const auditRunId = response?.data?.auditRunId

      if (!auditRunId) {
        throw new Error(
          'Full-site audit did not return an audit run ID'
        )
      }

      setCurrentAuditRunId(auditRunId)
      pollMultipageProgress(auditRunId)
    } catch (error) {
      setMultipageStatus('failed')
      setCurrentAuditRunId(null)

      showSnackbar(
        error.response?.data?.error ||
          error.message ||
          'Failed to start full site audit',
        'error'
      )
    }
  }
  async function cancelMultipageAudit() {
    cancelPollingRef.current = true
    const auditRunId = currentAuditRunId

    setCurrentAuditRunId(null)
    setMultipageStatus('cancelled')
    setMultipageProgress(null)
    setMultipageLatestPages([])
    setMultipageBuckets(null)

    try {
      if (auditRunId) {
        await api.post(
          `/sites/${siteId}/audit/cancel-multipage/${auditRunId}`
        )
      }

      showSnackbar('Full site audit cancelled', 'success')
    } catch {
      showSnackbar(
        'Polling stopped, but server cancellation was not confirmed.',
        'warning'
      )
    }
  }
  function normalizeAiFixResponse(rawResponse) {
    let candidate =
      rawResponse?.data && typeof rawResponse.data === 'object'
        ? rawResponse.data
        : rawResponse?.result && typeof rawResponse.result === 'object'
          ? rawResponse.result
          : rawResponse?.recommendation &&
              typeof rawResponse.recommendation === 'object'
            ? rawResponse.recommendation
            : rawResponse

    // Remove Markdown JSON fences and parse a JSON string.
    const parseJsonText = (value) => {
      if (typeof value !== 'string') return null

      const text = value.trim()

      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      if (!cleaned.startsWith('{')) {
        return null
      }

      try {
        return JSON.parse(cleaned)
      } catch (error) {
        console.warn(
          'Could not parse AI recommendation JSON:',
          error
        )
        return null
      }
    }

    // Case 1:
    // Entire response is JSON returned as text.
    if (typeof candidate === 'string') {
      const parsedCandidate = parseJsonText(candidate)

      if (parsedCandidate) {
        candidate = parsedCandidate
      } else {
        return {
          fix: candidate,
        }
      }
    }

    // Case 2:
    // Backend returns:
    //
    // {
    //   fix: "```json { ... } ```"
    // }
    //
    // This is the response format currently causing
    // the large JSON blob in the UI.
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.fix === 'string'
    ) {
      const parsedFix = parseJsonText(candidate.fix)

      if (
        parsedFix &&
        typeof parsedFix === 'object'
      ) {
        candidate = {
          ...candidate,
          ...parsedFix,
        }
      }
    }

    return candidate
  }
  async function fetchIssueFix(issue) {
    const key = issue.check

    // Normalize old recommendations already stored in localStorage.
    const existingFix = normalizeAiFixResponse(issueFixes[key])

    const hasExistingFix = Boolean(
      existingFix &&
      (
        existingFix.why ||
        existingFix.fix ||
        existingFix.before ||
        existingFix.after ||
        existingFix.timeToFix ||
        existingFix.priorityNote
      )
    )

    if (hasExistingFix) {
      // If the old saved value contained Markdown JSON,
      // replace it with the normalized object.
      setIssueFixes((previous) => ({
        ...previous,
        [key]: existingFix,
      }))

      setExpandedIssueKey(
        expandedIssueKey === key ? null : key
      )

      return
    }

    setLoadingFixKey(key)
    setExpandedIssueKey(key)

    try {
      const response = await api.post(
        `/sites/${siteId}/audit/ai-fix`,
        {
          issue: {
            message: issue.sampleMessage,
            category: issue.category,
            impact: issue.impact,
            status: issue.status,
          },
          siteUrl: siteUrl || auditData?.url,
        },
        {
          timeout: 30000,
        }
      )

      const normalized = normalizeAiFixResponse(response?.data)

      const validFix = Boolean(
        normalized &&
        (
          normalized.why ||
          normalized.fix ||
          normalized.before ||
          normalized.after ||
          normalized.timeToFix ||
          normalized.priorityNote
        )
      )

      if (!validFix) {
        console.warn(
          'Unexpected ai-fix response:',
          response?.data
        )

        setIssueFixes((previous) => {
          const next = { ...previous }
          delete next[key]
          return next
        })

        setExpandedIssueKey(null)

        showSnackbar(
          'Could not read the fix recommendation. Please try again.',
          'error'
        )

        return
      }

      setIssueFixes((previous) => ({
        ...previous,
        [key]: normalized,
      }))

    } catch (e) {
      const isTimeout =
        e.code === 'ECONNABORTED' ||
        /timeout/i.test(e.message || '')

      setIssueFixes((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })

      setExpandedIssueKey(null)

      showSnackbar(
        isTimeout
          ? 'The AI took too long to respond. Please try again.'
          : 'Could not generate fix suggestion. Please try again.',
        'error'
      )

    } finally {
      setLoadingFixKey(null)
    }
  }
  function getCrawledPageExportRows() {
    const pages = Array.isArray(multipageResults?.pages)
      ? multipageResults.pages
      : []

    return pages.map((page, index) => ({
      'S.No': index + 1,
      'Status': page.statusCode || 'ERR',
      'Page URL': page.url || '',
      'Title': page.title || '',
      'Meta Description': page.metaDescription || '',
      'H1': page.h1 || '',
      'Canonical': page.canonical || '',
      'Word Count': Number(page.wordCount || 0),
      'Response Time (ms)': Number(page.responseTimeMs || 0),
    }))
  }

  function getAuditExportName(extension) {
    let domain = 'site'

    try {
      domain = new URL(siteUrl || auditData?.url || '')
        .hostname
        .replace(/^www\./, '')
    } catch {
      domain = siteName || 'site'
    }

    const safeDomain = String(domain)
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, '-')

    const date = new Date().toISOString().slice(0, 10)

    return `${safeDomain}-crawled-pages-${date}.${extension}`
  }

  function exportCrawledPagesCsv() {
    const rows = getCrawledPageExportRows()

    if (!rows.length) {
      showSnackbar('No crawled pages available to export', 'error')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const csv = XLSX.utils.sheet_to_csv(worksheet)

    const blob = new Blob(
      ['\uFEFF' + csv],
      { type: 'text/csv;charset=utf-8;' }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getAuditExportName('csv')

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

    showSnackbar('CSV exported successfully', 'success')
  }

  function exportCrawledPagesExcel() {
    const rows = getCrawledPageExportRows()

    if (!rows.length) {
      showSnackbar('No crawled pages available to export', 'error')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)

    worksheet['!cols'] = [
      { wch: 7 },
      { wch: 9 },
      { wch: 55 },
      { wch: 45 },
      { wch: 65 },
      { wch: 45 },
      { wch: 55 },
      { wch: 12 },
      { wch: 18 },
    ]

    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Crawled Pages'
    )

    XLSX.writeFile(
      workbook,
      getAuditExportName('xlsx')
    )

    showSnackbar('Excel exported successfully', 'success')
  }

  function exportCrawledPagesPdf() {
    const rows = getCrawledPageExportRows()

    if (!rows.length) {
      showSnackbar('No crawled pages available to export', 'error')
      return
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    let domain = siteName || siteUrl || auditData?.url || 'Website'

    try {
      domain = new URL(siteUrl || auditData?.url || '')
        .hostname
        .replace(/^www\./, '')
    } catch {
      // Keep available site name
    }

    doc.setFontSize(16)
    doc.text('Full Site Audit - Crawled Pages', 14, 14)

    doc.setFontSize(9)

    doc.text(
      `Website: ${domain}`,
      14,
      21
    )

    doc.text(
      `Pages audited: ${rows.length}`,
      14,
      26
    )

    doc.text(
      `Exported: ${new Date().toLocaleString()}`,
      14,
      31
    )

    const body = rows.map((row) => [
      row['S.No'],
      row['Status'],
      row['Page URL'],
      row['Title'],
      row['Meta Description'],
      row['H1'],
      row['Canonical'],
      row['Word Count'],
      row['Response Time (ms)'],
    ])

    autoTable(doc, {
      startY: 36,
      tableWidth: 'auto',

      head: [[
        'S.No',
        'Status',
        'Page URL',
        'Title',
        'Meta Description',
        'H1',
        'Canonical',
        'Words',
        'Time (ms)',
      ]],

      body,

      theme: 'grid',

      styles: {
        fontSize: 5.5,
        cellPadding: 1.5,
        overflow: 'linebreak',
        cellWidth: 'wrap',
        valign: 'top',
        minCellHeight: 6,
      },

      headStyles: {
        fontStyle: 'bold',
        overflow: 'linebreak',
      },

      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 45, overflow: 'linebreak' },
        3: { cellWidth: 37, overflow: 'linebreak' },
        4: { cellWidth: 48, overflow: 'linebreak' },
        5: { cellWidth: 35, overflow: 'linebreak' },
        6: { cellWidth: 42, overflow: 'linebreak' },
        7: { cellWidth: 13, halign: 'right' },
        8: { cellWidth: 15, halign: 'right' },
      },

      rowPageBreak: 'auto',
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: 0,

      margin: {
        top: 14,
        left: 8,
        right: 8,
        bottom: 12,
      },

      didDrawPage: () => {
        const pageNumber = doc.internal.getNumberOfPages()

        doc.setFontSize(7)
        doc.text(
          `Page ${pageNumber}`,
          doc.internal.pageSize.getWidth() - 20,
          doc.internal.pageSize.getHeight() - 5
        )
      },
    })

    doc.save(
      getAuditExportName('pdf')
    )

    showSnackbar('PDF exported successfully', 'success')
  }
  async function refreshAuthorityScore() {
    setRefreshingAuthority(true)
    try {
      const r = await api.post(`/sites/${siteId}/authority-score`)
      setAuthorityScore(r.data.authority_score ?? r.data.link_score)
      setAuthorityDetails((prev) => ({
        ...(prev || {}),
        ...r.data,
        breakdown: {
          ...(prev?.breakdown || {}),
          ...(r.data.breakdown || {}),
        },
      }))
      setAuthorityUpdatedAt(r.data.authority_updated_at)
      if (r.data.domain_rank != null) setDomainRank(Number(r.data.domain_rank))
      showSnackbar(
        r.data.domain_rank != null
          ? 'Domain Rank & Link Score updated'
          : 'Link Score updated (Domain Rank unavailable)',
        'success'
      )
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
        language: emailLang,
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

  // OVERVIEW CATEGORY DEEP LINK
  // Example: /site/8/audit?category=On-Page%20SEO
  useEffect(() => {
    if (loading) return

    const categoryParam = new URLSearchParams(window.location.search).get('category')
    if (!categoryParam) return

    const requestedTab = categoryParam
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')

    const matchingCategory = categories.find(
      (category) => category.id === requestedTab
    )

    if (!matchingCategory) return

    setActiveTab(requestedTab)
    setExpandedIdx(null)

    const timer = window.setTimeout(() => {
      auditIssuesRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 180)

    return () => window.clearTimeout(timer)
  }, [loading, categories])
  const visibleIssues = useMemo(() => {
    if (activeTab === 'all')      return allIssues
    if (activeTab === 'errors')   return allIssues.filter((i) => i.status === 'error')
    if (activeTab === 'warnings') return allIssues.filter((i) => i.status === 'warning')
    if (activeTab === 'passed')   return allIssues.filter((i) => i.status === 'pass')
    return allIssues.filter((i) => (i.category || 'On-Page SEO').toLowerCase().replace(/\s+/g, '_') === activeTab)
  }, [allIssues, activeTab])

  if (loading) {
    return (
      <div className="fade-in">
        <AppProcessTopBar
          steps={AUDIT_PAGE_FLOW.map((s) => ({
            ...s,
            done: false,
            active: s.id === 'run',
          }))}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9CA3AF', fontSize: 14 }}>
          <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 10, opacity: 0.4 }} />
          Loading audit data...
        </div>
      </div>
    )
  }

  if (!auditData) {
    return (
      <div className="fade-in">
        <AppProcessTopBar
          steps={AUDIT_PAGE_FLOW.map((s) => ({
            ...s,
            done: false,
            active: s.id === 'run',
          }))}
        />
        <div style={{ padding: 'clamp(1rem, 4vw, 1.5rem) clamp(0.75rem, 4vw, 2rem)' }}>
          <div id="audit-section-run">
            <EmptyAudit onRun={runAudit} running={running} error={runError} />
          </div>
        </div>
      </div>
    )
  }

  const latestScannedAt =
    multipageResults?.scannedAt ||
    auditData?.scannedAt ||
    null

  const scannedDate = latestScannedAt
    ? new Date(latestScannedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
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
    <div className="fade-in">
      <AppProcessTopBar
        steps={AUDIT_PAGE_FLOW.map((s) => ({
          ...s,
          done: s.id === 'run' ? Boolean(auditData) : s.id === 'review' ? Boolean(auditData?.checks?.length) : false,
          active: scrollFlowId === s.id,
          onClick: () => {
            setScrollFlowId(s.id)
            if (s.sectionId) {
              document.getElementById(s.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          },
        }))}
      />
    <div ref={captureRef} style={{ padding: 'clamp(1rem, 4vw, 1.5rem) clamp(0.75rem, 4vw, 2rem)' }}>

      {/* Page header */}
      <div id="audit-section-run" className='audit-page-header' style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowEmailModal(true)}
            style={{ background: '#F97316', borderColor: '#F97316' }}
          >
            <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: 6 }} />
            <span className='btn-label'>Send summary email</span>
          </Button>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, position: 'relative' }}>
            <Button variant="primary" size="sm" onClick={rerunCompleteAudit} disabled={running || exporting || multipageStatus === 'running'} style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
              <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6, animation: running ? 'spin 1s linear infinite' : 'none' }} /><span className='btn-label'>{running ? 'Scanning...' : 'Re-run Audit'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAuditMenu(v => !v)} disabled={running || exporting || multipageStatus === 'running'} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }}>
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
                    onClick={() => { if (!canRunFullAudit) return; setShowAuditMenu(false); runMultipageAudit() }}
                    disabled={!canRunFullAudit}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                      background: canRunFullAudit ? '#fff' : '#F9FAFB',
                      cursor: canRunFullAudit ? 'pointer' : 'not-allowed',
                      opacity: canRunFullAudit ? 1 : 0.55,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: canRunFullAudit ? '#111827' : '#9CA3AF' }}>Full Site Audit <span style={{ fontSize: 10, color: '#F97316', fontWeight: 700 }}>BETA</span></div>
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

{multipageStatus === 'running' && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
          padding: '12px 16px', marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <FontAwesomeIcon icon={faArrowsRotate} style={{ color: '#2563EB', animation: 'spin 1s linear infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
  <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A' }}>
    Running full site audit{multipageProgress?.pagesTotal ? ` (${multipageProgress.pagesCrawled}/${multipageProgress.pagesTotal} pages)` : ' (discovering pages...)'}
  </div>

  <button
    type="button"
    onClick={cancelMultipageAudit}
    title="Cancel full site audit"
    aria-label="Cancel full site audit"
    style={{
      width: 26,
      height: 26,
      borderRadius: '50%',
      border: '1px solid #FCA5A5',
      background: '#FEF2F2',
      color: '#DC2626',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <FontAwesomeIcon icon={faCircleStop} style={{ fontSize: 12 }} />
  </button>
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

      <div style={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        marginBottom: '1rem',
      }}>
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: collapsedSections.decisionCenter
            ? 'none'
            : '1px solid #F3F4F6',
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#374151',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            Decision Center
          </div>

          <button
            type="button"
            onClick={() => toggleSection('decisionCenter')}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: '#fff',
              cursor: 'pointer',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FontAwesomeIcon
              icon={collapsedSections.decisionCenter
                ? faChevronRight
                : faChevronDown}
            />
          </button>
        </div>

        {!collapsedSections.decisionCenter && (
          <DecisionCenter
            auditData={auditData}
            multipageResults={multipageResults}
            authorityScore={authorityScore}
            domainRank={domainRank}
            authorityDetails={authorityDetails}
          />
        )}
      </div>

      {multipageStatus === 'complete' && multipageResults && (
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '16px 18px', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: collapsedSections.fullSiteAudit ? 0 : 10,
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Full Site Audit Results (Beta) - {multipageResults.pagesTotal} pages crawled
            </div>

            <button
              type="button"
              onClick={() => toggleSection('fullSiteAudit')}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: '#fff',
                cursor: 'pointer',
                color: '#6B7280',
              }}
            >
              <FontAwesomeIcon
                icon={collapsedSections.fullSiteAudit ? faChevronRight : faChevronDown}
              />
            </button>
          </div>

          {!collapsedSections.fullSiteAudit && (
            <>
          <MultipageScoreBanner results={multipageResults} history={issueHistory} onCategoryClick={scrollToCategory} />

          {/* Crawled page inventory - collapsed by default */}
          {Array.isArray(multipageResults.pages) && multipageResults.pages.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setShowCrawledPages(v => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: '#2563EB',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <FontAwesomeIcon
                  icon={showCrawledPages ? faChevronDown : faChevronRight}
                  style={{ fontSize: 10 }}
                />
                {showCrawledPages ? 'Hide' : 'View'} crawled pages ({multipageResults.pages.length})
              </button>

              {showCrawledPages && (
                <div style={{
                  marginTop: 10,
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#F9FAFB',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 12px',
                    background: '#fff',
                    borderBottom: '1px solid #E5E7EB',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                      Crawled Pages
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {multipageResults.pages.length} URLs audited
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginLeft: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={exportCrawledPagesCsv}
                        style={{
                          border: '1px solid #D1D5DB',
                          background: '#fff',
                          borderRadius: 6,
                          padding: '4px 9px',
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#4B5563',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        CSV
                      </button>

                      <button
                        type="button"
                        onClick={exportCrawledPagesExcel}
                        style={{
                          border: '1px solid #D1D5DB',
                          background: '#fff',
                          borderRadius: 6,
                          padding: '4px 9px',
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#15803D',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Excel
                      </button>

                      <button
                        type="button"
                        onClick={exportCrawledPagesPdf}
                        style={{
                          border: '1px solid #D1D5DB',
                          background: '#fff',
                          borderRadius: 6,
                          padding: '4px 9px',
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#DC2626',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        PDF
                      </button>
                    </div>
                  </div>

                  <div style={{
                    maxHeight: 360,
                    overflowY: 'auto',
                    overflowX: 'auto',
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 11,
                      background: '#fff',
                    }}>
                      <thead style={{
                        position: 'sticky',
                        top: 0,
                        background: '#F9FAFB',
                        zIndex: 1,
                      }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6B7280', width: 70 }}>Status</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6B7280' }}>Page</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', color: '#6B7280' }}>Title</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', color: '#6B7280', width: 70 }}>Words</th>
                        </tr>
                      </thead>

                      <tbody>
                        {multipageResults.pages.map((page, index) => {
                          const code = Number(page.statusCode || 0)
                          const isOk = code >= 200 && code < 300
                          const isRedirect = code >= 300 && code < 400
                          const statusColor = isOk
                            ? '#16A34A'
                            : isRedirect
                              ? '#D97706'
                              : '#DC2626'

                          let pageLabel = page.url || '-'

                          try {
                            const parsed = new URL(page.url)
                            pageLabel = parsed.pathname + parsed.search
                            if (pageLabel === '/') pageLabel = 'Homepage /'
                          } catch {
                            // Keep original URL
                          }

                          return (
                            <tr
                              key={`${page.url}-${index}`}
                              style={{ borderTop: '1px solid #F3F4F6' }}
                            >
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: 38,
                                  padding: '2px 6px',
                                  borderRadius: 12,
                                  background: `${statusColor}12`,
                                  color: statusColor,
                                  fontWeight: 700,
                                }}>
                                  {page.statusCode || 'ERR'}
                                </span>
                              </td>

                              <td style={{
                                padding: '8px 10px',
                                maxWidth: 340,
                              }}>
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={page.url}
                                  style={{
                                    color: '#2563EB',
                                    textDecoration: 'none',
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {pageLabel}
                                </a>
                              </td>

                              <td
                                title={page.title || ''}
                                style={{
                                  padding: '8px 10px',
                                  color: '#4B5563',
                                  maxWidth: 320,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {page.title || 'No title'}
                              </td>

                              <td style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                color: '#6B7280',
                              }}>
                                {Number(page.wordCount || 0).toLocaleString()}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

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

                  const hasFix = Boolean(
                    fix &&
                    (
                      fix.why ||
                      fix.fix ||
                      fix.before ||
                      fix.after ||
                      fix.timeToFix ||
                      fix.priorityNote
                    )
                  )
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
                          {isLoadingFix ? 'Loading...' : hasFix ? 'View fix' : 'How to fix'}
                        </button>
                      </div>
                      {isExpanded && hasFix && (
                        <div style={{ padding: '12px 14px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB', fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                          {fix.why && <div style={{ marginBottom: 8 }}><strong>Why it matters:</strong> {fix.why}</div>}
                          {fix.fix && (
  <div style={{ marginBottom: 8 }}>
    <strong>Fix:</strong>
    <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
      {fix.fix}
    </div>
  </div>
)}
                          {fix.before && <div style={{ marginBottom: 4 }}><strong>Before:</strong> <code style={{ background: '#FEF2F2', padding: '1px 5px', borderRadius: 4 }}>{fix.before}</code></div>}
                          {fix.after && <div style={{ marginBottom: 8 }}><strong>After:</strong> <code style={{ background: '#F0FDF4', padding: '1px 5px', borderRadius: 4 }}>{fix.after}</code></div>}
                          {fix.timeToFix && (
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                              <strong>Estimated time:</strong> {fix.timeToFix}
                            </div>
                          )}

                          {fix.priorityNote && (
                            <div style={{
                              marginTop: 8,
                              padding: '8px 10px',
                              background: '#FFF7ED',
                              border: '1px solid #FED7AA',
                              borderRadius: 6,
                              color: '#9A3412',
                              fontSize: 11,
                            }}>
                              <strong>Priority:</strong> {fix.priorityNote}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #E5E7EB',
          marginBottom: '1rem',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection('aiVisibility')}
          style={{
            width: '100%',
            padding: '14px 16px',
            border: 'none',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'inherit',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            AI Visibility
          </span>

          <FontAwesomeIcon
            icon={
              collapsedSections.aiVisibility
                ? faChevronRight
                : faChevronDown
            }
            style={{
              fontSize: 12,
              color: '#6B7280',
            }}
          />
        </button>

        {!collapsedSections.aiVisibility && (
          <AuditScoreBanner
            auditData={auditData}
            categories={categories}
            aiScores={{
              chatgpt: auditData?.chatgptScore,
              claude: auditData?.claudeScore,
            }}
            cronEnabled={cronEnabled}
            onCronToggle={toggleCron}
            authorityScore={authorityScore}
            onCategoryClick={scrollToCategory}
            compact={
              multipageStatus === 'running' ||
              (multipageStatus === 'complete' && !!multipageResults)
            }
          />
        )}
      </div>
      <AuditSpeedPanel speed={auditData.speed} />

      {crawl && (
        <div>
          <Modal
            open={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            title="Send Audit Summary Email"
            width={480}
            footer={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ minHeight: 20 }}>
                  {includeFullReport && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 12, color: '#9A3412', background: '#FFF7ED',
                      border: '1px solid #FDBA74', borderRadius: 999,
                      padding: '4px 10px', fontWeight: 600,
                    }}>
                      <FontAwesomeIcon icon={faPaperclip} style={{ fontSize: 11 }} />
                      PDF attached
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => setShowEmailModal(false)}>Cancel</Button>
                  <Button variant="primary" loading={sendingEmail} onClick={sendSummaryEmail}>
                    {includeFullReport ? 'Send Email with PDF' : 'Send Email'}
                  </Button>
                </div>
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
                  ? 'Formal ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ suited for corporate and enterprise prospects'
                  : 'Casual ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ suited for SMB and local businesses'}
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
              <label style={{
                fontSize: 14, fontWeight: 500, marginTop: 6,
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={includeFullReport}
                  onChange={(e) => setIncludeFullReport(e.target.checked)}
                />
                Include full audit report
                {includeFullReport && (
                  <FontAwesomeIcon icon={faPaperclip} style={{ color: '#EA580C', fontSize: 13 }} title="PDF will be attached" />
                )}
              </label>

              {includeFullReport && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginTop: -4,
                  padding: '10px 12px',
                  background: '#FFF7ED',
                  border: '1px solid #FDBA74',
                  borderRadius: 8,
                }}>
                  <FontAwesomeIcon icon={faPaperclip} style={{ color: '#EA580C', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#9A3412' }}>
                      PDF attachment will be included
                    </div>
                    <div style={{ fontSize: 12, color: '#C2410C', marginTop: 2, wordBreak: 'break-all' }}>
                      {`devndespro-seo-audit-${(() => {
                        try {
                          return new URL(siteUrl || auditData?.url || '')
                            .hostname
                            .replace(/^www\./, '')
                        } catch {
                          return siteName || 'report'
                        }
                      })()}.pdf`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Modal>

          {/* Domain Rank + Link Score */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '1rem',
            padding: 'clamp(10px, 3vw, 14px) clamp(10px, 3vw, 16px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10, marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Domain Authority
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, maxWidth: 360 }}>
                  Domain Rank is an external DataForSEO score (DA-style; can look like Ahrefs DR, but is not Ahrefs). Link Score is our own composite from verified backlinks.
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={refreshAuthorityScore} disabled={refreshingAuthority}>
                <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6, animation: refreshingAuthority ? 'spin 1s linear infinite' : 'none' }} />
                <span className='btn-label'>{refreshingAuthority ? 'Calculating...' : 'Refresh Scores'}</span>
              </Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Domain Rank
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>
                  {domainRank ?? '-'}<span style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF' }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} title="Pulled from DataForSEO backlinks/summary rank (0–100). Not Moz DA or Ahrefs DR API — values can look similar to Ahrefs DR.">
                  Via DataForSEO · not Ahrefs/Moz
                </div>
              </div>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Link Score
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>
                  {authorityScore ?? '-'}<span style={{ fontSize: 14, fontWeight: 500, color: '#9CA3AF' }}>/100</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  Our composite · verified links
                </div>
              </div>
            </div>
            {authorityUpdatedAt && (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
                Updated: {new Date(authorityUpdatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
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
      <div
        ref={auditIssuesRef}
        aria-hidden="true"
        style={{ height: 0, scrollMarginTop: 88 }}
      />

      <TabBar tabs={tabOptions} active={activeTab} onChange={(id) => { setActiveTab(id); setExpandedIdx(null) }} />

      <div id="audit-section-issues" ref={issuesRef} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
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
    </div>
  )
}

