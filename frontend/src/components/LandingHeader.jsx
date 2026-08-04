import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBars,
  faXmark,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Logo } from './UI'

const NAV_ITEMS = [
  { id: 'platform', label: 'Platform' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
]

export default function LandingHeader({ onLogin, onStart }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
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

    NAV_ITEMS.forEach(({ id }) => {
      const section = document.getElementById(id)

      if (section) {
        observer.observe(section)
      }
    })

    return () => observer.disconnect()
  }, [])

  const goToSection = (id) => {
    const section = document.getElementById(id)

    if (section) {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }

    setMenuOpen(false)
  }

  return (
    <header className="landing-site-header">
      <div className="landing-site-header-inner">
        <div className="landing-site-logo">
          <Logo size="md" variant="transparent" />
        </div>

        <nav className="landing-desktop-nav" aria-label="Landing page navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`landing-nav-item ${
                activeSection === item.id ? 'is-active' : ''
              }`}
              onClick={() => goToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="landing-header-actions">
          <button
            type="button"
            className="landing-signin-button"
            onClick={onLogin}
          >
            Sign in
          </button>

          <button
            type="button"
            className="landing-start-button"
            onClick={onStart}
          >
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
            {NAV_ITEMS.map((item) => (
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
