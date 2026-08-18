import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import { Logo } from '../UI'
import { MARKETING_NAV } from '../../data/marketingPages'
import '../../styles/marketing.css'

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"

export default function MarketingLayout({ children, activePath = '' }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')

  return (
    <div
      className="premium-landing-page"
      style={{
        minHeight: '100vh',
        background: '#FBFAF8',
        color: '#171923',
        fontFamily: 'inherit',
        overflowX: 'hidden',
        position: 'relative',
        width: '100%',
        paddingTop: 72,
      }}
    >
      <header className="landing-site-header">
        <div className="landing-site-header-inner">
          <Link to="/" className="landing-site-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Logo size="md" variant="transparent" />
          </Link>

          <nav className="landing-desktop-nav" aria-label="Marketing navigation">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`landing-nav-item ${activePath === item.path ? 'is-active' : ''}`}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="landing-header-actions">
            <button type="button" className="landing-signin-button" onClick={goLogin}>
              Sign in
            </button>
            <button type="button" className="landing-start-button" onClick={goLogin}>
              Start free audit
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button
              type="button"
              className="landing-menu-button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <FontAwesomeIcon icon={menuOpen ? faXmark : faBars} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="landing-mobile-menu">
            <nav aria-label="Mobile marketing navigation">
              {MARKETING_NAV.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`landing-mobile-nav-item ${activePath === item.path ? 'is-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              className="landing-mobile-start-button"
              onClick={() => {
                setMenuOpen(false)
                goLogin()
              }}
            >
              Start free audit
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        )}
      </header>

      <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>

      <footer style={{ borderTop: '1px solid #E4E1DB', padding: '36px 0 42px', marginTop: 40 }}>
        <div
          style={{
            width: '100%',
            maxWidth: 1180,
            margin: '0 auto',
            padding: '0 24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 24,
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 28,
            }}
          >
            <div>
              <Logo size="sm" variant="transparent" />
              <p style={{ margin: '12px 0 0', color: '#888A91', fontSize: 12, maxWidth: 320, lineHeight: 1.6 }}>
                SEO site audits, keywords, backlinks and AI visibility for Nordic teams.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 22px', maxWidth: 520 }}>
              {[...MARKETING_NAV, { path: '/keyword-tracking', label: 'Keywords' }, { path: '/backlink-monitoring', label: 'Backlinks' }].map(
                (item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    style={{ color: '#5B5E68', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </div>
          </div>
          <p style={{ margin: 0, color: '#888A91', fontSize: 12, fontFamily: monoFont }}>
            (c) {new Date().getFullYear()} Devndespro. Built in Stavanger, Norway.
          </p>
        </div>
      </footer>
    </div>
  )
}

export { monoFont }
