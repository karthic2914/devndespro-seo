import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faXmark,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Logo } from './UI'
import { MARKETING_NAV } from '../data/marketingPages'

const HOME_SECTION_ITEMS = [
  { id: 'platform', label: 'Platform' },
  { id: 'how-it-works', label: 'How it works' },
]

export default function LandingHeader({ onLogin, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    if (!isHome) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible) {
          setActiveSection(visible.target.id)
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0.1, 0.25, 0.5],
      }
    )

    HOME_SECTION_ITEMS.forEach(({ id }) => {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [isHome])

  const goToSection = (id) => {
    const section = document.getElementById(id)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setMenuOpen(false)
  }

  return (
    <header className="landing-site-header">
      <div className="landing-site-header-inner">
        <Link to="/" className="landing-site-logo" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Logo size="md" variant="transparent" />
        </Link>

        <nav className="landing-desktop-nav" aria-label="Landing page navigation">
          {isHome &&
            HOME_SECTION_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`landing-nav-item ${activeSection === item.id ? 'is-active' : ''}`}
                onClick={() => goToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          {MARKETING_NAV.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="landing-nav-item"
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
          <nav aria-label="Mobile landing page navigation">
            {isHome &&
              HOME_SECTION_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`landing-mobile-nav-item ${
                    activeSection === item.id ? 'is-active' : ''
                  }`}
                  onClick={() => goToSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            {MARKETING_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="landing-mobile-nav-item"
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
