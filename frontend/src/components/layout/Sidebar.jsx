/**
 * Sidebar — left navigation for site dashboard
 */
import { NavLink, useNavigate } from 'react-router-dom'
import { Logo, ProgressBar, T } from '../UI'

const NAV_ITEMS = [
  { path: '',            label: 'Overview',     icon: '▦',  end: true },
  { path: 'keywords',   label: 'Keywords',     icon: '🔑' },
  { path: 'backlinks',  label: 'Backlinks',    icon: '🔗' },
  { path: 'audit',      label: 'Site Audit',   icon: '🔍' },
  { path: 'actions',    label: 'Action Plan',  icon: '✅' },
  { path: 'ai',         label: 'AI Assistant', icon: '🤖' },
  { path: 'competitors',label: 'Competitors',  icon: '⚔️' },
  { path: 'rank',       label: 'Rank #1',      icon: '🏆' },
]

const ADMIN_EMAIL = 'karthic2914@gmail.com'

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8,
        color: isActive ? T.orange : T.text2,
        background: isActive ? T.orangeDim : 'transparent',
        fontSize: 13, fontWeight: isActive ? 600 : 400,
        textDecoration: 'none', transition: 'all 0.15s',
        borderLeft: `2px solid ${isActive ? T.orange : 'transparent'}`,
      })}
      onMouseEnter={e => {
        if (!e.currentTarget.style.borderLeftColor.includes('26'))
          e.currentTarget.style.background = T.surface2
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.style.borderLeftColor.includes('26'))
          e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</span>
      {label}
    </NavLink>
  )
}

export default function Sidebar({ siteId, site, user, onSignOut, daScore = 0, daGoal = 20 }) {
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#fff',
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      fontFamily: 'inherit',
    }}>

      {/* Logo */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
        <Logo size="md" />
      </div>

      {/* Active site info */}
      {site && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Active Project</div>
          <div style={{ background: T.surface2, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 26, height: 26, background: T.orangeDim, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, color: T.orange, flexShrink: 0,
              }}>{site.name?.[0]?.toUpperCase()}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</div>
                <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.url}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>DA {daScore} / {daGoal} goal</div>
            <ProgressBar value={daScore} max={daGoal} height={4} />
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: 8, width: '100%', background: 'none',
              border: `1px solid ${T.border}`, borderRadius: 6,
              padding: '5px 10px', fontSize: 11, color: T.text2,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text2 }}
          >← All Projects</button>
        </div>
      )}

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ path, label, icon, end }) => (
          <NavItem
            key={path}
            to={`/site/${siteId}${path ? '/' + path : ''}`}
            icon={icon}
            label={label}
            end={end}
          />
        ))}

        {/* Admin-only */}
        {user?.email === ADMIN_EMAIL && (
          <NavItem
            to={`/site/${siteId}/users`}
            icon="👥"
            label="Users"
          />
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px', borderTop: `1px solid ${T.border}` }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {user.photo
              ? <img src={user.photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              : <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.orangeDim, color: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{user.name?.[0]}</div>
            }
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}
        <button onClick={onSignOut} style={{
          width: '100%', background: T.surface2, border: `1px solid ${T.border}`,
          color: T.text2, padding: '6px 10px', borderRadius: 7,
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all 0.15s', textAlign: 'center',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = T.redDim; e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.red + '44' }}
          onMouseLeave={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.text2; e.currentTarget.style.borderColor = T.border }}
        >Sign out</button>
      </div>
    </aside>
  )
}