import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MARKETING_NAV } from '../../data/marketingPages'
import BackToTop from './BackToTop'
import '../../styles/landing-radar.css'
import '../../styles/marketing.css'

const NAV = [
  { to: '/platform', label: 'Platform' },
  { to: '/features', label: 'Features' },
  { to: '/ai-visibility', label: 'AI Visibility' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
]

export default function MarketingLayout({ children, activePath = '' }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')

  return (
    <div className="dd-landing">
      <nav className="dd-nav" aria-label="Primary">
        <div className="dd-container dd-nav-inner">
          <Link className="dd-logo" to="/" aria-label="DevnDespro SEO home">
            <span className="dd-logo-mark" aria-hidden />
            DevnDespro SEO
          </Link>

          <div className="dd-nav-links">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                style={activePath === item.to ? { color: '#ecf5f2' } : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="dd-nav-actions">
            <button type="button" className="dd-btn dd-btn-secondary" onClick={goLogin}>
              Sign in
            </button>
            <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
              Start free audit →
            </button>
            <button
              type="button"
              className="dd-mobile-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        <div className={`dd-container dd-mobile-menu${menuOpen ? ' is-open' : ''}`}>
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            className="dd-btn dd-btn-primary"
            onClick={() => {
              setMenuOpen(false)
              goLogin()
            }}
          >
            Start free audit →
          </button>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="dd-footer">
        <div className="dd-container dd-footer-inner">
          <div>© {new Date().getFullYear()} DevnDespro · Stavanger, Norway</div>
          <div className="dd-footer-links">
            {MARKETING_NAV.map((item) => (
              <Link key={item.path} to={item.path}>
                {item.label}
              </Link>
            ))}
            <a href="https://www.devndespro.com/" target="_blank" rel="noreferrer">
              Company
            </a>
          </div>
        </div>
      </footer>

      <BackToTop />
    </div>
  )
}
