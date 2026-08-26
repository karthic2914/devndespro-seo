import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowsRotate,
  faMagnifyingGlassChart,
  faBullseye,
  faHandPointer,
  faEye,
  faLocationDot,
  faKey,
  faChevronRight,
  faChevronDown,
  faChartColumn,
  faShieldHalved,
  faMagnifyingGlass,
  faListCheck,
  faEllipsisVertical,
  faLink,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import './MobileProjectOverview.css'
import SiteHealthGauge from '../../components/SiteHealthGauge'

const impactClass = (impact) => {
  const value = String(impact || 'medium').toLowerCase()
  if (value === 'critical' || value === 'high') return 'is-high'
  if (value === 'low') return 'is-low'
  return 'is-medium'
}

const projectImages = (site, domain) => {
  const candidates = [
    site?.favicon_url,
    site?.faviconUrl,
    site?.favicon,
    site?.logo_url,
    site?.logoUrl,
    site?.logo,
    site?.icon_url,
    site?.iconUrl,
    site?.icon,
    site?.image_url,
    site?.image,
    domain ? `https://${domain}/favicon.ico` : null,
    domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      : null,
  ]

  return [...new Set(candidates.filter(Boolean))]
}

const projectDomain = (site) => {
  const raw = site?.url || site?.domain || site?.website || ''
  if (!raw) return ''
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname
  } catch {
    return String(raw).replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
}

