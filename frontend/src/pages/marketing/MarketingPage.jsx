import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faChartLine,
  faCheck,
  faCube,
  faGaugeHigh,
  faKey,
  faLayerGroup,
  faLink,
  faMagnifyingGlassChart,
  faRobot,
  faRoute,
  faTags,
} from '@fortawesome/free-solid-svg-icons'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import {
  getMarketingPage,
  ALL_MARKETING_PATHS,
  MARKETING_NAV,
  PAGE_VISUALS,
} from '../../data/marketingPages'

const SLUG_ICONS = {
  platform: faCube,
  features: faLayerGroup,
  'ai-visibility': faRobot,
  'how-it-works': faRoute,
  'seo-audit': faMagnifyingGlassChart,
  'keyword-tracking': faKey,
  'backlink-monitoring': faLink,
  about: faChartLine,
  pricing: faTags,
}

function slugFromPath(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '')
}

function splitHeadline(h1) {
  if (!h1) return ['', null]
  if (h1.includes('. ')) {
    const i = h1.indexOf('. ')
    return [h1.slice(0, i + 1), h1.slice(i + 2)]
  }
  if (h1.includes(' · ')) {
    const parts = h1.split(' · ')
    return [parts[0], parts.slice(1).join(' · ')]
  }
  const words = h1.trim().split(/\s+/)
  if (words.length >= 6) {
    const mid = Math.ceil(words.length * 0.45)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }
  return [h1, null]
}

function PanelHead({ icon, title, subtitle }) {
  return (
    <div className="mkt-hero-panel__head">
      <span className="mkt-hero-panel__badge" aria-hidden>
        <FontAwesomeIcon icon={icon} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{subtitle || 'Live workspace preview'}</small>
      </div>
    </div>
  )
}

