import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faBolt,
  faChartLine,
  faComments,
  faGlobe,
  faLink,
  faMagnifyingGlass,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import {
  getMarketingPage,
  ALL_MARKETING_PATHS,
  MARKETING_NAV,
  PAGE_VISUALS,
} from '../../data/marketingPages'
import '../../styles/marketing.css'

const SECTION_ICONS = [
  faMagnifyingGlass,
  faComments,
  faChartLine,
  faLink,
  faGlobe,
  faShieldHalved,
  faBolt,
]

function slugFromPath(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '')
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

  useDocumentMeta({
    title: page.title,
    description: page.description,
    canonical: `https://seo.devndespro.com${page.path}`,
  })

  return (
    <MarketingLayout activePath={page.path}>
      <article className="mkt-page">
        <section className="mkt-hero">
          <div className="mkt-hero__glow mkt-hero__glow--a" aria-hidden />
          <div className="mkt-hero__glow mkt-hero__glow--b" aria-hidden />
          <div className="mkt-container">
            <div className="mkt-hero__inner">
              <div>
                <p className="mkt-eyebrow">
                  <span className="mkt-eyebrow__dot" aria-hidden />
                  {page.eyebrow}
                </p>
                <h1>{page.h1}</h1>
                <p className="mkt-hero__lede">{page.intro}</p>
                <div className="mkt-hero__actions">
                  <button type="button" className="mkt-btn-primary" onClick={onLogin}>
                    Analyse your website
                    <FontAwesomeIcon icon={faArrowRight} />
                  </button>
                  <Link to="/pricing" className="mkt-btn-ghost">
                    View plans
                  </Link>
                </div>
                <div className="mkt-stats">
                  {(visual.stats || []).map((s) => (
                    <div key={s.label} className="mkt-stat">
                      <span className="mkt-stat__value">{s.value}</span>
                      <span className="mkt-stat__label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mkt-hero-visual" aria-hidden={false}>
                <div className="mkt-hero-visual__grid" aria-hidden />
                <div className="mkt-hero-visual__body">
                  <p className="mkt-hero-visual__label">DEVNDESPRO SEO</p>
                  <h2 className="mkt-hero-visual__title">{visual.panelTitle}</h2>
                  <div className="mkt-hero-visual__chips">
                    {(visual.chips || []).map((chip, i) => (
                      <div key={chip} className="mkt-chip">
                        <div className="mkt-chip__icon">
                          <FontAwesomeIcon icon={SECTION_ICONS[i % SECTION_ICONS.length]} />
                        </div>
                        <div className="mkt-chip__text">{chip}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-band mkt-band--tint">
          <div className="mkt-container">
            <div className="mkt-section-head">
              <p className="mkt-eyebrow" style={{ margin: '0 auto 14px' }}>
                <span className="mkt-eyebrow__dot" aria-hidden />
                WHY IT MATTERS
              </p>
              <h2>Designed to feel premium — and stay practical</h2>
              <p>
                Same visual system on every page: clear hierarchy, real product language, and next
                steps you can act on this week.
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

        <section className="mkt-band mkt-band--dark">
          <div className="mkt-container">
            <div className="mkt-cta-row">
              <div>
                <h2>Ready when your next release ships</h2>
                <p>
                  Run Site Audit, watch Site Health move, and keep keywords, links and AI citations
                  in the same private workspace.
                </p>
              </div>
              <button type="button" className="mkt-btn-primary" onClick={onLogin}>
                Start free audit
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          </div>
        </section>

        <section className="mkt-band">
          <div className="mkt-container">
            <div className="mkt-section-head">
              <p className="mkt-eyebrow" style={{ margin: '0 auto 14px' }}>
                <span className="mkt-eyebrow__dot" aria-hidden />
                FAQ
              </p>
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

        <section className="mkt-band" style={{ paddingTop: 0 }}>
          <div className="mkt-container">
            <div className="mkt-section-head" style={{ marginBottom: 20 }}>
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
