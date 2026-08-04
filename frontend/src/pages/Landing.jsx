import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faComments,
  faMagnifyingGlass,
  faLocationDot,
  faRobot,
  faListCheck,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, T } from '../components/UI'

const FEATURES = [
  { icon: faComments,        label: 'AI visibility',         desc: 'Test whether ChatGPT and Claude cite your domain' },
  { icon: faMagnifyingGlass, label: 'Full site audit',       desc: 'Crawl up to 100 pages for real issues' },
  { icon: faLocationDot,     label: 'Nordic search signals', desc: 'Norwegian keyword classification and local patterns' },
  { icon: faRobot,           label: 'AI recommendations',    desc: 'Fix suggestions written for the exact issue' },
  { icon: faListCheck,       label: 'Action plans',          desc: 'Every issue turned into a ranked next step' },
  { icon: faChartLine,       label: 'Rank and link tracking', desc: 'Keyword positions and backlinks, included' },
]

const STEPS = [
  { n: '01', title: 'Crawl the site',    desc: 'Up to 100 pages, sitemap and link discovery' },
  { n: '02', title: 'Score every page',  desc: 'On-page, technical, content, and AI citation testing' },
  { n: '03', title: 'Fix what matters',  desc: 'Ranked actions, AI written fixes' },
]

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"
const serifFont = "Georgia, 'Times New Roman', serif"

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem' }}>

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', marginBottom: '2.5rem' }}>
          <Logo size="md" variant="transparent" />
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'transparent', color: T.text, border: `0.5px solid ${T.border}`,
              padding: '0 20px', height: 36, borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign in
          </button>
        </div>

        {/* Hero */}
        <div className='login-hero-grid' style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 56, alignItems: 'center', paddingBottom: '4rem' }}>
          <div>
            <p style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, letterSpacing: '0.1em', margin: '0 0 20px' }}>
              AI VISIBILITY FOR NORDIC BUSINESSES
            </p>
            <h1 style={{ fontSize: 42, fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 22px', color: T.text }}>
              Google still ranks you.<br />Does AI even know you exist?
            </h1>
            <p style={{ fontSize: 16, color: T.text2, lineHeight: 1.75, margin: '0 0 32px', maxWidth: 420 }}>
              ChatGPT and Claude now answer the questions your customers used to search for.
              This tool tests whether you show up in those answers, audits your whole site,
              and reads local search signals most tools skip.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#14171F', color: '#fff', border: 'none',
                padding: '0 26px', height: 44, borderRadius: 6, fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Sign in
            </button>
          </div>

          {/* Citation receipts */}
          <div style={{ position: 'relative', height: 250 }}>
            <div style={{
              position: 'absolute', top: 22, left: 30, width: '86%',
              background: T.surface2, border: `0.5px solid ${T.border}`, borderRadius: 8,
              padding: '1.1rem 1.3rem', fontFamily: monoFont,
            }}>
              <p style={{ fontSize: 10, color: T.muted, margin: '0 0 9px', letterSpacing: '0.04em' }}>ASK CHATGPT</p>
              <p style={{ fontSize: 12, color: T.text, margin: '0 0 11px' }}>"top logistics software norway"</p>
              <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 11 }}>
                <span style={{ color: T.muted, fontSize: 11 }}>Not mentioned</span>
              </div>
            </div>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '86%',
              background: '#fff', border: `0.5px solid ${T.border}`, borderRadius: 8,
              padding: '1.2rem 1.4rem', fontFamily: monoFont, boxShadow: T.shadow,
            }}>
              <p style={{ fontSize: 10, color: T.muted, margin: '0 0 9px', letterSpacing: '0.04em' }}>ASK CLAUDE</p>
              <p style={{ fontSize: 12, color: T.text, margin: '0 0 11px' }}>"best crm for shipping companies in norway"</p>
              <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 11, marginBottom: 11 }}>
                <p style={{ fontSize: 11, color: T.text2, lineHeight: 1.65, margin: 0 }}>
                  "...compfly.ai stands out for its focus on freight coordination..."
                </p>
              </div>
              <div style={{ borderTop: `0.5px solid ${T.border}`, paddingTop: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: T.green, fontSize: 11, fontWeight: 500 }}>Cited</span>
                <span style={{ fontSize: 11, color: T.muted }}>compfly.ai</span>
              </div>
            </div>
          </div>
        </div>

        {/* Editorial pull-quote */}
        <div style={{ padding: '3rem 0', borderTop: `0.5px solid ${T.border}`, textAlign: 'center' }}>
          <p style={{
            fontFamily: serifFont, fontStyle: 'italic', fontSize: 22, fontWeight: 400,
            color: T.text, lineHeight: 1.6, margin: '0 auto', maxWidth: 600,
          }}>
            Most SEO tools measure how Google sees you. We measure how AI does too.
          </p>
        </div>

        {/* Feature grid - hairline divided */}
        <div
          className='login-features-grid'
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1,
            background: T.border, borderTop: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`,
            marginBottom: '4rem',
          }}
        >
          {FEATURES.map(f => (
            <div key={f.label} style={{ background: T.surface2, padding: '1.5rem' }}>
              <FontAwesomeIcon icon={f.icon} style={{ fontSize: 20, color: T.text }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: T.text, margin: '14px 0 6px' }}>{f.label}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ paddingBottom: '2rem' }}>
          <p style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, letterSpacing: '0.1em', margin: '0 0 24px' }}>
            HOW IT WORKS
          </p>
          <div className='login-steps-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {STEPS.map(s => (
              <div key={s.n}>
                <p style={{ fontFamily: monoFont, fontSize: 20, color: T.muted, margin: '0 0 10px' }}>{s.n}</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: T.text, margin: '0 0 5px' }}>{s.title}</p>
                <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Closing CTA */}
        <div style={{ padding: '3.5rem 0 4rem', borderTop: `0.5px solid ${T.border}`, textAlign: 'center' }}>
          <p style={{ fontSize: 24, fontWeight: 500, color: T.text, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Ready to see where you stand?
          </p>
          <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px' }}>
            Private access, invite only
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: '#14171F', color: '#fff', border: 'none',
              padding: '0 26px', height: 44, borderRadius: 6, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign in
          </button>
        </div>

      </div>
    </div>
  )
}