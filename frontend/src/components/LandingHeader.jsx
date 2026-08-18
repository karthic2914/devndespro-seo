import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faXmark,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Logo } from './UI'
import { MARKETING_NAV } from '../data/marketingPages'

export default function LandingHeader({ onLogin, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <header className="landing-site-header">
      <div className="landing-site-header-inner">
        <Link to="/" className="landing-site-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Logo size="md" variant="transparent" />
        </Link>

        <nav className="landing-desktop-nav" aria-label="Main navigation">
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`landing-nav-item ${location.pathname === item.path ? 'is-active' : ''}`}
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="landing-header-actions">
          <button type="button" className="landing-signin-button" onClick={onLogin}>
            Sign in
          </button>

          <button type="button" className="landing-start-button" onClick={onStart}>
            Start free audit
            <FontAwesomeIcon icon={faArrowRight} />
          </button>

          <button
            type="button"
            className="landing-menu-button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <FontAwesomeIcon icon={menuOpen ? faXmark : faBars} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="landing-mobile-menu">
          <nav aria-label="Mobile main navigation">
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`landing-mobile-nav-item ${
                  location.pathname === item.path ? 'is-active' : ''
                }`}
                style={{ textDecoration: 'none' }}
                onClick={() => setMenuOpen(false)}
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
              onStart()
            }}
          >
            Start free audit
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      )}
    </header>
  )
}
