import { useAuth } from '../hooks/useAuth'
import AppSidebar from '../components/AppSidebar'
import AdminSettings from '../components/admin/AdminSettings'
import UserSettings from './UserSettings'

/**
 * Single "Settings" entry — backend/role decides which panel to show.
 * Admin → platform modules + controls
 * User → profile + preferences
 */
export default function Settings() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell">
        <AppSidebar />
        <div className="app-main">
          <div className="page-content" style={{ color: '#64748B', fontSize: 13 }}>Loading…</div>
        </div>
      </div>
    )
  }

  const isAdmin = Number(user?.id) === 1

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <div className="page-content fade-in">
          {isAdmin ? <AdminSettings /> : <UserSettings />}
        </div>
      </div>
    </div>
  )
}
