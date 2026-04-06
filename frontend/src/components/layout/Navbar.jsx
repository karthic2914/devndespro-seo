/**
 * Navbar — top navigation bar
 * Usage:
 *   <Navbar user={user} onSignOut={logout} onAddSite={() => setShowAdd(true)} activePage="Projects" />
 */
import { useState } from 'react'
import { Logo, Button, T } from '../UI'

const NAV_ITEMS = ['Projects', 'Reports', 'Tools', 'Settings']

export default function Navbar({ user, onSignOut, onAddSite, activePage = 'Projects', actions }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#fff',
      borderBottom: `1px solid ${T.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      height: 72,
      display: 'flex', alignItems: 'center',
      padding: '0 1.5rem',
      justifyContent: 'space-between',
      fontFamily: 'inherit',
    }}>

      {/* Left — logo + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Logo size="md" />

        <div style={{ display: 'flex', gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const isActive = activePage === item
            return (
              <button key={item} style={{
                background: isActive ? T.orangeDim : 'none',
                border: 'none', padding: '6px 14px', borderRadius: 6,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? T.orange : T.text2,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = T.surface2)}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'none')}
              >{item}</button>
            )
          })}
        </div>
      </div>

      {/* Right — actions + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Custom actions slot */}
        {actions}

        {onAddSite && (
          <Button variant="primary" size="sm" icon="+" onClick={onAddSite}>
            Add Site
          </Button>
        )}

        <div style={{ width: 1, height: 22, background: T.border }} />

        {/* User avatar + info */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <div
              onClick={() => setMenuOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {user.photo
                ? <img src={user.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${T.border}` }} />
                : <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.orangeDim, color: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{user.name?.[0]}</div>
              }
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{user.name}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{user.email}</div>
              </div>
              <span style={{ fontSize: 10, color: T.muted, marginLeft: 2 }}>▾</span>
            </div>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: '#fff', border: `1px solid ${T.border}`,
                borderRadius: 10, boxShadow: T.shadowMd,
                minWidth: 180, zIndex: 200,
                padding: '6px',
                animation: 'fadeIn 0.15s ease',
              }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{user.email}</div>
                </div>
                {[
                  { label: '⚙️  Settings', action: null },
                  { label: '📊  My Sites', action: null },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '8px 12px', borderRadius: 6, fontSize: 13, color: T.text2,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >{item.label}</button>
                ))}
                <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 4 }}>
                  <button onClick={onSignOut} style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '8px 12px', borderRadius: 6, fontSize: 13, color: T.red,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = T.redDim}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >🚪  Sign out</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
