import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass,
  faBolt,
  faPenToSquare,
  faArrowsRotate,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faGears,
  faFileLines,
  faChevronDown,
  faChevronRight,
  faLightbulb,
  faClock,
  faPlay,
  faExternalLink,
} from '@fortawesome/free-solid-svg-icons'
import { Card, Badge, Button, SectionLabel, T } from '../components/UI'
import api from '../utils/api'

const CAT_CONFIG = {
  'On-Page SEO':    { icon: faMagnifyingGlass, color: T.orange },
  'Technical SEO':  { icon: faGears,           color: T.blue   },
  'Content Quality':{ icon: faFileLines,        color: T.amber  },
  'Page Speed':     { icon: faBolt,             color: T.green  },
}

function groupByCategory(checks) {
  const map = {}
  for (const c of checks) {
    const cat = c.category || 'On-Page SEO'
    if (!map[cat]) map[cat] = []
    map[cat].push(c)
  }
  return Object.entries(CAT_CONFIG).map(([name, cfg]) => {
    const issues = map[name] || []
    const passed = issues.filter(i => i.status === 'pass').length
    const total = issues.length
    const score = total === 0 ? null : Math.round(
      issues.reduce((s, i) => s + (i.status === 'pass' ? 100 : i.status === 'warning' ? 55 : 15), 0) / total
    )
    return { name, ...cfg, id: name.toLowerCase().replace(/\s+/g, '_'), issues, score, passed, total }
  }).filter(cat => cat.total > 0)
}

function scoreColor(s) { return s >= 80 ? T.green : s >= 55 ? T.amber : T.red }
function scoreBg(s)    { return s >= 80 ? T.greenDim : s >= 55 ? T.amberDim : T.redDim }

function ScoreRing({ score, size = 80 }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = scoreColor(score)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--dark3)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fill: color, fontSize: size * 0.28, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: 'inherit' }}>
        {score}
      </text>
    </svg>
  )
}

function issueIcon(status) {
  if (status === 'pass') return { icon: faCircleCheck, color: T.green }
  if (status === 'error') return { icon: faCircleXmark, color: T.red }
  return { icon: faTriangleExclamation, color: T.amber }
}

