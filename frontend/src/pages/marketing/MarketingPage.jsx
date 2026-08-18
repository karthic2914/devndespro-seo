import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import {
  getMarketingPage,
  ALL_MARKETING_PATHS,
  MARKETING_NAV,
  PAGE_VISUALS,
} from '../../data/marketingPages'

function slugFromPath(pathname) {
  return pathname.replace(/^\//, '').replace(/\/$/, '')
}

function splitHeadline(h1) {
  if (!h1) return ['', null]
  if (h1.includes('. ')) {
    const i = h1.indexOf('. ')
    return [h1.slice(0, i + 1), h1.slice(i + 2)]
  }
  if (h1.includes(' — ')) {
    const parts = h1.split(' — ')
    return [parts[0], parts.slice(1).join(' — ')]
  }
  const words = h1.trim().split(/\s+/)
  if (words.length >= 6) {
    const mid = Math.ceil(words.length * 0.45)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }
  return [h1, null]
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
    <MarketingLayout activePath={page.path}>
      <article className="mkt-page">
        <section className="mkt-hero">
          <div className="mkt-container">
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
                  Analyse your website →
                </button>
                <Link to="/pricing" className="mkt-btn-ghost">
                  View plans
                </Link>
              </div>
            </div>
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
                Practical depth under a clear signal — so every page feels like the same product,
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
                Start free audit →
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
