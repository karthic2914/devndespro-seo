import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // loading | success | error
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('Invalid invite link — no token found.')
      return
    }
    api.get(`/users/accept?token=${token}`)
      .then(r => {
        setEmail(r.data.email || '')
        setStatus('success')
        setTimeout(() => navigate('/login'), 3000)
      })
      .catch(e => {
        setStatus('error')
        setError(e.response?.data?.error || 'This invite link has expired or already been used.')
      })
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F9F9FB', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '48px 40px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#E66A39', letterSpacing: '-0.02em' }}>
            DevNdesPro SEO
          </div>
        </div>

        {status === 'loading' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
              Verifying your invite...
            </h2>
            <p style={{ color: '#888', fontSize: 14 }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#22C55E', margin: '0 0 8px' }}>
              Invite Accepted!
            </h2>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              {email && <><strong>{email}</strong><br /></>}
              Your account is ready. Redirecting you to login...
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#E66A39', color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 8, fontSize: 15,
                fontWeight: 700, cursor: 'pointer', width: '100%',
              }}
            >
              Go to Login →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#EF4444', margin: '0 0 8px' }}>
              Invite Invalid
            </h2>
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              {error}
            </p>
            <p style={{ color: '#999', fontSize: 12 }}>
              Contact your admin to send a new invite.
            </p>
          </>
        )}
      </div>
    </div>
  )
}