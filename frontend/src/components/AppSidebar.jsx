import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faChartBar, faWrench, faGear, faRightFromBracket, faUsers } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { useNavigate, useLocation } from 'react-router-dom'
import { Logo } from './UI'

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

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <Logo size="sm" />
      </div>

      <nav className="sidebar__nav">
        {NAV.filter(item => !item.adminOnly || user?.id === 1).map(item => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          return (
            <div
              key={item.label}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
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
  )
}