import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartSimple, faKey, faLink, faMagnifyingGlass, faListCheck,
  faRobot, faWandMagicSparkles, faUsers, faChevronLeft, faChevronRight,
  faArrowLeft, faRightFromBracket, faBell, faPlug, faEnvelope,
  faPaperPlane, faUserGroup, faLock,
} from '@fortawesome/free-solid-svg-icons'
import { Logo } from '../components/UI'
import api from '../utils/api'
import UsageBar from './UsageBar'
import SiteFavicon from './SiteFavicon'
import ScoreInfoTip from './ScoreInfoTip'
import { canUseBacklinks, canUseAiAssistant, canUseColdEmails } from '../utils/features'

const NAV = [
  { to: '',              label: 'Overview',      icon: faChartSimple,      end: true },
  { to: 'keywords',      label: 'Keywords',      icon: faKey },
  { to: 'backlinks',     label: 'Backlinks',     icon: faLink, feature: 'backlinks', module: 'backlinks' },
  { to: 'audit',         label: 'Site Audit',    icon: faMagnifyingGlass },
  { to: 'actions',       label: 'Action Plan',   icon: faListCheck },
  // Hidden for now - re-enable by removing `hidden: true` (Admin Modules also controls visibility)
  { to: 'ai',            label: 'AI Assistant',  icon: faRobot, feature: 'ai_assistant', module: 'ai_assistant', hidden: true },
  { to: 'ai-visibility', label: 'AI Visibility', icon: faWandMagicSparkles, module: 'ai_visibility' },
  { to: 'integrations',  label: 'Integrations',  icon: faPlug },
  { to: 'email-reports', label: 'Email Reports', icon: faEnvelope, module: 'email_reports' },
  { to: 'cold-emails',   label: 'Cold Email',    icon: faPaperPlane, module: 'cold_emails' },
  { to: 'competitors',   label: 'Competitors',   icon: faUsers, module: 'competitors' },
  { to: 'alerts',        label: 'Alerts',        icon: faBell },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { siteId } = useParams()
  const location = useLocation()
  // Process pages render AppProcessTopBar (process + compact usage) themselves
  const pageKey = (() => {
    const m = location.pathname.match(/\/site\/[^/]+(?:\/([^/]+))?\/?$/)
    return m ? (m[1] || '') : null
  })()
  const PROCESS_TOPBAR_PAGES = new Set([
    '', // overview
    'keywords',
    'backlinks',
    'audit',
    'actions',
    'ai-visibility',
    'competitors',
  ])
  const hideGlobalUsageBar = pageKey !== null && PROCESS_TOPBAR_PAGES.has(pageKey)
  const [site, setSite] = useState(null)
  const [siteHealth, setSiteHealth] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [modules, setModules] = useState({
    backlinks: true,
    ai_assistant: false,
    ai_visibility: true,
    cold_emails: true,
    competitors: true,
    email_reports: true,
  })

  useEffect(() => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))

    api.get(`/sites/${siteId}`)
      .then((r) => {
        if (r.data) {
          setSite(r.data)
          if (r.data.health != null) setSiteHealth(Number(r.data.health))
        }
      })
      .catch(() => {})

    // Prefer full-site audit health when available (same source as Overview)
    Promise.all([
      api.get(`/sites/${siteId}/audit/multipage-latest`).catch(() => null),
      api.get(`/sites/${siteId}/metrics`).catch(() => null),
    ]).then(([mpRes, metricsRes]) => {
      const mp = mpRes?.data
      const mpHealth = mp?.status === 'complete'
        ? Number(mp.site_health_pct ?? mp.results?.siteHealthPct)
        : NaN
      if (Number.isFinite(mpHealth)) {
        setSiteHealth(mpHealth)
        return
      }
      const mHealth = Number(metricsRes?.data?.health)
      if (Number.isFinite(mHealth)) setSiteHealth(mHealth)
    })

    api.get(`/sites/${siteId}/alerts`)
      .then(r => setUnreadAlerts((r.data || []).filter(a => !a.read).length))
      .catch(() => {})
    api.get('/settings/modules')
      .then(r => setModules(prev => ({ ...prev, ...(r.data || {}) })))
      .catch(() => {})
  }, [siteId])

  // Keep sidebar health in sync when Overview/Action Plan bumps it
  useEffect(() => {
    const onHealth = (e) => {
      const next = Number(e?.detail?.health)
      if (Number.isFinite(next)) setSiteHealth(next)
    }
    window.addEventListener('site-health-updated', onHealth)
    return () => window.removeEventListener('site-health-updated', onHealth)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const visibleNav = NAV.filter(item => {
    if (item.hidden) return false
    if (item.module && modules[item.module] === false) return false
    return true
  })

  return (
    <div className="app-shell">

      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMobileOpen(p => !p)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <Logo size="sm" />
        <div style={{ width: 40 }} />
      </div>

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--open' : ''}`}>

        <div className="sidebar__header">
          {!collapsed && <Logo size="md" />}
          <button className="sidebar__collapse-btn" onClick={() => setCollapsed(p => !p)}>
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>
        </div>

        {!collapsed && site && (
          <div className="sidebar__site-section">
            <div className="label-xs mb-8">Active Project</div>
            <div className="site-card">
              <div className="site-card__row">
                <SiteFavicon name={site.name} url={site.url} size={28} radius={7} />
                <div className="site-card__info">
                  <div className="site-card__name">{site.name}</div>
                  <div className="site-card__url">{site.url}</div>
                </div>
              </div>
              <button
                type="button"
                className="site-card__health"
                onClick={() => navigate(`/site/${siteId}/audit`)}
              >
                {(() => {
                  const score = siteHealth != null && Number.isFinite(Number(siteHealth))
                    ? Math.round(Number(siteHealth))
                    : null
                  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0
                  const barColor =
                    score == null ? '#CBD5E1'
                    : score >= 80 ? '#16A34A'
                    : score >= 60 ? '#EA580C'
                    : '#DC2626'
                  return (
                    <>
                      <div className="site-card__health-top">
                        <span className="site-card__health-label score-label-with-tip">
                          Site Health
                          <ScoreInfoTip scoreKey="siteHealth" asSpan />
                        </span>
                        <span className="site-card__health-value" style={{ color: barColor }}>
                          {score != null ? score : '-'}
                          {score != null ? <span className="site-card__health-max">/100</span> : null}
                        </span>
                      </div>
                      <div className="site-card__health-track" aria-hidden>
                        <div
                          className="site-card__health-fill"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                    </>
                  )
                })()}
              </button>
            </div>
            <button className="sidebar__back-btn" onClick={() => navigate('/')}>
              <FontAwesomeIcon icon={faArrowLeft} /> All Projects
            </button>
          </div>
        )}

        {collapsed && site && (
          <div className="site-dot-section">
            <div className="site-dot" title={site.name}>{site.name?.[0]?.toUpperCase()}</div>
          </div>
        )}

        <nav className="sidebar__nav">
          {visibleNav.map(({ to, label, icon, end, feature }) => {
            if (to === 'cold-emails' && Number(site?.user_id) !== Number(user?.id)) {
              return null
            }

            const locked = feature === 'backlinks'
              ? !canUseBacklinks(user)
              : feature === 'ai_assistant'
              ? !canUseAiAssistant(user)
              : to === 'cold-emails'
              ? !canUseColdEmails(user)
              : false

            if (locked) {
              return (
                <div
                  key={to}
                  className="nav-item nav-item--locked"
                  title={to === 'cold-emails' ? 'Agency plan required' : 'Locked - unlock after payment or ask admin'}
                  aria-disabled="true"
                >
                  <span className="nav-item__icon">
                    <FontAwesomeIcon icon={icon} />
                  </span>
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1 }}>{label}</span>
                      <FontAwesomeIcon icon={faLock} style={{ fontSize: 11, opacity: 0.7 }} />
                    </>
                  )}
                  {collapsed && <span className="nav-tooltip">{label} (Locked)</span>}
                </div>
              )
            }

            return (
              <NavLink
                key={to}
                to={`/site/${siteId}${to ? '/' + to : ''}`}
                end={end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="nav-item__icon">
                  <FontAwesomeIcon icon={icon} />
                  {to === 'alerts' && unreadAlerts > 0 && (
                    <span className="nav-badge">{unreadAlerts > 9 ? '9+' : unreadAlerts}</span>
                  )}
                </span>
                {!collapsed && label}
                {!collapsed && to === 'alerts' && unreadAlerts > 0 && (
                  <span className="nav-count">{unreadAlerts}</span>
                )}
                {collapsed && <span className="nav-tooltip">{label}</span>}
              </NavLink>
            )
          })}

          {user?.email === 'karthic2914@gmail.com' && (
            <NavLink
              to={`/site/${siteId}/users`}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-item__icon"><FontAwesomeIcon icon={faUserGroup} /></span>
              {!collapsed && 'Users'}
              {collapsed && <span className="nav-tooltip">Users</span>}
            </NavLink>
          )}
        </nav>

        <div className="sidebar__footer">
          {!collapsed && user && (
            <div className="user-row">
              {user.photo
                ? <img src={user.photo} alt="" className="user-avatar" />
                : <div className="user-avatar user-avatar--init">{user.name?.[0]}</div>
              }
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout}>
            <FontAwesomeIcon icon={faRightFromBracket} />
            {!collapsed && 'Sign out'}
          </button>
        </div>

      </aside>

      <div className="app-main">
        {!hideGlobalUsageBar && <UsageBar />}
        <Outlet />
      </div>

    </div>
  )
}
