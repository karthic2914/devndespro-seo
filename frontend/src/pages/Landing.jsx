import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useDocumentMeta from '../hooks/useDocumentMeta'
import BackToTop from '../components/marketing/BackToTop'
import '../styles/landing-radar.css'

const LOGO_SRC = '/images/devndespro_seo_transparent.png'

const NAV = [
  { to: '/platform', label: 'Platform' },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/how-it-works', label: 'How it works' },
]

const FEATURES = [
  {
    icon: '◎',
    title: 'Technical SEO Audit',
    to: '/seo-audit',
    text: 'Find crawl errors, metadata problems, duplicate content and technical issues affecting visibility.',
  },
  {
    icon: '↗',
    title: 'Keyword Intelligence',
    to: '/keyword-tracking',
    text: 'Track rankings and discover the search opportunities that deserve attention next.',
  },
  {
    icon: '✦',
    title: 'AI Visibility',
    to: '/ai-visibility',
    text: 'Understand whether AI answer engines recognize and surface your business for relevant questions.',
  },
  {
    icon: '✓',
    title: 'Site Health',
    to: '/platform',
    text: 'See one simple health score backed by prioritized technical and content recommendations.',
  },
  {
    icon: '⌁',
    title: 'Backlinks',
    to: '/backlink-monitoring',
    text: 'Monitor link growth and authority signals alongside your search performance.',
  },
  {
    icon: '⚡',
    title: 'Priority Actions',
    to: '/features',
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

const FAQ_ITEMS = [
  {
    q: 'What does the site health score measure?',
    a: 'Site health combines on-page SEO, technical SEO, and content quality from your latest audit. Critical issues such as missing H1 headings, duplicate titles, or very thin pages pull the score down. Fixing crawl errors, metadata gaps, and thin content raises it over time.',
  },
  {
    q: 'Who is DevnDespro SEO for?',
    a: 'Marketing and growth teams at Nordic companies who need practical SEO and AI visibility insights without juggling disconnected tools. Agencies and in-house SEO owners can track projects per domain and share clear fix priorities with stakeholders.',
  },
  {
    q: 'How is this different from a one-off audit PDF?',
    a: 'Continuous monitoring of keywords, backlinks, and AI citations sits alongside re-runnable site audits. Improvements compound instead of becoming a forgotten report — verify fixes, watch spammy backlinks, and re-score health after each release.',
  },
  {
    q: 'What does AI visibility mean?',
    a: 'AI visibility tracks whether assistants like ChatGPT and Claude mention, understand, or recommend your business. Pair that with Nordic search insights so your content is ready for classic search results and answer engines.',
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
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')

  useDocumentMeta({
    title: 'DevnDespro Visibility — SEO & AI Discovery Platform',
    description:
      'DevnDespro Visibility brings technical SEO, keyword intelligence, backlinks and AI discovery into one focused workspace.',
    canonical: 'https://seo.devndespro.com/',
  })

  return (
    <div className="dd-landing">
      <nav className="dd-nav" aria-label="Primary">
        <div className="dd-container dd-nav-inner">
          <Link className="dd-logo" to="/" aria-label="DevnDespro SEO home">
            <img src={LOGO_SRC} alt="DevnDespro SEO" className="dd-logo-img" />
          </Link>

          <div className="dd-nav-links">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={item.to === '/platform' ? 'is-active' : undefined}
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

      <main id="top">
        <section className="dd-hero">
          <div className="dd-container dd-hero-grid">
            <div className="dd-hero-copy">
              <div className="dd-eyebrow">
                <i aria-hidden /> SEO + AI Discovery Platform
              </div>
              <h1>
                Turn search data into <span className="dd-accent">clear growth actions.</span>
              </h1>
              <p>
                DevnDespro Visibility brings site health, keyword tracking, backlinks and AI discovery
                into one workspace — helping teams understand what needs attention and what to improve
                next.
              </p>
              <div className="dd-hero-actions">
                <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
                  Analyse your website →
                </button>
                <a className="dd-btn dd-btn-secondary" href="#product">
                  See the product
                </a>
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
                  <div className="dd-side-logo">
                    <img src={LOGO_SRC} alt="" className="dd-side-logo-img" />
                  </div>
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
                <Link key={f.title} className="dd-feature" to={f.to}>
                  <div className="dd-feature-icon" aria-hidden>
                    {f.icon}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="dd-section dd-showcase" id="product">
          <div className="dd-container dd-showcase-grid">
            <div className="dd-showcase-copy">
              <div className="dd-kicker">Built for decisions</div>
              <h2>See what is improving — and what still needs work.</h2>
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

        <section className="dd-section" id="how">
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

        <section className="dd-section" id="faq" style={{ paddingTop: 0 }}>
          <div className="dd-container">
            <div className="dd-section-head dd-section-head--center">
              <div className="dd-kicker">FAQ</div>
              <h2>Common questions</h2>
            </div>
            <div className="dd-faq">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
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
