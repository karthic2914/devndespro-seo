/**
 * Sidebar - left navigation for site dashboard
 */
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { Logo, T } from '../UI'
import SiteFavicon from '../SiteFavicon'

const NAV_ITEMS = [
  { path: '', label: 'Overview', icon: '▦', end: true },
  { path: 'keywords', label: 'Keywords', icon: '🔑' },
  {
    path: 'backlinks',
    label: 'Backlinks',
    icon: '🔗',
    children: [
      { view: 'pulse', label: 'Pulse' },
      { view: 'tracked', label: 'Tracked links' },
      { view: 'health', label: 'Link health' },
      { view: 'dead', label: 'Dead targets' },
      { view: 'sources', label: 'Source sites' },
      { view: 'phrases', label: 'Link phrases' },
      { view: 'gaps', label: 'Growth gaps' },
    ],
  },
  { path: 'audit', label: 'Site Audit', icon: '🔍' },
  { path: 'actions', label: 'Action Plan', icon: '✅' },
  { path: 'ai-visibility', label: 'AI Visibility', faIcon: 'wand' },
  { path: 'competitors', label: 'Competitors', icon: '⚔️' },
  { path: 'rank', label: 'Rank #1', icon: '🏆' },
]

const ADMIN_EMAIL = 'karthic2914@gmail.com'

function NavItem({ to, icon, faIcon, label, end }) {
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
      <span style={{ width: 20, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>
        {faIcon === 'wand' ? <FontAwesomeIcon icon={faWandMagicSparkles} /> : icon}
      </span>
      {label}
    </NavLink>
  )
}

function BacklinksNavGroup({ siteId, item }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const base = `/site/${siteId}/backlinks`
  const onBacklinks = location.pathname.includes('/backlinks')
  const activeView = (() => {
    const raw = String(searchParams.get('view') || 'pulse').toLowerCase()
    if (raw === 'overview') return 'pulse'
    if (raw === 'gap') return 'gaps'
    if (raw === 'all') return 'tracked'
    if (['good', 'ok', 'risk', 'spam'].includes(raw)) return 'health'
    return raw
  })()

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        type="button"
        onClick={() => navigate(base)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 12px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          color: onBacklinks ? T.orange : T.text2,
          background: onBacklinks ? T.orangeDim : 'transparent',
          fontSize: 13,
          fontWeight: onBacklinks ? 600 : 400,
          borderLeft: `2px solid ${onBacklinks ? T.orange : 'transparent'}`,
        }}
      >
        <span style={{ width: 20, textAlign: 'center', fontSize: 15 }}>{item.icon}</span>
        <span style={{ flex: 1 }}>{item.label}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          style={{
            fontSize: 10,
            opacity: 0.7,
            transform: onBacklinks ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {onBacklinks && (
        <div style={{ padding: '2px 0 6px 18px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {item.children.map((child) => {
            const to = child.view === 'pulse' ? base : `${base}?view=${child.view}`
            const isActive = activeView === child.view

            return (
              <NavLink
                key={child.view}
                to={to}
                style={{
                  display: 'block',
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.orange : T.muted,
                  background: isActive ? T.orangeDim : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {child.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ siteId, site, user, onSignOut, healthScore = null }) {
  const navigate = useNavigate()
  const score = healthScore != null ? healthScore : (site?.health ?? null)

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: '#fff',
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      fontFamily: 'inherit',
    }}>

      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
        <Logo size="md" />
      </div>

      {site && (
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Active Project</div>
          <div style={{ background: T.surface2, borderRadius: 8, padding: '8px 10px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <SiteFavicon name={site.name} url={site.url} size={26} radius={6} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</div>
                <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.url}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/site/${siteId}/audit`)}
              title="Site Health from your latest audit"
              style={{
                fontSize: 10,
                color: T.muted,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Site Health {score != null ? Math.round(Number(score)) : 'N/A'}
              {score != null && '/100'}
            </button>
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

      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => (
          item.children ? (
            <BacklinksNavGroup key={item.path} siteId={siteId} item={item} />
          ) : (
            <NavItem
              key={item.path}
              to={`/site/${siteId}${item.path ? '/' + item.path : ''}`}
              icon={item.icon}
              faIcon={item.faIcon}
              label={item.label}
              end={item.end}
            />
          )
        ))}

        {user?.email === ADMIN_EMAIL && (
          <NavItem
            to={`/site/${siteId}/users`}
            icon="👥"
            label="Users"
          />
        )}
      </nav>

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
