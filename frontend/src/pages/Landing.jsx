import { useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useDocumentMeta from '../hooks/useDocumentMeta'
import BackToTop from '../components/marketing/BackToTop'
import { PRIMARY_MARKETING_NAV, isPrimaryNavActive } from '../data/marketingPages'
import '../styles/landing-radar.css'

const LOGO_SRC = '/images/devndespro_seo_transparent.png'

const FEATURES = [
  {
    icon: '◎',
    title: 'Technical SEO Audit',
    text: 'Find crawl errors, metadata problems, duplicate content and technical issues affecting visibility.',
  },
  {
    icon: '↗',
    title: 'Keyword Intelligence',
    text: 'Track rankings and discover the search opportunities that deserve attention next.',
  },
  {
    icon: '✦',
    title: 'AI Visibility',
    text: 'Understand whether AI answer engines recognize and surface your business for relevant questions.',
  },
  {
    icon: '✓',
    title: 'Site Health',
    text: 'See one simple health score backed by prioritized technical and content recommendations.',
  },
  {
    icon: '⌁',
    title: 'Backlinks',
    text: 'Monitor link growth and authority signals alongside your search performance.',
  },
  {
    icon: '⚡',
    title: 'Priority Actions',
    text: 'Turn findings into practical next steps instead of another long technical report.',
  },
]

const STEPS = [
  {
    no: '1',
    title: 'Add your website',
    text: 'Connect your domain and start collecting the signals that matter to search and AI discovery.',
  },
  {
    no: '2',
    title: 'Understand visibility',
    text: 'See technical SEO, keyword performance, backlinks and AI visibility in one workspace.',
  },
  {
    no: '3',
    title: 'Fix what matters',
    text: 'Follow a prioritized action plan based on impact instead of working through generic checklists.',
  },
]

const SIDE_ITEMS = ['Overview', 'Site Audit', 'Keywords', 'Backlinks', 'AI Visibility', 'Reports']

const ISSUE_ROWS = [
  { title: 'Duplicate page titles detected', cat: 'On-page SEO' },
  { title: 'Low content depth', cat: 'Content quality' },
  { title: 'Missing AI citation signals', cat: 'AI visibility' },
  { title: 'Improve internal linking', cat: 'Technical SEO' },
]

export default function Landing() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')
  const closeMenu = () => setMenuOpen(false)

  useDocumentMeta({
    title: 'DevnDespro Visibility | SEO & AI Discovery Platform',
    description:
      'DevnDespro Visibility brings technical SEO, keyword intelligence, backlinks and AI discovery into one focused workspace.',
    canonical: 'https://seo.devndespro.com/',
  })

  return (
    <div className="dd-landing">
      <nav className="dd-nav" aria-label="Primary">
        <div className="dd-container dd-nav-inner">
          <Link className="dd-brand" to="/" aria-label="DevnDespro Visibility home">
            <img src={LOGO_SRC} alt="DevnDespro SEO" className="dd-brand-logo" />
          </Link>

          <div className="dd-nav-links">
            {PRIMARY_MARKETING_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={() =>
                  isPrimaryNavActive(item.to, location.pathname) ? 'is-active' : undefined
                }
                aria-current={
                  isPrimaryNavActive(item.to, location.pathname) ? 'page' : undefined
                }
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
              className={() =>
                isPrimaryNavActive(item.to, location.pathname) ? 'is-active' : undefined
              }
              aria-current={isPrimaryNavActive(item.to, location.pathname) ? 'page' : undefined}
              onClick={closeMenu}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            className="dd-btn dd-btn-primary"
            onClick={() => {
              closeMenu()
              goLogin()
            }}
          >
            Start free audit →
          </button>
        </div>
      </nav>

      <main id="top">
        <section className="dd-hero">
          <div className="dd-container dd-hero-grid">
            <div>
              <div className="dd-eyebrow">
                <i aria-hidden /> SEO + AI Discovery Platform
              </div>

              <h1>
                Turn search data into
                <span className="dd-accent"> clear growth actions.</span>
              </h1>

              <p className="dd-hero-copy">
                DevnDespro Visibility brings site health, keyword tracking, backlinks and AI discovery
                into one workspace, helping teams understand what needs attention and what to improve
                next.
              </p>

              <div className="dd-hero-actions">
                <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
                  Analyse your website →
                </button>
                <Link className="dd-btn dd-btn-secondary" to="/platform">
                  See the product
                </Link>
              </div>

              <div className="dd-hero-proof">
                <span>
                  <b>✓</b> Technical SEO
                </span>
                <span>
                  <b>✓</b> AI visibility
                </span>
                <span>
                  <b>✓</b> Priority action plans
                </span>
              </div>
            </div>

            <div className="dd-app-frame" aria-label="Product interface preview">
              <div className="dd-window-bar">
                <div className="dd-window-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="dd-window-url">seo.devndespro.com</div>
                <div />
              </div>

              <div className="dd-app-shell">
                <aside className="dd-preview-sidebar">
                  <div className="dd-side-logo">DD Visibility</div>
                  {SIDE_ITEMS.map((label, i) => (
                    <div key={label} className={`dd-side-item${i === 0 ? ' is-active' : ''}`}>
                      <span className="dd-side-icon" aria-hidden />
                      {label}
                    </div>
                  ))}
                </aside>

                <div className="dd-app-main">
                  <div className="dd-app-top">
                    <div>
                      <div className="dd-app-title">Website Overview</div>
                      <div className="dd-app-sub">Updated just now</div>
                    </div>
                    <div className="dd-app-action">Run audit</div>
                  </div>

                  <div className="dd-recommend">
                    <div>
                      <small>Next best move</small>
                      <strong>Fix duplicate page titles</strong>
                    </div>
                    <div className="dd-rec-btn">View action</div>
                  </div>

                  <div className="dd-mini-metrics">
                    <div className="dd-mini-card">
                      <div className="dd-mini-label">Site Health</div>
                      <div className="dd-mini-value">82</div>
                    </div>
                    <div className="dd-mini-card">
                      <div className="dd-mini-label">Keywords</div>
                      <div className="dd-mini-value">180</div>
                    </div>
                    <div className="dd-mini-card">
                      <div className="dd-mini-label">Authority</div>
                      <div className="dd-mini-value">60</div>
                    </div>
                    <div className="dd-mini-card">
                      <div className="dd-mini-label">AI Visibility</div>
                      <div className="dd-mini-value">67</div>
                    </div>
                  </div>

                  <div className="dd-issue-card">
                    <div className="dd-issue-head">
                      <strong>Priority action plan</strong>
                      <span className="dd-issue-pill">6 important</span>
                    </div>
                    {ISSUE_ROWS.map((row, i) => (
                      <div key={row.title} className="dd-issue-row">
                        <div className="dd-issue-num">{i + 1}</div>
                        <div className="dd-issue-text">
                          <strong>{row.title}</strong>
                          <span>{row.cat}</span>
                        </div>
                        <div className="dd-issue-status">High</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dd-trust-strip">
          <div className="dd-container dd-trust-grid">
            <div className="dd-trust-item">
              <strong>Technical SEO</strong>
              <span>Site health & audits</span>
            </div>
            <div className="dd-trust-item">
              <strong>Keyword Intelligence</strong>
              <span>Rankings & opportunities</span>
            </div>
            <div className="dd-trust-item">
              <strong>Backlink Monitoring</strong>
              <span>Authority signals</span>
            </div>
            <div className="dd-trust-item">
              <strong>AI Visibility</strong>
              <span>Discovery beyond search</span>
            </div>
          </div>
        </section>

        <section className="dd-section" id="features">
          <div className="dd-container">
            <div className="dd-section-head dd-section-head--center">
              <div className="dd-kicker">One focused workspace</div>
              <h2>Everything your team needs to improve visibility.</h2>
              <p>
                Replace fragmented SEO tools and disconnected AI experiments with one clear view of
                what matters most.
              </p>
            </div>

            <div className="dd-feature-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="dd-feature">
                  <div className="dd-feature-icon" aria-hidden>
                    {f.icon}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dd-section dd-showcase" id="product">
          <div className="dd-container dd-showcase-grid">
            <div className="dd-showcase-copy">
              <div className="dd-kicker">Built for decisions</div>
              <h2>See what is improving, and what still needs work.</h2>
              <p>
                Your team gets a single view of technical health, search momentum and AI visibility,
                with enough detail to act without drowning in dashboards.
              </p>
              <div className="dd-checks">
                <div className="dd-check">
                  <span>✓</span>Prioritize issues by impact
                </div>
                <div className="dd-check">
                  <span>✓</span>Track progress across projects
                </div>
                <div className="dd-check">
                  <span>✓</span>Monitor search and AI visibility together
                </div>
                <div className="dd-check">
                  <span>✓</span>Turn findings into actionable tasks
                </div>
              </div>
            </div>

            <div className="dd-analytics-card">
              <div className="dd-analytics-top">
                <strong>Visibility performance</strong>
                <span className="dd-analytics-chip">Last 30 days</span>
              </div>
              <div className="dd-chart">
                <div className="dd-chart-grid" aria-hidden />
                <div className="dd-chart-bars" aria-hidden>
                  <div className="dd-bar" style={{ height: '48%' }} />
                  <div className="dd-bar" style={{ height: '38%' }} />
                  <div className="dd-bar" style={{ height: '72%' }} />
                  <div className="dd-bar" style={{ height: '55%' }} />
                  <div className="dd-bar" style={{ height: '86%' }} />
                  <div className="dd-bar" style={{ height: '68%' }} />
                </div>
              </div>
              <div className="dd-insight-row">
                <div className="dd-insight">
                  <small>Site Health</small>
                  <strong>82</strong>
                </div>
                <div className="dd-insight">
                  <small>AI Visibility</small>
                  <strong>67</strong>
                </div>
                <div className="dd-insight">
                  <small>Keyword Growth</small>
                  <strong>+18%</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dd-section dd-how" id="how">
          <div className="dd-container">
            <div className="dd-section-head dd-section-head--center">
              <div className="dd-kicker">How it works</div>
              <h2>From website to clear action in three steps.</h2>
            </div>
            <div className="dd-steps">
              {STEPS.map((s) => (
                <article key={s.no} className="dd-step">
                  <div className="dd-step-no">{s.no}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="dd-cta">
          <div className="dd-container">
            <div className="dd-cta-card">
              <h2>See how visible your website really is.</h2>
              <p>
                Run your first audit and get a clear view of technical SEO, keyword performance and AI
                discovery.
              </p>
              <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
                Start your free audit →
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="dd-footer">
        <div className="dd-container dd-footer-inner">
          <div>© {new Date().getFullYear()} DevnDespro Visibility</div>
          <div className="dd-footer-links">
            <Link to="/about">About</Link>
            <Link to="/pricing">Pricing</Link>
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
