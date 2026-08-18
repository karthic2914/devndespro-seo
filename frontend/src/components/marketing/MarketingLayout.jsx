import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { MARKETING_NAV, PRIMARY_MARKETING_NAV } from '../../data/marketingPages'
import BackToTop from './BackToTop'
import '../../styles/landing-radar.css'
import '../../styles/marketing.css'

export default function MarketingLayout({ children }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')

  return (
    <div className="dd-landing">
      <nav className="dd-nav" aria-label="Primary">
        <div className="dd-container dd-nav-inner">
          <Link className="dd-brand" to="/" aria-label="DevnDespro Visibility home">
            <img
              src="/images/devndespro_seo_transparent.png"
              alt="DevnDespro SEO"
              className="dd-brand-logo"
            />
          </Link>

          <div className="dd-nav-links">
            {PRIMARY_MARKETING_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
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
          {PRIMARY_MARKETING_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
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
          <div>© {new Date().getFullYear()} DevnDespro Visibility</div>
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
