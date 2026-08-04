import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { T } from '../components/UI'

const CHECKS = ['No credit card required', 'Private reports', 'Built in Norway']

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' }}>

      <div style={{ position: 'absolute', top: -100, right: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, #FDE8D8 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -120, left: -100, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, #E6E4FB 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '3rem 2rem', position: 'relative' }}>

        <div className='landing-hero-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 48, alignItems: 'center' }}>

          {/* Left: copy */}
          <div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#FDE8D8', color: T.orange, fontFamily: monoFont,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              padding: '8px 16px', borderRadius: 999, marginBottom: 28,
            }}>
              <FontAwesomeIcon icon={faStar} style={{ fontSize: 11 }} />
              SEARCH VISIBILITY FOR NORDIC BUSINESSES
            </span>

            <h1 style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 22px', color: T.text }}>
              Be discovered by Google.<br />
              <span style={{ color: '#4338CA' }}>Be recommended by AI.</span>
            </h1>

            <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 460 }}>
              Understand how visible your business is across search engines and AI platforms,
              and get a clear plan to improve it.
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: T.orange, color: '#fff', border: 'none',
                  padding: '0 24px', height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 10,
                }}
              >
                Sign in
                <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 13 }} />
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: '#fff', color: T.text, border: `1.5px solid ${T.border}`,
                  padding: '0 24px', height: 48, borderRadius: 8, fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Request access
              </button>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {CHECKS.map(c => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text2 }}>
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: 11, color: T.green }} />
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Right: browser-chrome dashboard preview */}
          <div style={{ position: 'relative' }}>
            <div style={{
              background: '#fff', borderRadius: 16, border: `1.5px solid ${T.text}`,
              boxShadow: '0 28px 64px rgba(20,23,31,0.16)', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: T.surface2, borderBottom: `0.5px solid ${T.border}` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />
                <span style={{ flex: 1, textAlign: 'center', fontFamily: monoFont, fontSize: 11, color: T.muted }}>
                  app.devndespro.com
                </span>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p style={{ fontFamily: monoFont, fontSize: 10, color: T.muted, letterSpacing: '0.06em', margin: 0 }}>WEBSITE OVERVIEW</p>
                  <span style={{ background: T.greenDim, color: T.green, fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>ANALYSIS COMPLETE</span>
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: '0 0 18px' }}>yourdomain.com</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 10, color: T.muted, margin: '0 0 6px', letterSpacing: '0.04em' }}>SITE HEALTH</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>66<span style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>/100</span></p>
                  </div>
                  <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 10, color: T.muted, margin: '0 0 6px', letterSpacing: '0.04em' }}>PAGES SCANNED</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>97</p>
                  </div>
                  <div style={{ background: T.surface2, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 10, color: T.muted, margin: '0 0 6px', letterSpacing: '0.04em' }}>AI CITATIONS</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>4</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 12 }}>
                  <div style={{ border: `0.5px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ fontFamily: monoFont, fontSize: 10, color: T.muted, letterSpacing: '0.04em', margin: '0 0 10px' }}>PRIORITY ISSUES</p>
                    {[['Missing page titles', 8], ['Broken internal links', 4], ['Slow mobile pages', 3]].map(([label, count]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', fontSize: 12 }}>
                        <span style={{ color: T.text2 }}>{label}</span>
                        <span style={{ background: T.amberDim, color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#EEEDFE', borderRadius: 10, padding: '14px 16px', fontFamily: monoFont }}>
                    <p style={{ fontSize: 10, color: '#534AB7', letterSpacing: '0.04em', margin: '0 0 10px' }}>ASK CLAUDE</p>
                    <p style={{ fontSize: 12, color: T.text, margin: '0 0 12px', lineHeight: 1.5 }}>
                      "Best CRM platform for shipping companies in Norway"
                    </p>
                    <span style={{ color: T.green, fontSize: 11, fontWeight: 600 }}>
                      <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, marginRight: 4 }} />
                      Your domain cited
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat card */}
            <div style={{
              position: 'absolute', bottom: -28, right: -20, background: '#fff',
              borderRadius: 12, border: `0.5px solid ${T.border}`, boxShadow: T.shadow,
              padding: '14px 18px',
            }}>
              <p style={{ fontFamily: monoFont, fontSize: 10, color: T.muted, letterSpacing: '0.04em', margin: '0 0 6px' }}>VISIBILITY CHANGE</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: T.green, margin: 0 }}>
                +18% <span style={{ fontSize: 12, fontWeight: 500, color: T.muted }}>this month</span>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}