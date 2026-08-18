import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import MarketingLayout, { monoFont } from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import { getMarketingPage, ALL_MARKETING_PATHS } from '../../data/marketingPages'

const container = {
  width: '100%',
  maxWidth: 1180,
  margin: '0 auto',
  padding: '0 24px',
  boxSizing: 'border-box',
}

const primaryButton = {
  height: 50,
  padding: '0 24px',
  border: 'none',
  borderRadius: 10,
  background: '#EA6A3B',
  color: '#fff',
  fontSize: 14,
  fontWeight: 650,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  boxShadow: '0 10px 25px rgba(234,106,59,0.24)',
}

export default function MarketingPage() {
  const location = useLocation()
  const slug = location.pathname.replace(/^\//, '').replace(/\/$/, '')
  const page = getMarketingPage(slug)
  const navigate = useNavigate()

  if (!page) return <Navigate to="/" replace />

  return <MarketingPageView page={page} onLogin={() => navigate('/login')} />
}

export function MarketingPageView({ page, onLogin }) {
  useDocumentMeta({
    title: page.title,
    description: page.description,
    canonical: `https://seo.devndespro.com${page.path}`,
  })

  return (
    <MarketingLayout activePath={page.path}>
      <article>
        <section style={{ padding: '56px 0 28px' }}>
          <div style={container}>
            <p
              style={{
                margin: '0 0 14px',
                fontFamily: monoFont,
                color: '#D75F32',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
              }}
            >
              {page.eyebrow}
            </p>
            <h1
              style={{
                margin: '0 0 20px',
                maxWidth: 820,
                color: '#171923',
                fontSize: 'clamp(34px, 5vw, 56px)',
                fontWeight: 740,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
              }}
            >
              {page.h1}
            </h1>
            <p
              style={{
                margin: '0 0 28px',
                maxWidth: 720,
                color: '#5B5E68',
                fontSize: 18,
                lineHeight: 1.7,
              }}
            >
              {page.intro}
            </p>
            <button type="button" onClick={onLogin} style={primaryButton}>
              Analyse your website
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </section>

        {page.sections.map((section) => (
          <section key={section.h2} style={{ padding: '28px 0' }}>
            <div style={{ ...container, maxWidth: 820 }}>
              <h2
                style={{
                  margin: '0 0 14px',
                  color: '#171923',
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2,
                }}
              >
                {section.h2}
              </h2>
              {section.body.map((para) => (
                <p
                  key={para.slice(0, 48)}
                  style={{ margin: '0 0 14px', color: '#5B5E68', fontSize: 16, lineHeight: 1.75 }}
                >
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}

        <section style={{ padding: '40px 0 20px' }}>
          <div style={{ ...container, maxWidth: 820 }}>
            <h2
              style={{
                margin: '0 0 22px',
                color: '#171923',
                fontSize: 28,
                letterSpacing: '-0.03em',
              }}
            >
              Frequently asked questions
            </h2>
            {page.faqs.map((item) => (
              <div key={item.q} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#171923' }}>{item.q}</h3>
                <p style={{ margin: 0, color: '#5B5E68', fontSize: 15, lineHeight: 1.75 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: '48px 0 64px' }}>
          <div style={container}>
            <div
              style={{
                maxWidth: 820,
                margin: '0 auto',
                padding: '28px 0 0',
                borderTop: '1px solid #E4E1DB',
              }}
            >
              <p style={{ margin: '0 0 12px', color: '#898B92', fontSize: 13, fontWeight: 600 }}>
                Explore more
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px' }}>
                {ALL_MARKETING_PATHS.filter((p) => p !== page.path).map((path) => (
                  <Link
                    key={path}
                    to={path}
                    style={{ color: '#4338ca', fontSize: 14, fontWeight: 650, textDecoration: 'none' }}
                  >
                    {path.replace(/^\//, '')}
                  </Link>
                ))}
                <Link to="/" style={{ color: '#4338ca', fontSize: 14, fontWeight: 650, textDecoration: 'none' }}>
                  home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </article>
    </MarketingLayout>
  )
}