export default function MobileProjectOverview({
  site,
  siteId,
  healthValue,
  previewAuditScores,
  gscClicks,
  gscImpressions,
  gscPosition,
  gscSubLabel,
  trackedKeywords,
  overviewRecommendation,
  nextMoveMeta,
  nextMoveImpactColor,
  pendingCount,
  fixItems,
  previewKeywords,
  keywords,
  auditRunning,
  onRefresh,
  onRunAudit,
  onRunFullAudit,
  canRunFullAudit,
  onNextMove,
  latestAudit,
  multipageLatest,
}) {
  const navigate = useNavigate()
  const [gscOpen, setGscOpen] = useState(false)
  const [auditOptionsOpen, setAuditOptionsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileAuditMenuOpen, setMobileAuditMenuOpen] = useState(false)

  useEffect(() => {
    document.body.classList.add('mobile-project-overview-active')
    return () => {
      document.body.classList.remove('mobile-project-overview-active')
    }
  }, [])

  const domain = projectDomain(site)
  const imageCandidates = useMemo(
    () => projectImages(site, domain),
    [site, domain]
  )
  const [imageIndex, setImageIndex] = useState(0)
  const image = imageCandidates[imageIndex] || null
  const projectName = site?.name || domain || 'Project'

  useEffect(() => {
    setImageIndex(0)
  }, [siteId, domain])

  const lastUpdated = useMemo(() => {
    const raw =
      multipageLatest?.completed_at ||
      multipageLatest?.updated_at ||
      latestAudit?.completed_at ||
      latestAudit?.updated_at ||
      null

    const date = raw ? new Date(raw) : new Date()
    if (Number.isNaN(date.getTime())) return 'Recently updated'

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [latestAudit, multipageLatest])

  const healthStatus =
    healthValue >= 90
      ? 'Excellent'
      : healthValue >= 80
      ? 'Strong'
      : healthValue >= 60
      ? 'Needs work'
      : 'Priority'

  const mobileScores = previewAuditScores.slice(0, 3)
  const mobileFixes = fixItems.slice(0, 3)
  const mobileKeywords = previewKeywords.slice(0, 4)

  return (
    <div className="mobile-project-overview">
      <header className="mpo-project-bar">
        <button
          type="button"
          className="mpo-icon-button mpo-back"
          onClick={() => {
            document.body.classList.remove('mobile-project-overview-active')
            navigate('/', { replace: true })
          }}
          aria-label="Back to projects"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>

        <div className="mpo-project-identity">
          <div className="mpo-project-logo">
            {image ? (
              <img
                key={image}
                src={image}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImageIndex((current) => current + 1)}
              />
            ) : (
              <span>{projectName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="mpo-project-copy">
            <strong>{projectName}</strong>
            <span>{domain}</span>
          </div>
        </div>

        <button
          type="button"
          className="mpo-icon-button"
          onClick={() => setMoreOpen(true)}
          aria-label="Project options"
        >
          <FontAwesomeIcon icon={faEllipsisVertical} />
        </button>
      </header>

      <main className="mpo-content">
        <section className="mpo-page-heading">
          <div>
            <h1>Overview</h1>
            <p>Updated {lastUpdated}</p>
          </div>
          <div className="mpo-heading-actions">
            <button
              type="button"
              className="mpo-icon-button mpo-refresh"
              onClick={onRefresh}
              aria-label="Refresh data"
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </button>
            <button
              type="button"
              className="mpo-primary-button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); setMobileAuditMenuOpen(true) }}
              disabled={auditRunning}
            >
              <FontAwesomeIcon icon={faMagnifyingGlassChart} />
              <span className="mpo-audit-trigger-label">
                {auditRunning ? 'Scanning...' : 'Run audit'}
              </span>
              {!auditRunning ? (
                <span className="mpo-audit-trigger-chevron" aria-hidden="true">
                  <FontAwesomeIcon icon={faChevronDown} />
                </span>
              ) : null}
            </button>
          </div>
        </section>

        <section className="mpo-card mpo-health-card">
          <div className="mpo-health-top">
            <div className="mpo-health-score">
              <span className="mpo-eyebrow">Site health</span>
              <div className="mpo-score-line">
                <strong>{healthValue}</strong>
                <span>/100</span>
              </div>
              <span className={`mpo-health-status health-${healthStatus.toLowerCase().replace(' ', '-')}`}>
                {healthStatus}
              </span>
            </div>

            <SiteHealthGauge
              value={healthValue}
              className="mpo-gauge"
            />          </div>

          <div className="mpo-score-bars">
            {mobileScores.length > 0 ? (
              mobileScores.map((score) => (
                <button
                  key={score.label}
                  type="button"
                  className="mpo-score-bar"
                  onClick={() =>
                    navigate(`/site/${siteId}/audit?category=${encodeURIComponent(score.label)}`)
                  }
                >
                  <span className="mpo-score-bar-label">
                    <span>{score.label}</span>
                    <strong style={{ color: score.color }}>{score.value}/100</strong>
                  </span>
                  <span className="mpo-score-track">
                    <span style={{ width: `${score.value}%`, background: score.color }} />
                  </span>
                </button>
              ))
            ) : (
              <p className="mpo-empty-copy">Run an audit to see category scores.</p>
            )}
          </div>

          <button
            type="button"
            className="mpo-text-action"
            onClick={() => navigate(`/site/${siteId}/audit`)}
          >
            View audit report <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </section>

        <section className="mpo-next-card">
          <div className="mpo-next-icon">
            <FontAwesomeIcon icon={faBullseye} />
          </div>
          <div className="mpo-next-copy">
            <span className="mpo-next-eyebrow">Next best move</span>
            <h2>{overviewRecommendation}</h2>
            <div className="mpo-next-meta">
              <span><i style={{ background: nextMoveImpactColor }} />{nextMoveMeta.impact} impact</span>
              <span><i className="is-green" />{nextMoveMeta.category}</span>
              <span>{nextMoveMeta.statusLabel}</span>
            </div>
          </div>
          <button type="button" className="mpo-next-action" onClick={onNextMove}>
            View action <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </section>

        <section>
          <h2 className="mpo-section-title">Performance</h2>
          <div className="mpo-metric-grid">
            <MetricCard icon={faHandPointer} tone="blue" label="GSC clicks" value={gscClicks} sub={gscSubLabel} />
            <MetricCard icon={faEye} tone="violet" label="Impressions" value={gscImpressions} sub={gscSubLabel} />
            <MetricCard icon={faLocationDot} tone="green" label="Avg. position" value={gscPosition} sub={gscSubLabel} />
            <MetricCard icon={faKey} tone="orange" label="Tracked keywords" value={trackedKeywords} sub="In DB" />
          </div>
        </section>

        <section className="mpo-card mpo-actions-card">
          <div className="mpo-card-header">
            <div className="mpo-title-with-icon">
              <span className="mpo-soft-icon"><FontAwesomeIcon icon={faListCheck} /></span>
              <div>
                <h2>Fix your website <em>{pendingCount || mobileFixes.length} important</em></h2>
                <p>Highest-impact issues first</p>
              </div>
            </div>
          </div>

          <div className="mpo-action-list">
            {mobileFixes.length > 0 ? (
              mobileFixes.map((action, index) => (
                <button
                  type="button"
                  className="mpo-action-row"
                  key={action.id || `${action.text}-${index}`}
                  onClick={() => navigate(`/site/${siteId}/actions`)}
                >
                  <span className="mpo-action-number">{index + 1}</span>
                  <span className="mpo-action-text">{action.text}</span>
                  <span className={`mpo-impact ${impactClass(action.impact)}`}>{action.impact || 'Medium'}</span>
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              ))
            ) : (
              <p className="mpo-empty-copy mpo-empty-actions">No open website fixes.</p>
            )}
          </div>

          <button
            type="button"
            className="mpo-wide-secondary"
            onClick={() => navigate(`/site/${siteId}/actions`)}
          >
            View full Action Plan
          </button>
        </section>

        <section className="mpo-card mpo-collapsible-card">
          <button type="button" className="mpo-collapse-button" onClick={() => setGscOpen((value) => !value)}>
            <strong>Search performance &amp; GSC</strong>
            <span className="mpo-period">Last 28 days</span>
            <FontAwesomeIcon icon={faChevronDown} className={gscOpen ? 'is-open' : ''} />
          </button>
          {gscOpen ? (
            <div className="mpo-gsc-detail">
              <strong>{gscClicks} clicks and {gscImpressions} impressions</strong>
              <span>{gscSubLabel}</span>
            </div>
          ) : null}
        </section>

        <section className="mpo-card mpo-keyword-card">
          <div className="mpo-simple-heading">
            <h2>Keyword rankings</h2>
            <button type="button" onClick={() => navigate(`/site/${siteId}/keywords`)}>
              View all <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>

          <div className="mpo-keyword-head">
            <span>Keyword</span><span>Pos.</span><span>Volume</span>
          </div>
          {mobileKeywords.length > 0 ? (
            mobileKeywords.map((keyword, index) => {
              const position = Number(keyword.position)
              return (
                <button
                  type="button"
                  className="mpo-keyword-row"
                  key={`${keyword.keyword}-${index}`}
                  onClick={() => navigate(`/site/${siteId}/keywords`)}
                >
                  <strong>{keyword.keyword}</strong>
                  <span>{Number.isFinite(position) && position > 0 ? `#${position}` : '-'}</span>
                  <span>{Number(keyword.volume || 0).toLocaleString()}</span>
                </button>
              )
            })
          ) : (
            <p className="mpo-empty-copy mpo-keyword-empty">No tracked keywords yet.</p>
          )}
          <div className="mpo-table-foot">Showing {Math.min(mobileKeywords.length, 4)} of {keywords.length} tracked keywords</div>
        </section>

        <section className="mpo-card mpo-grow-card">
          <div className="mpo-title-with-icon">
            <span className="mpo-soft-icon"><FontAwesomeIcon icon={faChartColumn} /></span>
            <div>
              <h2>Grow with backlinks &amp; AI Visibility</h2>
              <p>Build authority and get mentioned in AI answers.</p>
            </div>
          </div>
          <div className="mpo-grow-actions">
            <button type="button" onClick={() => navigate(`/site/${siteId}/backlinks`)}>
              <FontAwesomeIcon icon={faLink} /> Backlinks
            </button>
            <button type="button" onClick={() => navigate(`/site/${siteId}/ai-visibility`)}>
              <FontAwesomeIcon icon={faWandMagicSparkles} /> AI Visibility
            </button>
          </div>
        </section>
      </main>

      {auditOptionsOpen ? (
        <div
          className="mpo-more-layer"
          role="presentation"
          onClick={() => setAuditOptionsOpen(false)}
        >
          <section
            className="mpo-more-sheet mpo-audit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpo-audit-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mpo-sheet-handle" />
            <div className="mpo-audit-sheet-heading">
              <h2 id="mpo-audit-sheet-title">Choose audit type</h2>
              <p>Select how much of this website you want to scan.</p>
            </div>

            <div className="mpo-audit-options">
              <button
                type="button"
                onClick={() => {
                  setAuditOptionsOpen(false)
                  onRunAudit()
                }}
                disabled={auditRunning}
              >
                <span className="mpo-audit-option-icon">
                  <FontAwesomeIcon icon={faMagnifyingGlassChart} />
                </span>
                <span className="mpo-audit-option-copy">
                  <strong>Quick Audit</strong>
                  <small>Homepage only - a few seconds</small>
                </span>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!canRunFullAudit) return
                  setAuditOptionsOpen(false)
                  onRunFullAudit()
                }}
                disabled={!canRunFullAudit || auditRunning}
              >
                <span className="mpo-audit-option-icon is-full">
                  <FontAwesomeIcon icon={faListCheck} />
                </span>
                <span className="mpo-audit-option-copy">
                  <strong>Full Site Audit <em>BETA</em></strong>
                  <small>Up to 100 pages - watch progress in Site Audit</small>
                  {!canRunFullAudit ? <small className="mpo-audit-locked">Available to paid or authorised accounts</small> : null}
                </span>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>

            <button
              type="button"
              className="mpo-sheet-close"
              onClick={() => setAuditOptionsOpen(false)}
            >
              Cancel
            </button>
          </section>
        </div>
      ) : null}
      {/* DEVNDESPRO_MOBILE_AUDIT_PORTAL */}
      {mobileAuditMenuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="mpo-audit-portal-layer"
              role="presentation"
              onClick={() => setMobileAuditMenuOpen(false)}
            >
              <section
                className="mpo-audit-portal-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mpo-mobile-audit-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mpo-sheet-handle" />
                <header className="mpo-audit-portal-heading">
                  <h2 id="mpo-mobile-audit-title">Choose audit type</h2>
                  <p>Select how much of this website you want to scan.</p>
                </header>

                <div className="mpo-audit-portal-options">
                  <button
                    type="button"
                    disabled={auditRunning}
                    onClick={() => {
                      setMobileAuditMenuOpen(false)
                      onRunAudit()
                    }}
                  >
                    <span className="mpo-audit-portal-icon">
                      <FontAwesomeIcon icon={faMagnifyingGlassChart} />
                    </span>
                    <span className="mpo-audit-portal-copy">
                      <strong>Quick Audit</strong>
                      <small>Homepage only - a few seconds</small>
                    </span>
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>

                  <button
                    type="button"
                    disabled={!canRunFullAudit || auditRunning}
                    onClick={() => {
                      if (!canRunFullAudit) return
                      setMobileAuditMenuOpen(false)
                      onRunFullAudit()
                    }}
                  >
                    <span className="mpo-audit-portal-icon is-full">
                      <FontAwesomeIcon icon={faListCheck} />
                    </span>
                    <span className="mpo-audit-portal-copy">
                      <strong>Full Site Audit <em>BETA</em></strong>
                      <small>Up to 100 pages - watch progress in Site Audit</small>
                      {!canRunFullAudit ? (
                        <small className="is-locked">Paid or authorised accounts only</small>
                      ) : null}
                    </span>
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>

                <button
                  type="button"
                  className="mpo-audit-portal-cancel"
                  onClick={() => setMobileAuditMenuOpen(false)}
                >
                  Cancel
                </button>
              </section>
            </div>,
            document.body
          )
        : null}
      {moreOpen ? (
        <div className="mpo-more-layer" role="presentation" onClick={() => setMoreOpen(false)}>
          <section className="mpo-more-sheet" role="dialog" aria-modal="true" aria-label="More project options" onClick={(event) => event.stopPropagation()}>
            <div className="mpo-sheet-handle" />
            <div className="mpo-sheet-project">
              <div className="mpo-project-logo">
                {image ? <img src={image} alt="" /> : <span>{projectName.slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="mpo-project-copy"><strong>{projectName}</strong><span>{domain}</span></div>
            </div>
            <div className="mpo-sheet-links">
              <SheetLink label="Backlinks" onClick={() => navigate(`/site/${siteId}/backlinks`)} />
              <SheetLink label="AI Visibility" onClick={() => navigate(`/site/${siteId}/ai-visibility`)} />
              <SheetLink label="Integrations" onClick={() => navigate(`/site/${siteId}/integrations`)} />
              <SheetLink label="Email reports" onClick={() => navigate(`/site/${siteId}/email-reports`)} />
              <SheetLink label="Cold email" onClick={() => navigate(`/site/${siteId}/cold-emails`)} />
              <SheetLink label="Competitors" onClick={() => navigate(`/site/${siteId}/competitors`)} />
            </div>
            <button type="button" className="mpo-sheet-close" onClick={() => setMoreOpen(false)}>Close</button>
          </section>
        </div>
      ) : null}

      <nav className="mpo-bottom-nav" aria-label="Project navigation">
        <NavItem active icon={faChartColumn} label="Overview" onClick={() => navigate(`/site/${siteId}`)} />
        <NavItem icon={faShieldHalved} label="Audit" onClick={() => navigate(`/site/${siteId}/audit`)} />
        <NavItem icon={faMagnifyingGlass} label="Keywords" onClick={() => navigate(`/site/${siteId}/keywords`)} />
        <NavItem icon={faListCheck} label="Actions" onClick={() => navigate(`/site/${siteId}/actions`)} />
        <NavItem icon={faEllipsisVertical} label="More" onClick={() => setMoreOpen(true)} />
      </nav>
    </div>
  )
}

function MetricCard({ icon, tone, label, value, sub }) {
  return (
    <article className={`mpo-metric-card tone-${tone}`}>
      <div className="mpo-metric-heading">
        <span className="mpo-metric-icon"><FontAwesomeIcon icon={icon} /></span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <p>{sub}</p>
    </article>
  )
}

function NavItem({ active = false, icon, label, onClick }) {
  return (
    <button type="button" className={active ? 'is-active' : ''} onClick={onClick}>
      <FontAwesomeIcon icon={icon} />
      <span>{label}</span>
    </button>
  )
}

function SheetLink({ label, onClick }) {
  return (
    <button type="button" onClick={onClick}>
      <span>{label}</span>
      <FontAwesomeIcon icon={faChevronRight} />
    </button>
  )
}