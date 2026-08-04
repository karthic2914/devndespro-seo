import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRight,
  faCheck,
  faChartLine,
  faComments,
  faGlobe,
  faLocationDot,
  faMagnifyingGlass,
  faShieldHalved,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, T } from '../components/UI'

const FEATURES = [
  {
    icon: faComments,
    title: 'AI visibility tracking',
    description:
      'Discover whether ChatGPT, Claude and other AI platforms mention or recommend your business.',
  },
  {
    icon: faMagnifyingGlass,
    title: 'Technical SEO audit',
    description:
      'Crawl your website and uncover indexing, performance, metadata and content issues.',
  },
  {
    icon: faLocationDot,
    title: 'Nordic search intelligence',
    description:
      'Analyse Norwegian keywords, local intent and regional search patterns ignored by generic tools.',
  },
  {
    icon: faChartLine,
    title: 'Prioritised recommendations',
    description:
      'See what to fix first, why it matters and how each improvement can affect visibility.',
  },
  {
    icon: faGlobe,
    title: 'Google and AI readiness',
    description:
      'Optimise your website for traditional search engines and the new generation of answer engines.',
  },
  {
    icon: faShieldHalved,
    title: 'Private reporting',
    description:
      'Your website reports and business data remain private and securely accessible.',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Add your website',
    description: 'Enter your domain and select the market you want to analyse.',
  },
  {
    number: '02',
    title: 'Run the analysis',
    description: 'We audit your website, keywords and AI visibility signals.',
  },
  {
    number: '03',
    title: 'Improve your visibility',
    description: 'Follow clear recommendations ordered by business impact.',
  },
]

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"

