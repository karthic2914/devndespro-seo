import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGoogleLogin } from '@react-oauth/google'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faLink,
  faMagnifyingGlass,
  faListCheck,
  faRobot,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Logo, Card, Button, Badge, Divider, T } from '../components/UI'

const FEATURES = [
  { icon: faChartLine, label: 'Keyword Rankings' },
  { icon: faLink, label: 'Backlink Monitor' },
  { icon: faMagnifyingGlass, label: 'On-Page Audit' },
  { icon: faListCheck, label: 'Action Plans' },
  { icon: faRobot, label: 'AI Recommendations' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError('')
      try {
        await login(tokenResponse.access_token)
        navigate('/')
      } catch (e) {
        setError(e.response?.data?.error || 'Access denied. You may not be authorised.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google sign-in failed. Please try again.'),
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, #FFF4EE 0%, #F3F4F6 50%, #EFF6FF 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: 'inherit'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo size="lg" variant="transparent" />
          </div>
          <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6 }}>
            The SEO platform that gets your website to <strong style={{ color: T.orange }}>#1 on Google</strong>
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: '1.75rem' }}>
          {FEATURES.map(f => (
            <Badge key={f.label} variant="default" style={{ fontSize: 11, padding: '4px 10px' }}>
              <FontAwesomeIcon icon={f.icon} style={{ marginRight: 6 }} />
              {f.label}
            </Badge>
          ))}
        </div>

        {/* Login card */}
        <Card padding="2rem">
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
              Sign in to your account
            </div>
            <div style={{ fontSize: 13, color: T.muted }}>
              Access is restricted to authorised users only
            </div>
          </div>

          <Divider label="Continue with" style={{ marginBottom: '1.25rem' }} />

          {/* Google button */}
          <button
            onClick={() => handleGoogle()}
            disabled={loading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 12,
              background: loading ? T.surface2 : '#fff',
              color: T.text, border: `1.5px solid ${T.border}`,
              borderRadius: T.radius, padding: '12px 20px',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', boxShadow: T.shadow,
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => !loading && (e.currentTarget.style.borderColor = T.orange)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
          >
            {loading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ animation: 'spin 0.7s linear infinite' }}>
                  <circle cx="9" cy="9" r="7" stroke={T.muted} strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="7" fill="none"/>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                {/* Google G */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 14, background: T.redDim,
              border: `1px solid ${T.red}33`,
              borderRadius: T.radius, padding: '10px 14px',
              fontSize: 13, color: T.red, display: 'flex', gap: 8, alignItems: 'flex-start'
            }}>
              <span style={{ flexShrink: 0 }}><FontAwesomeIcon icon={faTriangleExclamation} /></span>
              {error}
            </div>
          )}
        </Card>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 12, color: T.muted, marginTop: '1.5rem', lineHeight: 1.6 }}>
          devndespro.com · SEO Management Platform<br />
          <span style={{ color: T.orange }}>&#9679;</span> Private access only
        </p>

      </div>
    </div>
  )
}