import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useDocumentMeta from '../hooks/useDocumentMeta'
import BackToTop from '../components/marketing/BackToTop'
import '../styles/landing-radar.css'

const NAV = [
  { to: '/platform', label: 'Platform' },
  { to: '/features', label: 'Features' },
  { to: '/ai-visibility', label: 'AI Visibility' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
]

const FEATURES = [
  {
    num: 'SIGNAL 01',
    icon: '⌁',
    title: 'Technical SEO Audit',
    to: '/seo-audit',
    text: 'Find crawl issues, metadata gaps, broken links, performance problems and structural SEO weaknesses — ranked by impact.',
  },
  {
    num: 'SIGNAL 02',
    icon: '◉',
    title: 'AI Visibility',
    to: '/ai-visibility',
    text: 'Understand whether AI answer engines can discover, understand and mention your business — with evidence you can act on.',
  },
  {
    num: 'SIGNAL 03',
    icon: '↗',
    title: 'Keyword Tracking',
    to: '/keyword-tracking',
    text: 'Track the queries that matter, compare movement over time and connect ranking changes to the work your team is doing.',
  },
  {
    num: 'SIGNAL 04',
    icon: '⌘',
    title: 'Backlink Monitoring',
    to: '/backlink-monitoring',
    text: 'Watch referring domains, spot lost links and understand the authority signals supporting your search visibility.',
  },
  {
    num: 'SIGNAL 05',
    icon: '◎',
    title: 'Competitor Intelligence',
    to: '/features',
    text: 'Compare visibility, content opportunities and keyword coverage so you can see where competitors are winning attention.',
  },
  {
    num: 'SIGNAL 06',
    icon: '✓',
    title: 'Action Plans',
    to: '/platform',
    text: 'Turn audit findings into an ordered roadmap your team can actually execute — instead of another endless issue list.',
  },
]

const STEPS = [
  {
    no: '01 · CONNECT',
    title: 'Add your website',
    text: 'Enter your domain and choose the signals you want to track.',
  },
  {
    no: '02 · ANALYSE',
    title: 'Scan your discoverability',
    text: 'Run SEO, keyword, backlink and AI visibility checks from one workspace.',
  },
  {
    no: '03 · IMPROVE',
    title: 'Follow the priorities',
    text: 'Work through the highest-impact recommendations and monitor the result over time.',
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

const BAR_HEIGHTS = ['46%', '58%', '51%', '66%', '72%', '69%', '82%']
const BAR_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'NOW']

export default function Landing() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const goLogin = () => navigate('/login')

  useDocumentMeta({
    title: 'DevnDespro SEO — Search & AI Visibility Platform',
    description:
      'DevnDespro SEO helps businesses improve technical SEO, track AI visibility, monitor keywords, analyze backlinks and turn search data into clear actions.',
    canonical: 'https://seo.devndespro.com/',
  })

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
              <Link key={item.to} to={item.to}>
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
        <div className="dd-container dd-hero">
          <div className="dd-hero-copy">
            <div className="dd-eyebrow dd-mono">SEARCH INTELLIGENCE · STAVANGER, NORWAY</div>
            <h1>
              Know exactly how your business gets <span className="dd-accent">discovered.</span>
            </h1>
            <p>
              DevnDespro SEO brings technical SEO, keyword intelligence, backlink monitoring and AI
              answer-engine visibility into one focused workspace — so every insight becomes a clear
              next action.
            </p>
            <div className="dd-hero-actions">
              <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
                Analyse your website →
              </button>
              <Link className="dd-btn dd-btn-secondary" to="/platform">
                Explore the platform
              </Link>
            </div>
            <div className="dd-proof">
              <div className="dd-proof-item">
                <strong>01</strong>
                <span>UNIFIED WORKSPACE</span>
              </div>
              <div className="dd-proof-item">
                <strong>AI + SEO</strong>
                <span>DISCOVERY SIGNALS</span>
              </div>
              <div className="dd-proof-item">
                <strong>24/7</strong>
                <span>VISIBILITY MONITORING</span>
              </div>
            </div>
          </div>

          <div className="dd-radar-card" aria-label="AI visibility radar concept">
            <div className="dd-radar-top dd-mono">
              <span>
                SIGNAL SCAN · <b className="dd-live">LIVE</b>
              </span>
              <span>58.9700° N</span>
            </div>
            <div className="dd-radar">
              <div className="dd-ring" />
              <div className="dd-ring r2" />
              <div className="dd-ring r3" />
              <div className="dd-axis-x" />
              <div className="dd-axis-y" />
              <div className="dd-sweep" />
              <div className="dd-node active dd-n1">GOOGLE</div>
              <div className="dd-node active dd-n2">CLAUDE</div>
              <div className="dd-node dd-n3">PERPLEXITY</div>
              <div className="dd-node dd-n4">CHATGPT</div>
              <div className="dd-node you dd-n5">YOUR SITE</div>
            </div>
            <div className="dd-radar-score">
              <strong>67%</strong>
              <span className="dd-mono">DISCOVERY SIGNAL</span>
            </div>
          </div>
        </div>

        <div className="dd-strip">
          <div className="dd-container dd-strip-inner">
            <span>
              TRACK <b>TECHNICAL SEO</b>
            </span>
            <span>
              MEASURE <b>AI VISIBILITY</b>
            </span>
            <span>
              MONITOR <b>KEYWORDS</b>
            </span>
            <span>
              ANALYSE <b>BACKLINKS</b>
            </span>
            <span>
              ACT ON <b>PRIORITIES</b>
            </span>
          </div>
        </div>

        <section className="dd-section" id="platform">
          <div className="dd-container">
            <div className="dd-section-head">
              <div>
                <div className="dd-kicker">ONE PLATFORM · MULTIPLE SIGNALS</div>
                <h2>Search intelligence without the dashboard overload.</h2>
              </div>
              <p>
                See the signals that affect discoverability, understand what changed, and move
                directly from insight to action.
              </p>
            </div>

            <div className="dd-feature-grid" id="features">
              {FEATURES.map((f) => (
                <Link key={f.title} className="dd-feature" to={f.to}>
                  <div className="dd-num">{f.num}</div>
                  <div className="dd-icon" aria-hidden>
                    {f.icon}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="dd-section" id="audit">
          <div className="dd-container dd-dashboard">
            <div className="dd-insight-card">
              <div className="dd-tag">DISCOVERY REPORT · EXAMPLE</div>
              <h3>From “what’s wrong?” to “what should we do next?”</h3>
              <p>
                The platform combines technical, search and AI-discovery signals into one practical
                view, keeping the highest-impact work at the top.
              </p>
              <div className="dd-check-list">
                <div className="dd-check">Prioritised technical SEO issues</div>
                <div className="dd-check">AI mention and citation visibility</div>
                <div className="dd-check">Keyword movement and intent</div>
                <div className="dd-check">Backlink and authority signals</div>
                <div className="dd-check">Clear action plan for your team</div>
              </div>
            </div>
            <div className="dd-chart-card">
              <div className="dd-chart-head">
                <span>VISIBILITY TREND · LAST 7 CHECKS</span>
                <span>UPDATED LIVE</span>
              </div>
              <div className="dd-bars">
                {BAR_HEIGHTS.map((h, i) => (
                  <div key={BAR_LABELS[i]} className="dd-bar" style={{ height: h }} data-label={BAR_LABELS[i]} />
                ))}
              </div>
              <div className="dd-metrics">
                <div className="dd-metric">
                  <strong>82</strong>
                  <span>SITE HEALTH</span>
                </div>
                <div className="dd-metric">
                  <strong>+18%</strong>
                  <span>AI VISIBILITY</span>
                </div>
                <div className="dd-metric">
                  <strong>14</strong>
                  <span>PRIORITY ACTIONS</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dd-section" id="how">
          <div className="dd-container">
            <div className="dd-section-head">
              <div>
                <div className="dd-kicker">HOW IT WORKS</div>
                <h2>Three steps from URL to action.</h2>
              </div>
            </div>
            <div className="dd-steps">
              {STEPS.map((s) => (
                <div key={s.no} className="dd-step">
                  <div className="dd-step-no">{s.no}</div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="dd-section" id="faq" style={{ paddingTop: 0 }}>
          <div className="dd-container">
            <div className="dd-section-head">
              <div>
                <div className="dd-kicker">FAQ</div>
                <h2>Common questions</h2>
              </div>
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

        <section className="dd-container dd-cta-panel" id="pricing">
          <div>
            <div className="dd-eyebrow dd-mono">START WITH YOUR DOMAIN</div>
            <h2>Find out what search engines and AI systems can see about your business.</h2>
            <p>Run your first website analysis and get a focused visibility snapshot.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button type="button" className="dd-btn dd-btn-primary" onClick={goLogin}>
              Start free audit →
            </button>
            <Link className="dd-btn dd-btn-secondary" to="/pricing">
              View pricing
            </Link>
          </div>
        </section>
      </main>

      <footer className="dd-footer">
        <div className="dd-container dd-footer-inner">
          <div>© {new Date().getFullYear()} DevnDespro · Stavanger, Norway</div>
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