const styles = {
  page: {
    minHeight: '100vh',
    background: '#FBFAF8',
    color: '#171923',
    fontFamily: 'inherit',
    overflow: 'hidden',
  },

  container: {
    width: '100%',
    maxWidth: 1180,
    margin: '0 auto',
    padding: '0 24px',
    boxSizing: 'border-box',
  },

  primaryButton: {
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
  },

  secondaryButton: {
    height: 50,
    padding: '0 22px',
    border: '1px solid #DAD8D3',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.72)',
    color: '#20222B',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

export default function Landing() {
  const navigate = useNavigate()

  const goToLogin = () => navigate('/login')

  return (
    <div className="premium-landing-page" style={styles.page}>
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: -220,
          right: -160,
          width: 620,
          height: 620,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,213,192,0.72) 0%, rgba(255,240,230,0.35) 42%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 200,
          left: -260,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(207,224,255,0.72) 0%, rgba(228,237,255,0.3) 42%, transparent 72%)',
          pointerEvents: 'none',
        }}
      />

      {/* Navigation */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid rgba(220,217,211,0.75)',
          background: 'rgba(251,250,248,0.82)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          style={{
            ...styles.container,
            minHeight: 74,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Logo size="md" variant="transparent" />

          <div
            className="landing-nav-links"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 30,
            }}
          >
            <a href="#features" style={navLinkStyle}>
              Features
            </a>

            <a href="#how-it-works" style={navLinkStyle}>
              How it works
            </a>

            <a href="#platform" style={navLinkStyle}>
              Platform
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={goToLogin}
              style={{
                background: 'transparent',
                color: '#333640',
                border: 'none',
                height: 40,
                padding: '0 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Sign in
            </button>

            <button
              onClick={goToLogin}
              style={{
                background: '#171923',
                color: '#fff',
                border: 'none',
                height: 40,
                padding: '0 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Start free audit
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <section style={{ padding: '70px 0 46px' }}>
          <div style={styles.container}>
            <div
              className="landing-hero-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 0.9fr) minmax(520px, 1.1fr)',
                gap: 58,
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    background: '#FFF1E9',
                    border: '1px solid #F8D4C4',
                    borderRadius: 999,
                    padding: '7px 12px',
                    marginBottom: 24,
                  }}
                >
                  <FontAwesomeIcon
                    icon={faStar}
                    style={{ color: '#D95527', fontSize: 12 }}
                  />

                  <span
                    style={{
                      fontFamily: monoFont,
                      fontSize: 10,
                      fontWeight: 650,
                      color: '#A64322',
                      letterSpacing: '0.08em',
                    }}
                  >
                    SEARCH VISIBILITY FOR NORDIC BUSINESSES
                  </span>
                </div>

                <h1
                  style={{
                    maxWidth: 670,
                    margin: '0 0 24px',
                    color: '#171923',
                    fontSize: 'clamp(46px, 5.2vw, 72px)',
                    fontWeight: 740,
                    lineHeight: 0.99,
                    letterSpacing: '-0.052em',
                  }}
                >
                  Rank higher.<br />
Get recommended by AI.
                </h1>

                <p
  style={{
    maxWidth: 590,
    margin: '0 0 32px',
    color: '#5B5E68',
    fontSize: 18,
    lineHeight: 1.68,
  }}
>
  See exactly how Google, ChatGPT and Claude understand your business —
  and what to improve next.
</p>

              <h2
                style={{
                  maxWidth: 820,
                  margin: '0 auto 20px',
                  color: '#fff',
                  fontSize: 'clamp(32px, 4vw, 50px)',
                  lineHeight: 1.12,
                  letterSpacing: '-0.035em',
                }}
              >
                Your customers are no longer searching in only one place.
              </h2>

              <p
                style={{
                  maxWidth: 650,
                  margin: '0 auto',
                  color: '#DAD8FF',
                  fontSize: 16,
                  lineHeight: 1.7,
                }}
              >
                They ask Google, ChatGPT, Claude and other AI tools for direct
                recommendations. Your website must be understandable,
                trustworthy and visible across all of them.
              </p>
            </div>
          </div>
        </div>
      </section>

        {/* Features */}
        <section id="features" style={{ padding: '64px 0 76px' }}>
          <div style={styles.container}>
            <SectionHeader
              eyebrow="ONE PLATFORM"
              title="Everything required to improve your online visibility"
              description="Find technical problems, understand your search presence and measure whether AI platforms recognise your business."
            />

            <div
              className="landing-features-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 18,
                marginTop: 46,
              }}
            >
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          style={{
            padding: '72px 0',
            background: '#F2F1ED',
          }}
        >
          <div style={styles.container}>
            <SectionHeader
              eyebrow="HOW IT WORKS"
              title="From website address to clear actions"
              description="No complicated setup, large spreadsheets or unclear technical reports."
            />

            <div
              className="landing-steps-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 20,
                marginTop: 50,
              }}
            >
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  style={{
                    background: '#fff',
                    border: '1px solid #E1DED8',
                    borderRadius: 16,
                    padding: 28,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontFamily: monoFont,
                      fontSize: 12,
                      color: '#D75F32',
                      marginBottom: 35,
                    }}
                  >
                    {step.number}
                  </span>

                  <h3
                    style={{
                      margin: '0 0 10px',
                      color: '#1C1E26',
                      fontSize: 19,
                    }}
                  >
                    {step.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: '#686B74',
                      fontSize: 14,
                      lineHeight: 1.65,
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '72px 0' }}>
          <div style={styles.container}>
            <div
              style={{
                maxWidth: 920,
                margin: '0 auto',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: monoFont,
                  color: '#D75F32',
                  fontSize: 11,
                  fontWeight: 650,
                  letterSpacing: '0.12em',
                  margin: '0 0 18px',
                }}
              >
                KNOW WHERE YOU STAND
              </p>

              <h2
                style={{
                  margin: '0 auto 20px',
                  maxWidth: 700,
                  color: '#171923',
                  fontSize: 'clamp(35px, 4.4vw, 54px)',
                  lineHeight: 1.08,
                  letterSpacing: '-0.04em',
                }}
              >
                Make your business easier to find, understand and recommend.
              </h2>

              <p
                style={{
                  maxWidth: 580,
                  margin: '0 auto 32px',
                  color: '#666A73',
                  fontSize: 16,
                  lineHeight: 1.7,
                }}
              >
                Run your first analysis and discover what is limiting your
                visibility across Google and AI search.
              </p>

              <button onClick={goToLogin} style={styles.primaryButton}>
                Analyse your website
                <FontAwesomeIcon icon={faArrowRight} />
              </button>

              <p
                style={{
                  marginTop: 15,
                  color: '#898B92',
                  fontSize: 12,
                }}
              >
                Private beta - Limited early access
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: '1px solid #E4E1DB',
          padding: '30px 0',
        }}
      >
        <div
          style={{
            ...styles.container,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 20,
          }}
        >
          <Logo size="sm" variant="transparent" />

          <p
            style={{
              margin: 0,
              color: '#888A91',
              fontSize: 12,
            }}
          >
            Â© {new Date().getFullYear()} Devndespro. Built in Stavanger, Norway.
          </p>
        </div>
      </footer>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '8% -6% -8%',
          background:
            'linear-gradient(135deg, rgba(82,70,217,0.22), rgba(234,106,59,0.18))',
          filter: 'blur(40px)',
          borderRadius: 30,
        }}
      />

      <div
        style={{
          position: 'relative',
          background: '#151821',
          borderRadius: 20,
          padding: 10,
          boxShadow: '0 35px 80px rgba(24,27,39,0.24)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            background: '#FDFDFC',
            borderRadius: 13,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 44,
              background: '#F4F3F0',
              borderBottom: '1px solid #E6E3DD',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 15px',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={windowDotStyle} />
              <span style={windowDotStyle} />
              <span style={windowDotStyle} />
            </div>

            <span
              style={{
                fontSize: 10,
                color: '#81838B',
                fontFamily: monoFont,
              }}
            >
              app.aurorasearch.io
            </span>

            <span style={{ width: 35 }} />
          </div>

          <div
            style={{
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 22,
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 5px',
                    fontSize: 11,
                    color: '#8A8C93',
                  }}
                >
                  WEBSITE OVERVIEW
                </p>

                <h3
                  style={{
                    margin: 0,
                    color: '#1A1C24',
                    fontSize: 18,
                  }}
                >
                  AuroraSearch.io
                </h3>
              </div>

              <span
                style={{
                  background: '#E9F7EF',
                  color: '#227A49',
                  borderRadius: 999,
                  padding: '6px 9px',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                ANALYSIS COMPLETE
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <MetricCard label="Site health" value="66" suffix="/100" />
              <MetricCard label="Pages scanned" value="97" />
              <MetricCard label="AI citations" value="4" />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 0.9fr',
                gap: 12,
              }}
            >
              <div
                style={{
                  border: '1px solid #E7E4DE',
                  borderRadius: 12,
                  padding: 15,
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: '#898B93',
                    margin: '0 0 14px',
                  }}
                >
                  PRIORITY ISSUES
                </p>

                <IssueRow label="Missing page titles" count="8" />
                <IssueRow label="Broken internal links" count="4" />
                <IssueRow label="Slow mobile pages" count="3" />
              </div>

              <div
                style={{
                  borderRadius: 12,
                  padding: 15,
                  background: '#F0EFFF',
                  border: '1px solid #DCD8FF',
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    color: '#7169B9',
                    margin: '0 0 8px',
                    fontFamily: monoFont,
                  }}
                >
                  ASK CLAUDE
                </p>

                <p
                  style={{
                    color: '#3E3B5C',
                    fontSize: 11,
                    lineHeight: 1.55,
                    margin: '0 0 13px',
                  }}
                >
                  "Best CRM platform for shipping companies in Norwayâ€
                </p>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#25764A',
                    fontSize: 10,
                    fontWeight: 700,
                    gap: 5,
                  }}
                >
                  <FontAwesomeIcon icon={faCheck} />
                  AuroraSearch.io cited
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: -28,
          bottom: -26,
          width: 190,
          background: '#fff',
          border: '1px solid #E4E1DB',
          borderRadius: 12,
          padding: 14,
          boxShadow: '0 18px 45px rgba(25,28,38,0.16)',
        }}
      >
        <p
          style={{
            margin: '0 0 7px',
            color: '#858790',
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          VISIBILITY CHANGE
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <strong
            style={{
              color: '#252832',
              fontSize: 24,
            }}
          >
            +18%
          </strong>

          <span
            style={{
              color: '#31855A',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            this month
          </span>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, suffix }) {
  return (
    <div
      style={{
        background: '#F5F4F1',
        borderRadius: 10,
        padding: '12px 11px',
      }}
    >
      <p
        style={{
          margin: '0 0 7px',
          color: '#8B8D94',
          fontSize: 9,
        }}
      >
        {label.toUpperCase()}
      </p>

      <strong
        style={{
          color: '#24262E',
          fontSize: 20,
        }}
      >
        {value}

        {suffix && (
          <span
            style={{
              color: '#9799A0',
              fontSize: 10,
              fontWeight: 500,
            }}
          >
            {suffix}
          </span>
        )}
      </strong>
    </div>
  )
}

function IssueRow({ label, count }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #EEECE7',
        padding: '9px 0',
      }}
    >
      <span
        style={{
          color: '#5C5F68',
          fontSize: 10,
        }}
      >
        {label}
      </span>

      <span
        style={{
          background: '#FFF0E7',
          color: '#BB542C',
          borderRadius: 5,
          padding: '3px 6px',
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </div>
  )
}

function TrustItem({ text }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <FontAwesomeIcon
        icon={faCheck}
        style={{
          color: '#37865C',
          fontSize: 10,
        }}
      />

      {text}
    </span>
  )
}

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div
      style={{
        maxWidth: 700,
      }}
    >
      <p
        style={{
          fontFamily: monoFont,
          color: '#D75F32',
          fontSize: 11,
          fontWeight: 650,
          letterSpacing: '0.12em',
          margin: '0 0 16px',
        }}
      >
        {eyebrow}
      </p>

      <h2
        style={{
          margin: '0 0 17px',
          color: '#171923',
          fontSize: 'clamp(32px, 4vw, 48px)',
          lineHeight: 1.1,
          letterSpacing: '-0.035em',
        }}
      >
        {title}
      </h2>

      <p
        style={{
          maxWidth: 620,
          margin: 0,
          color: '#676A73',
          fontSize: 16,
          lineHeight: 1.7,
        }}
      >
        {description}
      </p>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div
      style={{
        minHeight: 205,
        padding: 25,
        borderRadius: 16,
        background: '#fff',
        border: '1px solid #E6E3DD',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: '#EFEEFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 23,
        }}
      >
        <FontAwesomeIcon
          icon={icon}
          style={{
            color: '#5146CE',
            fontSize: 17,
          }}
        />
      </div>

      <h3
        style={{
          margin: '0 0 9px',
          color: '#20222A',
          fontSize: 17,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          color: '#6C6F78',
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {description}
      </p>
    </div>
  )
}

const navLinkStyle = {
  color: '#5D6069',
  fontSize: 13,
  fontWeight: 550,
  textDecoration: 'none',
}

const windowDotStyle = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#C9C7C2',
}


