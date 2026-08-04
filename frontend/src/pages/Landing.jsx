import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faComments,
  faMagnifyingGlass,
  faLocationDot,
  faRobot,
  faListCheck,
  faChartLine,
  faCheck,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, Button, T } from '../components/UI'

const FEATURES = [
  { icon: faComments,        label: 'AI Visibility',        desc: 'Test whether ChatGPT and Claude cite your domain', lead: true },
  { icon: faMagnifyingGlass, label: 'Full Site Audit',      desc: 'Crawl up to 100 pages for real issues, not just the homepage', lead: true },
  { icon: faLocationDot,     label: 'Nordic Search Signals', desc: 'Norwegian keyword classification and local search patterns' },
  { icon: faRobot,           label: 'AI Recommendations',   desc: 'Fix suggestions written for the exact issue found' },
  { icon: faListCheck,       label: 'Action Plans',         desc: 'Every issue turned into a ranked next step' },
  { icon: faChartLine,       label: 'Rank & Link Tracking', desc: 'Keyword positions and backlink monitoring, included' },
]

const STEPS = [
  { n: '01', title: 'Crawl the site',    desc: 'Up to 100 pages, sitemap and link discovery' },
  { n: '02', title: 'Score every page',  desc: 'On-page, technical, content, and speed - plus AI citation testing' },
  { n: '03', title: 'Fix what matters',  desc: 'Ranked actions, AI written fixes' },
]

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, #FFF4EE 0%, #F3F4F6 50%, #EFF6FF 100%)`,
      fontFamily: 'inherit',
    }}>

      {/* Nav */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo size="md" variant="transparent" />
        <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 2rem 2.5rem' }}>
        <div className='login-hero-grid' style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 36, alignItems: 'center' }}>
          <div>
            <p style={{ fontFamily: monoFont, fontSize: 11, color: T.orange, letterSpacing: '0.08em', margin: '0 0 14px' }}>
              AI VISIBILITY FOR NORDIC BUSINESSES
            </p>
            <h1 style={{ fontSize: 40, fontWeight: 800, color: T.text, lineHeight: 1.1, letterSpacing: '-0.01em', margin: '0 0 18px' }}>
              Google still ranks you.<br />Does AI even know you exist?
            </h1>
            <p style={{ fontSize: 15, color: T.text2, lineHeight: 1.7, margin: '0 0 24px', maxWidth: 440 }}>
              ChatGPT and Claude are answering the questions your customers used to type into
              search. This tool tests whether your site shows up in those answers, audits your
              whole site for the issues holding you back, and reads local search signals most
              global tools skip.
            </p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
              <span style={{ fontSize: 13, color: T.muted }}>Private access &middot; invite only</span>
            </div>
          </div>

          {/* Dual citation receipts */}
          <div style={{ position: 'relative', height: 260 }}>
            <div style={{
              position: 'absolute', top: 26, left: 34, width: '88%',
              background: T.surface2, border: `0.5px solid ${T.border}`, borderRadius: 10,
              padding: '1rem 1.2rem', fontFamily: monoFont, transform: 'rotate(2deg)',
            }}>
              <p style={{ fontSize: 10, color: T.muted, margin: '0 0 8px' }}>ASK CHATGPT</p>
              <p style={{ fontSize: 12, color: T.text, margin: '0 0 10px' }}>
                "top logistics software norway"
              </p>
              <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: T.amberDim, color: '#92400E', fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  <FontAwesomeIcon icon={faXmark} style={{ fontSize: 10 }} />
                  Not mentioned
                </span>
              </div>
            </div>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '88%',
              background: '#fff', border: `0.5px solid ${T.border}`, borderRadius: 10,
              padding: '1.1rem 1.3rem', fontFamily: monoFont, transform: 'rotate(-2deg)',
              boxShadow: T.shadow,
            }}>
              <p style={{ fontSize: 10, color: T.muted, margin: '0 0 8px' }}>ASK CLAUDE</p>
              <p style={{ fontSize: 12, color: T.text, margin: '0 0 10px' }}>
                "best crm for shipping companies in norway"
              </p>
              <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: T.text2, lineHeight: 1.6, margin: 0 }}>
                  "...compfly.ai stands out for its focus on freight coordination..."
                </p>
              </div>
              <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />
                  Cited
                </span>
                <span style={{ fontSize: 11, color: T.muted }}>compfly.ai</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem 2rem' }}>
        <div className='login-features-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{
              background: f.lead ? '#fff' : T.surface2,
              border: f.lead ? `1px solid ${T.orange}` : 'none',
              borderRadius: T.radius, padding: '1.1rem',
            }}>
              <FontAwesomeIcon icon={f.icon} style={{ fontSize: 18, color: f.lead ? T.orange : T.text2 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '10px 0 4px' }}>{f.label}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dark band - why it matters */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem 2.5rem' }}>
        <div style={{ background: '#14171F', borderRadius: 12, padding: '2.25rem 2rem' }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.5, margin: '0 0 10px', maxWidth: 580 }}>
            Ahrefs and SEMrush treat Norway the same as everywhere else. Global backlink index,
            global keyword data, no read on how AI engines talk about Nordic businesses.
          </p>
          <p style={{ fontFamily: monoFont, fontSize: 12, color: '#9CA3AF', margin: 0 }}>
            We built this for the market they're not paying attention to.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem 2.5rem' }}>
        <p style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, letterSpacing: '0.06em', margin: '0 0 18px' }}>
          HOW IT WORKS
        </p>
        <div className='login-steps-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {STEPS.map(s => (
            <div key={s.n}>
              <p style={{ fontFamily: monoFont, fontSize: 22, color: T.orange, margin: '0 0 8px' }}>{s.n}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 4px' }}>{s.title}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Closing CTA */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem 3rem' }}>
        <div style={{ background: '#FFF4EE', borderRadius: 12, padding: '2.25rem 2rem', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '0 0 8px' }}>
            Ready to see where you stand?
          </p>
          <p style={{ fontSize: 13, color: T.text2, margin: '0 0 20px' }}>
            Private access &middot; invite only
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>Sign in</Button>
          <p style={{ fontSize: 12, color: T.muted, marginTop: '1.5rem', lineHeight: 1.6 }}>
            devndespro.com &middot; SEO Management Platform
          </p>
        </div>
      </div>

    </div>
  )
}