function IssueRow({ issue, idx, expanded, onToggle }) {
  const { icon, color } = issueIcon(issue.status)
  return (
    <div style={{ borderBottom: `1px solid var(--dark3)` }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          cursor: 'pointer', background: expanded ? 'var(--dark2)' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => !expanded && (e.currentTarget.style.background = 'var(--dark2)')}
        onMouseLeave={e => !expanded && (e.currentTarget.style.background = 'transparent')}
      >
        <FontAwesomeIcon icon={icon} style={{ color, flexShrink: 0, fontSize: 14 }} />
        <div style={{ flex: 1, fontSize: 13, color: T.text }}>{issue.message}</div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
          background: issue.impact === 'High' ? T.redDim : issue.impact === 'Medium' ? T.amberDim : 'var(--dark3)',
          color: issue.impact === 'High' ? T.red : issue.impact === 'Medium' ? T.amber : T.muted,
        }}>{issue.impact}</span>
        <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} style={{ color: T.muted, fontSize: 11, flexShrink: 0 }} />
      </div>
      {expanded && (
        <div style={{ padding: '8px 14px 12px 38px', background: 'var(--dark2)', borderTop: `1px solid var(--dark3)` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <FontAwesomeIcon icon={faLightbulb} style={{ color: T.amber, marginTop: 2, fontSize: 13, flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: T.text2, lineHeight: 1.6, margin: 0 }}>
              {issue.status === 'pass' ? 'This check passed. Keep monitoring to ensure it stays compliant.'
                : issue.status === 'error' ? 'This is a critical issue that should be fixed as soon as possible.'
                : 'This is a warning. Fixing it will improve your SEO score.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SiteAudit() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const [auditData, setAuditData] = useState(null)    // null = not yet run
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [expandedIdx, setExpandedIdx] = useState(null)

  useEffect(() => {
    api.get(`/sites/${siteId}/audit/latest`)
      .then(r => { if (r.data) setAuditData(r.data) })
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [siteId])

  async function runAudit() {
    setRunning(true)
    setRunError(null)
    try {
      const r = await api.post(`/sites/${siteId}/audit/run`)
      setAuditData(r.data)
      setActiveTab('all')
      setExpandedIdx(null)
    } catch (e) {
      setRunError(e.response?.data?.error || 'Audit failed - check the site URL is accessible')
    }
    setRunning(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: T.muted, fontSize: 14 }}>
        <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 10, opacity: 0.5 }} />Loading audit data...
      </div>
    )
  }

  // â”€â”€ Empty state â”€â”€
  if (!auditData) {
    return (
      <div style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>Site Audit</h1>
        </div>
        <div style={{ background: 'var(--dark2)', borderRadius: 16, border: `1px solid var(--dark3)`, padding: '4rem 2rem', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: '0 0 8px' }}>No audit run yet</h2>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: '0 0 24px' }}>
            Run your first site audit to get a real-time health check - title tags, meta descriptions, H1s, canonical URLs, viewport, structured data, and more.
          </p>
          {runError && <p style={{ fontSize: 12, color: T.red, background: T.redDim, padding: '8px 12px', borderRadius: 7, marginBottom: 16 }}>{runError}</p>}
          <Button variant="primary" onClick={runAudit} disabled={running}>
            <FontAwesomeIcon icon={running ? faArrowsRotate : faPlay} style={{ marginRight: 8, animation: running ? 'spin 1s linear infinite' : 'none' }} />
            {running ? 'Scanning your site...' : 'Run First Audit'}
          </Button>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  // â”€â”€ Has data â”€â”€
  const categories = groupByCategory(auditData.checks || [])
  const allIssues = (auditData.checks || []).map((issue, i) => ({ ...issue, _idx: i }))
  const errorCount = allIssues.filter(i => i.status === 'error').length
  const warnCount  = allIssues.filter(i => i.status === 'warning').length
  const passCount  = allIssues.filter(i => i.status === 'pass').length

  const tabOptions = [
    { id: 'all', label: 'All Issues' },
    ...categories.map(c => ({ id: c.id, label: c.name })),
  ]

  const visibleIssues = activeTab === 'all'
    ? allIssues
    : allIssues.filter(i => (i.category || 'On-Page SEO').toLowerCase().replace(/\s+/g, '_') === activeTab)

  const scannedDate = auditData.scannedAt
    ? new Date(auditData.scannedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown'

  return (
    <div style={{ padding: '1.5rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>Site Audit</h1>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FontAwesomeIcon icon={faClock} />Last scanned: {scannedDate}
            {auditData.url && (
              <a href={auditData.url} target="_blank" rel="noopener noreferrer" style={{ color: T.blue, textDecoration: 'none', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <FontAwesomeIcon icon={faExternalLink} style={{ fontSize: 10 }} />{auditData.url}
              </a>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/site/${siteId}/actions`)}>
            <FontAwesomeIcon icon={faPenToSquare} style={{ marginRight: 6 }} />Fix in Actions
          </Button>
          <Button variant="primary" size="sm" onClick={runAudit} disabled={running}>
            <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6, animation: running ? 'spin 1s linear infinite' : 'none' }} />
            {running ? 'Scanning...' : 'Re-run Audit'}
          </Button>
        </div>
      </div>

      {runError && (
        <div style={{ background: T.redDim, color: T.red, border: `1px solid ${T.red}40`, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: '1rem' }}>
          {runError}
        </div>
      )}

      {/* Score banner */}
      <div style={{ background: 'var(--dark2)', borderRadius: 12, border: `1px solid var(--dark3)`, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <ScoreRing score={auditData.score || 0} size={88} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginBottom: 4 }}>Overall Health Score</div>
            <div style={{ fontSize: 13, color: T.muted }}>{errorCount} critical Â· {warnCount} warnings Â· {passCount} passed</div>
          </div>
        </div>
        <div style={{ width: 1, height: 60, background: 'var(--dark3)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
          {categories.map(cat => cat.score !== null && (
            <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 120 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: scoreBg(cat.score), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={cat.icon} style={{ color: cat.color, fontSize: 15 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.muted }}>{cat.name}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: scoreColor(cat.score) }}>{cat.score}</div>
              </div>
            </div>
          ))}
          {auditData.speed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 120 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: scoreBg(auditData.speed.performance), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FontAwesomeIcon icon={faBolt} style={{ color: scoreColor(auditData.speed.performance), fontSize: 15 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.muted }}>PageSpeed</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: scoreColor(auditData.speed.performance) }}>{auditData.speed.performance}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PageSpeed details */}
      {auditData.speed && (
        <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'LCP', value: auditData.speed.lcp, good: '< 2.5s' },
            { label: 'CLS', value: auditData.speed.cls, good: '< 0.1' },
            { label: 'TBT', value: auditData.speed.tbt, good: '< 200ms' },
          ].map(m => m.value && (
            <div key={m.label} style={{ background: 'var(--dark2)', borderRadius: 8, border: `1px solid var(--dark3)`, padding: '10px 14px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: T.muted }}>{m.label} <span style={{ fontSize: 10, opacity: 0.7 }}>({m.good})</span></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginTop: 2, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', background: 'var(--dark2)', padding: 4, borderRadius: 9, border: `1px solid var(--dark3)`, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabOptions.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background: activeTab === tab.id ? '#fff' : 'transparent',
            border: 'none', padding: '5px 14px', borderRadius: 6, fontSize: 12,
            fontWeight: activeTab === tab.id ? 600 : 400,
            color: activeTab === tab.id ? T.text : T.muted,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Issues list */}
      <div style={{ background: 'var(--dark2)', borderRadius: 10, border: `1px solid var(--dark3)`, overflow: 'hidden' }}>
        {visibleIssues.length === 0
          ? <div style={{ padding: '2rem', textAlign: 'center', color: T.muted, fontSize: 13 }}>No issues for this category.</div>
          : visibleIssues.map((issue, idx) => (
            <IssueRow
              key={issue._idx}
              issue={issue}
              idx={issue._idx}
              expanded={expandedIdx === issue._idx}
              onToggle={() => setExpandedIdx(expandedIdx === issue._idx ? null : issue._idx)}
            />
          ))
        }
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

