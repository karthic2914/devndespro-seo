import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolder, faChartBar, faWrench, faGear, faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Logo } from './UI'

const NAV = [
  { label: 'Projects', icon: faFolder,   active: true },
  { label: 'Reports',  icon: faChartBar },
  { label: 'Tools',    icon: faWrench },
  { label: 'Settings', icon: faGear },
]

export default function AppSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
        {NAV.map(item => (
          <div key={item.label} className={`nav-item${item.active ? ' active' : ''}`}>
            <span className="nav-item__icon">
              <FontAwesomeIcon icon={item.icon} />
            </span>
            {item.label}
          </div>
        ))}
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
