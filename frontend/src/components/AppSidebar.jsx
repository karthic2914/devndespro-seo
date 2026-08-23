import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faChartBar, faWrench, faGear, faRightFromBracket, faUsers } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, useLocation } from 'react-router-dom'
import { Logo } from './UI'
import { Capacitor } from '@capacitor/core'
const NAV = [
  { label: 'Projects', icon: faFolder,   path: '/',         adminOnly: false },
  { label: 'Reports',  icon: faChartBar, path: '/reports',  adminOnly: false },
  { label: 'Users',    icon: faUsers,    path: '/users',    adminOnly: true  },
  { label: 'Tools',    icon: faWrench,   path: '/tools',    adminOnly: false },
  { label: 'Settings', icon: faGear,     path: '/settings', adminOnly: false },
]
export default function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isNative = Capacitor.isNativePlatform()
  const visibleNav = NAV.filter(item => !item.adminOnly || user?.id === 1)
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (isNative) {
    return (
      <>
        <div className="mobile-topbar">
          <div style={{ width: 40 }} />
          <Logo size="sm" />
          <button className="hamburger-btn" onClick={handleLogout} aria-label="Sign out">
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </div>
        <nav className="bottom-tab-bar">
          {visibleNav.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            return (
              <div
                key={item.label}
                className={`bottom-tab-bar__item${isActive ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="bottom-tab-bar__icon">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <span className="bottom-tab-bar__label">{item.label}</span>
              </div>
            )
          })}
        </nav>
      </>
    )
  }

  return (
    <>
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setMobileOpen(p => !p)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <Logo size="sm" />
        <div style={{ width: 40 }} />
      </div>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <Logo size="sm" />
        </div>
        <nav className="sidebar__nav">
          {visibleNav.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
            return (
              <div
                key={item.label}
                className={`nav-item${isActive ? ' active' : ''}`}
                onClick={() => { navigate(item.path); setMobileOpen(false) }}
                style={{ cursor: 'pointer' }}
              >
                <span className="nav-item__icon">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                {item.label}
              </div>
            )
          })}
        </nav>
        <div className="sidebar__footer">
          {user && (
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
            <FontAwesomeIcon icon={faRightFromBracket} />Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
