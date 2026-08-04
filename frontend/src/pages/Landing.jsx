import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faLink,
  faMagnifyingGlass,
  faListCheck,
  faRobot,
  faComments,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, Button, T } from '../components/UI'

const FEATURES = [
  { icon: faMagnifyingGlass, label: 'On-Page Audit',       desc: 'Crawl every page for titles, meta, schema, and speed' },
  { icon: faChartLine,       label: 'Keyword Rankings',    desc: 'Track position changes across your target terms' },
  { icon: faLink,            label: 'Backlink Monitor',    desc: 'See who links to you and how strong those links are' },
  { icon: faListCheck,       label: 'Action Plans',        desc: 'Every issue turned into a ranked next step' },
  { icon: faRobot,           label: 'AI Recommendations',  desc: 'Fix suggestions written for the exact issue found' },
  { icon: faComments,        label: 'AI Visibility',       desc: 'Test whether ChatGPT and Claude cite your domain' },
]

const STEPS = [
  { n: '01', title: 'Crawl the site',    desc: 'Up to 100 pages, sitemap and link discovery' },
  { n: '02', title: 'Score every page',  desc: 'On-page, technical, content, and speed' },
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

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '2rem 2rem 0', display: 'flex', justifyContent: 'center' }}>
        <Logo size="md" variant="transparent" />
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '2.5rem 2rem 1rem' }}>
        <div className='login-hero-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: T.text, lineHeight: 1.2, margin: '0 0 14px' }}>
              Get found on Google.<br />Get cited by AI.
            </h1>
            <p style={{ fontSize: 15, color: T.text2, lineHeight: 1.7, margin: '0 0 22px', maxWidth: 440 }}>
              Full site audits, keyword tracking, and backlink monitoring - plus something most
              SEO tools skip: proof that ChatGPT and Claude actually mention your site.
            </p>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </div>

          <div style={{
            background: '#fff', border: `1px solid ${T.border}`, borderRadius: T.radius,
            padding: '1.25rem 1.5rem', boxShadow: T.shadow, fontFamily: monoFont,
          }}>
            <p style={{ fontSize: 11, color: T.muted, margin: '0 0 10px', letterSpacing: '0.05em' }}>ASK CLAUDE</p>
            <p style={{ fontSize: 13, color: T.text, margin: '0 0 14px' }}>
              "best crm for shipping companies in norway"
            </p>
            <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: T.text2, lineHeight: 1.7, margin: 0 }}>
                "...compfly.ai stands out for its focus on freight coordination and real time..."
              </p>
            </div>
            <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: T.greenDim, color: T.green, fontSize: 12, fontWeight: 600,
                padding: '3px 10px', borderRadius: T.radius,
              }}>
                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} />
                Cited
              </span>
              <span style={{ fontSize: 12, color: T.muted }}>compfly.ai</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 2rem', borderTop: `1px solid ${T.border}` }}>
        <div className='login-features-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{ background: T.surface2, borderRadius: T.radius, padding: '1rem' }}>
              <FontAwesomeIcon icon={f.icon} style={{ fontSize: 18, color: T.text2 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '10px 0 4px' }}>{f.label}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.5rem 2rem 3rem', borderTop: `1px solid ${T.border}` }}>
        <p style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, letterSpacing: '0.06em', margin: '0 0 16px' }}>
          HOW IT WORKS
        </p>
        <div className='login-steps-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {STEPS.map(s => (
            <div key={s.n}>
              <p style={{ fontFamily: monoFont, fontSize: 20, color: T.muted, margin: '0 0 6px' }}>{s.n}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: '0 0 4px' }}>{s.title}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '0 2rem 3rem' }}>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign in
        </Button>
        <p style={{ fontSize: 12, color: T.muted, marginTop: '1rem', lineHeight: 1.6 }}>
          devndespro.com &middot; SEO Management Platform<br />
          <span style={{ color: T.orange }}>&#9679;</span> Private access only
        </p>
      </div>

    </div>
  )
}