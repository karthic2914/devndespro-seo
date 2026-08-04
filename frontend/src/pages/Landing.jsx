import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faComments,
  faMagnifyingGlass,
  faLocationDot,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Logo, T } from '../components/UI'

const FEATURES = [
  { icon: faComments,        color: '#4338CA', bg: '#E6F1FB', label: 'AI visibility',         desc: 'Test whether ChatGPT and Claude cite your domain' },
  { icon: faMagnifyingGlass, color: '#4338CA', bg: '#E6F1FB', label: 'Full site audit',       desc: 'Crawl up to 100 pages for real issues' },
  { icon: faLocationDot,     color: '#4338CA', bg: '#E6F1FB', label: 'Nordic search signals', desc: 'Norwegian keyword classification and local patterns' },
]

const monoFont = "'SF Mono', 'Consolas', 'Menlo', monospace"

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF9', fontFamily: 'inherit', position: 'relative', overflow: 'hidden' }}>

      {/* Gradient blobs */}
      <div style={{ position: 'absolute', top: -120, right: -100, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, #FDE8D8 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 60, left: -140, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, #E1EEFB 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 2rem', position: 'relative' }}>

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', marginBottom: '2rem' }}>
          <Logo size="md" variant="transparent" />
          <button
            onClick={() => navigate('/login')}
            style={{
              background: '#14171F', color: '#fff', border: 'none',
              padding: '0 20px', height: 36, borderRadius: 6, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign in
          </button>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '1rem 0 3rem' }}>
          <p style={{ fontFamily: monoFont, fontSize: 12, color: T.orange, letterSpacing: '0.1em', margin: '0 0 20px' }}>
            AI VISIBILITY FOR NORDIC BUSINESSES
          </p>
          <h1 style={{
            fontSize: 60, fontWeight: 700, lineHeight: 1.03, letterSpacing: '-0.03em',
            margin: '0 auto 22px', color: T.text, maxWidth: 780,
          }}>
            Be found on Google.<br />Be quoted by AI.
          </h1>
          <p style={{ fontSize: 17, color: T.text2, lineHeight: 1.7, margin: '0 auto 32px', maxWidth: 480 }}>
            The audit and visibility platform built for how people actually search now,
            and built for the Nordic market the big tools ignore.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: T.orange, color: '#fff', border: 'none',
              padding: '0 30px', height: 48, borderRadius: 8, fontSize: 15, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign in
          </button>
        </div>

        {/* Floating dashboard preview */}
        <div style={{
          background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px rgba(20,23,31,0.14)',
          border: `0.5px solid ${T.border}`, padding: '1.75rem 2rem', margin: '0 auto 3rem', maxWidth: 920,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 13, color: T.muted }}>compfly.ai</span>
            <span style={{ fontSize: 11, color: T.muted }}>97 pages crawled</span>
          </div>
          <div className='landing-preview-grid' style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 32, alignItems: 'center' }}>
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="38" fill="none" stroke={T.surface2} strokeWidth="8" />
              <circle cx="45" cy="45" r="38" fill="none" stroke="#EF9F27" strokeWidth="8"
                strokeDasharray="238.8" strokeDashoffset="107" strokeLinecap="round"
                transform="rotate(-90 45 45)" />
              <text x="45" y="52" textAnchor="middle" fontSize="24" fontWeight="700" fill="#854F0B">66</text>
            </svg>
            <div>
              <p style={{ fontSize: 11, color: T.muted, margin: '0 0 10px' }}>SITE HEALTH</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: T.greenDim, color: T.green, fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6 }}>17 healthy</span>
                <span style={{ background: T.amberDim, color: '#854F0B', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 6 }}>4 broken</span>
              </div>
            </div>
            <div style={{ fontFamily: monoFont, borderLeft: `0.5px solid ${T.border}`, paddingLeft: 24 }}>
              <p style={{ fontSize: 10, color: T.muted, margin: '0 0 6px' }}>ASK CLAUDE</p>
              <p style={{ fontSize: 11, color: T.text2, margin: '0 0 8px', lineHeight: 1.5 }}>"best crm for shipping in norway"</p>
              <span style={{ color: T.green, fontSize: 11, fontWeight: 600 }}>
                <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10, marginRight: 4 }} />
                compfly.ai cited
              </span>
            </div>
          </div>
        </div>

        {/* Bold statement block */}
        <div style={{ background: '#4338CA', borderRadius: 16, padding: '3rem', textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.3, margin: '0 auto', maxWidth: 640 }}>
            A growing share of search never reaches Google at all. It goes straight to an AI answer.
          </p>
        </div>

        {/* Feature grid */}
        <div className='landing-features-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: '3rem' }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{ background: T.surface2, borderRadius: 12, padding: '1.5rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <FontAwesomeIcon icon={f.icon} style={{ fontSize: 18, color: f.color }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 500, color: T.text, margin: '0 0 6px' }}>{f.label}</p>
              <p style={{ fontSize: 12, color: T.text2, margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Closing CTA */}
        <div style={{ textAlign: 'center', padding: '2rem 0 4rem' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: '#14171F', color: '#fff', border: 'none',
              padding: '0 30px', height: 48, borderRadius: 8, fontSize: 15, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Sign in
          </button>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 14 }}>Private access, invite only</p>
        </div>

      </div>
    </div>
  )
}