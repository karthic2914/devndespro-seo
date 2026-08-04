import { useEffect, useState } from 'react'
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
    title: 'AI citation monitoring',
    description:
      'Track whether ChatGPT and Claude mention, understand or recommend your business.',
  },
  {
    icon: faMagnifyingGlass,
    title: 'Technical website intelligence',
    description:
      'Find crawl errors, indexing problems, broken links and performance issues across your site.',
  },
  {
    icon: faLocationDot,
    title: 'Nordic market insights',
    description:
      'Analyse Norwegian search intent, regional keywords and local discovery opportunities.',
  },
  {
    icon: faChartLine,
    title: 'Impact-based action plan',
    description:
      'Prioritise improvements by visibility impact instead of working through generic checklists.',
  },
  {
    icon: faGlobe,
    title: 'Search and AI readiness',
    description:
      'Prepare your content for Google rankings, AI answers and modern recommendation engines.',
  },
  {
    icon: faShieldHalved,
    title: 'Secure private workspace',
    description:
      'Keep website analysis, reports and business visibility data protected in one private workspace.',
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
  const [activeSection, setActiveSection] = useState('')

  const goToLogin = () => navigate('/login')
  /* ACTIVE SECTION OBSERVER */
  useEffect(() => {
    const sectionIds = ['platform', 'features', 'how-it-works']

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visibleSection) {
          setActiveSection(visibleSection.target.id)
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      }
    )

    sectionIds.forEach((id) => {
      const section = document.getElementById(id)

      if (section) {
        observer.observe(section)
      }
    })

    return () => observer.disconnect()
  }, [])

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
      <header className="landing-sticky-header"
        style={{
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid rgba(220,217,211,0.75)',
          background: 'rgba(251,250,248,0.82)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div
          className="landing-header-inner"
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
            <a href="#features" className={`landing-nav-link ${activeSection === 'features' ? 'is-active' : ''}`} aria-current={activeSection === 'features' ? 'page' : undefined} style={navLinkStyle}>
              Features
            </a>

            <a href="#how-it-works" className={`landing-nav-link ${activeSection === 'how-it-works' ? 'is-active' : ''}`} aria-current={activeSection === 'how-it-works' ? 'page' : undefined} style={navLinkStyle}>
              How it works
            </a>

            <a href="#platform" className={`landing-nav-link ${activeSection === 'platform' ? 'is-active' : ''}`} aria-current={activeSection === 'platform' ? 'page' : undefined} style={navLinkStyle}>
              Platform
            </a>
          </div>

          <div className="landing-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                gridTemplateColumns: 'minmax(620px, 1.05fr) minmax(560px, 0.95fr)',
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
                    fontSize: 'clamp(44px, 4.7vw, 66px)',
                    fontWeight: 740,
                    lineHeight: 0.99,
                    letterSpacing: '-0.052em',
                  }}
                >
                  Be discovered by Google.
                  <span
                    style={{
                      display: 'block',
                      color: '#5246D9',
                    }}
                  >
                    Be recommended by<br />AI.
                  </span>
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
                  Understand how visible your business is across search engines
                  and AI platformsÃ¢â‚¬â€and get a clear plan to improve it.
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 28,
                  }}
                >
                  <button onClick={goToLogin} style={styles.primaryButton}>
                    Analyse your website
                    <FontAwesomeIcon icon={faArrowRight} />
                  </button>

                  <button onClick={goToLogin} style={styles.secondaryButton}>
                    See live demo
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 20,
                    color: '#70737D',
                    fontSize: 12,
                  }}
                >
                  <TrustItem text="No credit card required" />
                  <TrustItem text="Instant insights" />
                  <TrustItem text="Nordic focused" />
                </div>
              </div>

              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section
          style={{
            padding: '10px 0 38px',
          }}
        >
          <div style={styles.container}>
            <div
              style={{
                borderTop: '1px solid #E5E2DC',
                borderBottom: '1px solid #E5E2DC',
                padding: '24px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 38,
                color: '#7A7D86',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <span>TECHNICAL SEO</span>
              <span>AI CITATION TRACKING</span>
              <span>NORDIC KEYWORDS</span>
              <span>LOCAL SEARCH</span>
              <span>ACTIONABLE REPORTING</span>
            </div>
          </div>
        </section>

        {/* Problem statement */}
<section id="platform" style={{ padding: '48px 0 76px' }}>
  <div style={styles.container}>
    <div
      className="landing-platform-section"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 28,
        padding: '68px 56px',
        background:
          'linear-gradient(145deg, #171923 0%, #252941 58%, #3028A8 100%)',
        boxShadow: '0 30px 80px rgba(23,25,35,0.20)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          top: -330,
          right: -150,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(115,103,255,0.34) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          bottom: -260,
          left: -160,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(234,106,59,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: 760,
          margin: '0 auto 42px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: '0 0 14px',
            fontFamily: monoFont,
            color: '#AFA9FF',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          ONE PLATFORM. THREE SIGNALS.
        </p>

        <h2
          style={{
            margin: '0 0 18px',
            color: '#fff',
            fontSize: 'clamp(36px, 4.4vw, 54px)',
            lineHeight: 1.08,
            letterSpacing: '-0.04em',
          }}
        >
          Understand exactly how your business is discovered.
        </h2>

        <p
          style={{
            maxWidth: 650,
            margin: '0 auto',
            color: '#C9CBD8',
            fontSize: 16,
            lineHeight: 1.75,
          }}
        >
          Combine technical SEO, AI visibility and Nordic search intelligence
          in one clear view.
        </p>
      </div>

      <div
        className="landing-platform-cards"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <div className="landing-platform-card">
          <div className="landing-platform-icon">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </div>

          <p className="landing-platform-label">TECHNICAL SEO</p>
          <h3>Fix what blocks growth</h3>
          <p>
            Find crawl errors, broken links, weak metadata and performance
            issues that limit search visibility.
          </p>

          <span>Site health and crawl signals</span>
        </div>

        <div className="landing-platform-card landing-platform-card-featured">
          <div className="landing-platform-icon">
            <FontAwesomeIcon icon={faComments} />
          </div>

          <p className="landing-platform-label">AI VISIBILITY</p>
          <h3>See where AI cites you</h3>
          <p>
            Check whether ChatGPT and Claude mention, understand or recommend
            your business.
          </p>

          <span>Mentions, citations and trust</span>
        </div>

        <div className="landing-platform-card">
          <div className="landing-platform-icon">
            <FontAwesomeIcon icon={faLocationDot} />
          </div>

          <p className="landing-platform-label">NORDIC SEARCH</p>
          <h3>Win your local market</h3>
          <p>
            Analyse Norwegian keywords, local intent and search patterns built
            for Nordic businesses.
          </p>

          <span>Keywords and regional signals</span>
        </div>
      </div>
    </div>
  </div>
</section>

{/* Features */}
        <section id="features" style={{ padding: '64px 0 76px' }}>
          <div style={styles.container}>
            <SectionHeader
              eyebrow="PLATFORM CAPABILITIES"
              title="One platform for search and AI visibility"
              description="Understand how search engines and AI platforms see your business, then act on the opportunities that matter most."
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
              eyebrow="SIMPLE WORKFLOW"
              title="From domain to decisions in three steps"
              description="Run the analysis, understand the signals and follow a prioritised plan for improvement."
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
            Ã‚Â© {new Date().getFullYear()} Devndespro. Built in Stavanger, Norway.
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
                  Ã¢â‚¬Å“Best CRM platform for shipping companies in NorwayÃ¢â‚¬Â
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
    <div className="landing-section-header">
      <div className="landing-section-eyebrow">
        <span className="landing-section-eyebrow-dot" />
        {eyebrow}
      </div>

      <h2>{title}</h2>

      <p>{description}</p>
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