function PanelBody({ slug, visual }) {
  const variant = visual.variant || 'signals'

  if (variant === 'steps') {
    return (
      <ol className="mkt-panel-steps">
        {(visual.steps || []).map((step) => (
          <li key={step.n}>
            <span className="mkt-panel-steps__n">{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
    )
  }

  if (variant === 'modules') {
    return (
      <div className="mkt-panel-modules">
        {(visual.modules || []).map((mod) => (
          <div key={mod.label} className="mkt-panel-modules__tile">
            <FontAwesomeIcon icon={faCheck} aria-hidden />
            <div>
              <strong>{mod.label}</strong>
              <small>{mod.meta}</small>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'citations') {
    return (
      <ul className="mkt-panel-cites">
        {(visual.citations || []).map((row) => (
          <li key={row.engine}>
            <span className="mkt-panel-cites__engine">{row.engine}</span>
            <span className={`mkt-panel-cites__status is-${row.tone}`}>{row.status}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (variant === 'score') {
    const score = visual.score ?? 78
    return (
      <div className="mkt-panel-score">
        <div
          className="mkt-panel-score__ring"
          style={{ '--score': `${score}` }}
          aria-label={`Site Health ${score}`}
        >
          <div className="mkt-panel-score__inner">
            <strong>{score}</strong>
            <span>Site Health</span>
          </div>
        </div>
        <ul className="mkt-panel-score__issues">
          {(visual.issues || []).map((issue) => (
            <li key={issue.label}>
              <span className={`mkt-panel-score__sev is-${issue.sev.toLowerCase()}`}>
                {issue.sev}
              </span>
              <span>{issue.label}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (variant === 'ranks') {
    return (
      <div className="mkt-panel-ranks">
        <div className="mkt-panel-ranks__head">
          <span>Keyword</span>
          <span>Pos</span>
          <span>Δ</span>
        </div>
        {(visual.ranks || []).map((row) => (
          <div key={row.kw} className="mkt-panel-ranks__row">
            <span className="mkt-panel-ranks__kw">{row.kw}</span>
            <span className="mkt-panel-ranks__pos">{row.pos}</span>
            <span
              className={`mkt-panel-ranks__delta ${
                String(row.delta).startsWith('−') || String(row.delta).startsWith('-')
                  ? 'is-down'
                  : 'is-up'
              }`}
            >
              {row.delta}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'links') {
    return (
      <ul className="mkt-panel-links">
        {(visual.links || []).map((row) => (
          <li key={row.host}>
            <div>
              <strong>{row.host}</strong>
              <small>DR {row.dr}</small>
            </div>
            <span className={`mkt-panel-links__flag is-${row.flag}`}>
              {row.flag === 'spam' ? 'Spam' : 'Clean'}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (variant === 'about') {
    return (
      <ul className="mkt-panel-about">
        {(visual.values || []).map((row) => (
          <li key={row.label}>
            <FontAwesomeIcon icon={faCheck} aria-hidden />
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
          </li>
        ))}
      </ul>
    )
  }

  // Default: platform-style signal cards
  const signals = visual.signals || (visual.chips || []).map((chip, i) => ({
    label: chip,
    detail: visual.stats?.[i] ? `${visual.stats[i].value} ${visual.stats[i].label}` : '',
    tone: ['amber', 'blue', 'teal'][i] || 'amber',
  }))

  return (
    <div className="mkt-panel-signals">
      {signals.map((sig) => (
        <div key={sig.label} className={`mkt-panel-signals__card is-${sig.tone || 'amber'}`}>
          <strong>{sig.label}</strong>
          <small>{sig.detail}</small>
        </div>
      ))}
      {slug === 'platform' ? (
        <div className="mkt-panel-signals__note">One Action Plan across all three</div>
      ) : null}
    </div>
  )
}

function MarketingHeroPanel({ slug, visual }) {
  const icon = SLUG_ICONS[slug] || faGaugeHigh

  return (
    <aside
      className={`mkt-hero-panel mkt-hero-panel--${visual.variant || 'signals'}`}
      aria-label={visual.panelTitle || 'Product preview'}
    >
      <div className="mkt-hero-panel__frame">
        <div className="mkt-hero-panel__bar">
          <div className="mkt-hero-panel__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="mkt-hero-panel__url">seo.devndespro.com</div>
          <div />
        </div>

        <div className="mkt-hero-panel__body">
          <PanelHead icon={icon} title={visual.panelTitle} />
          <PanelBody slug={slug} visual={visual} />
        </div>
      </div>
    </aside>
  )
}

export default function MarketingPage() {
  const location = useLocation()
  const slug = slugFromPath(location.pathname)
  const page = getMarketingPage(slug)
  const navigate = useNavigate()

  if (!page) return <Navigate to="/" replace />

  return <MarketingPageView page={page} slug={slug} onLogin={() => navigate('/login')} />
}

export function MarketingPageView({ page, slug, onLogin }) {
  const visual = PAGE_VISUALS[slug] || PAGE_VISUALS.features
  const [lead, accent] = splitHeadline(page.h1)
  const railItems = (visual.chips || []).slice(0, 4).map((chip, i) => ({
    label: chip,
    text: visual.stats?.[i]?.label
      ? `${visual.stats[i].value} · ${visual.stats[i].label}`
      : visual.panelTitle,
  }))

  useDocumentMeta({
    title: page.title,
    description: page.description,
    canonical: `https://seo.devndespro.com${page.path}`,
  })

  return (
    <MarketingLayout>
      <article className="mkt-page">
        <section className="mkt-hero">
          <div className="mkt-container mkt-hero__grid">
            <div className="mkt-hero__content">
              <p className="mkt-eyebrow">{page.eyebrow}</p>
              <h1>
                {lead}
                {accent ? (
                  <>
                    {' '}
                    <span className="mkt-accent">{accent}</span>
                  </>
                ) : null}
              </h1>
              <p className="mkt-hero__lede">{page.intro}</p>
              <div className="mkt-hero__actions">
                <button type="button" className="mkt-btn-primary" onClick={onLogin}>
                  Analyse your website <FontAwesomeIcon icon={faArrowRight} />
                </button>
                <Link to="/pricing" className="mkt-btn-ghost">
                  View plans
                </Link>
              </div>
            </div>

            <MarketingHeroPanel slug={slug} visual={visual} />
          </div>

          <div className="mkt-rail">
            <div className="mkt-container">
              <div className="mkt-rail__grid">
                {railItems.map((item, i) => (
                  <div
                    key={item.label}
                    className={`mkt-rail__item ${i === 0 ? 'is-active' : ''}`}
                  >
                    <span className="mkt-rail__label">{item.label}</span>
                    <p className="mkt-rail__text">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-band">
          <div className="mkt-container">
            <div className="mkt-section-head">
              <p className="mkt-eyebrow">WHY IT MATTERS</p>
              <h2>Clarity first. Then the lift.</h2>
              <p>
                Practical depth under a clear signal, so every page feels like the same product,
                not a different theme.
              </p>
            </div>

            <div className="mkt-feature-list">
              {page.sections.map((section, index) => (
                <div key={section.h2} className="mkt-feature">
                  <div className="mkt-feature__index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <h3>{section.h2}</h3>
                    {section.body.map((para) => (
                      <p key={para.slice(0, 40)}>{para}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-band" style={{ paddingTop: 0 }}>
          <div className="mkt-container">
            <div className="mkt-cta-row">
              <div>
                <h2>Ship the fix. Prove the lift.</h2>
                <p>
                  Run Site Audit, watch Site Health move, and keep keywords, links and AI citations
                  in one private workspace.
                </p>
              </div>
              <button type="button" className="mkt-btn-primary" onClick={onLogin}>
                Start free audit <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        </section>

        <section className="mkt-band">
          <div className="mkt-container">
            <div className="mkt-section-head">
              <p className="mkt-eyebrow">FAQ</p>
              <h2>Answers before you dive in</h2>
              <p>Straight talk on how this page fits the rest of the platform.</p>
            </div>
            <div className="mkt-faq">
              {page.faqs.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-band" style={{ paddingTop: 0, paddingBottom: 80 }}>
          <div className="mkt-container">
            <div className="mkt-section-head" style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 22 }}>Keep exploring</h2>
            </div>
            <div className="mkt-explore">
              <Link to="/">Home</Link>
              {MARKETING_NAV.filter((n) => n.path !== page.path).map((n) => (
                <Link key={n.path} to={n.path}>
                  {n.label}
                </Link>
              ))}
              {ALL_MARKETING_PATHS.filter(
                (p) => p !== page.path && !MARKETING_NAV.some((n) => n.path === p)
              ).map((path) => (
                <Link key={path} to={path}>
                  {path.replace(/^\//, '').replace(/-/g, ' ')}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </article>
    </MarketingLayout>
  )
}
