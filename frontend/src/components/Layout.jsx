import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartSimple,
  faKey,
  faLink,
  faMagnifyingGlass,
  faListCheck,
  faRobot,
  faUsers,
  faChevronLeft,
  faChevronRight,
  faArrowLeft,
  faRightFromBracket,
  faBell,
  faPlug,
  faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, ProgressBar } from '../components/UI'
import api from '../utils/api'

const NAV = [
  { to: '',            label: 'Overview',     icon: faChartSimple, end: true },
  { to: 'keywords',    label: 'Keywords',     icon: faKey },
  { to: 'backlinks',   label: 'Backlinks',    icon: faLink },
  { to: 'audit',       label: 'Site Audit',   icon: faMagnifyingGlass },
  { to: 'actions',     label: 'Action Plan',  icon: faListCheck },
  { to: 'ai',          label: 'AI Assistant', icon: faRobot },
  { to: 'integrations',   label: 'Integrations',  icon: faPlug },
  { to: 'email-reports',   label: 'Email Reports', icon: faEnvelope },
  { to: 'competitors',     label: 'Competitors',   icon: faUsers },
  { to: 'alerts',          label: 'Alerts',        icon: faBell },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { siteId } = useParams()
  const [site, setSite] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))
    api.get(`/sites/${siteId}/alerts`)
      .then(r => setUnreadAlerts((r.data || []).filter(a => !a.read).length))
      .catch(() => {})
  }, [siteId])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-shell">

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>

        {/* Logo + collapse */}
        <div className="sidebar__header">
          {!collapsed && <Logo size="md" />}
          <button className="sidebar__collapse-btn" onClick={() => setCollapsed(p => !p)}>
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>
        </div>

        {/* Active site card */}
        {!collapsed && site && (
          <div className="sidebar__site-section">
            <div className="label-xs mb-8">Active Project</div>
            <div className="site-card">
              <div className="site-card__row">
                <div className="site-card__avatar">{site.name?.[0]?.toUpperCase()}</div>
                <div className="site-card__info">
                  <div className="site-card__name">{site.name}</div>
                  <div className="site-card__url">{site.url}</div>
                </div>
              </div>
              <div className="site-card__da">DA 0 / 20 goal</div>
              <ProgressBar value={0} max={20} height={3} />
            </div>
            <button className="sidebar__back-btn" onClick={() => navigate('/')}>
              <FontAwesomeIcon icon={faArrowLeft} />All Projects
            </button>
          </div>
        )}

        {/* Collapsed site dot */}
        {collapsed && site && (
          <div className="site-dot-section">
            <div className="site-dot" title={site.name}>{site.name?.[0]?.toUpperCase()}</div>
          </div>
        )}

        {/* Nav links */}
        <nav className="sidebar__nav">
          {/* Nav links */}
          <nav className="sidebar__nav">
            {NAV.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={`/site/${siteId}${to ? '/' + to : ''}`}
                end={end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
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
            ))}

            {/* Admin-only: Users */}
            {user?.email === 'karthic2914@gmail.com' && (
              <NavLink
                to={`/site/${siteId}/users`}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-item__icon">
                  <FontAwesomeIcon icon={faUserGroup} />
                </span>
                {!collapsed && 'Users'}
                {collapsed && <span className="nav-tooltip">Users</span>}
              </NavLink>
            )}
          </nav>
        </nav>

        {/* User footer */}
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

      {/* â”€â”€ Main â”€â”€ */}
      <div className="app-main">
        <Outlet />
      </div>

    </div>
  )
}

