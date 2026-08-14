import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faBell, faPlug, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, T, Button } from '../components/UI'
import { PLAN_META } from '../utils/features'

function ToggleRow({ label, help, checked, disabled, onToggle }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 0',
      borderBottom: `1px solid ${T.border}`,
      cursor: disabled ? 'default' : 'pointer',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
        {help && <div style={{ fontSize: 12, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>{help}</div>}
      </div>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={onToggle}
        style={{ marginTop: 4, width: 18, height: 18 }}
      />
    </label>
  )
}

export default function UserSettings() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [weeklyRankEmail, setWeeklyRankEmail] = useState(true)
  const [auditAlertEmail, setAuditAlertEmail] = useState(true)
  const [access, setAccess] = useState(null)
  const [plans, setPlans] = useState([])
  const [checkoutEnabled, setCheckoutEnabled] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const upgraded = params.get('upgraded') === '1'
    const planParam = params.get('plan') || 'paid'

    if (params.get('checkout') === 'cancel') {
      setError('Checkout cancelled — no charge was made.')
      window.history.replaceState({}, '', '/settings')
      return
    }

    if (!upgraded && !sessionId) return

    let cancelled = false
    ;(async () => {
      try {
        if (sessionId) {
          await api.post('/billing/confirm-session', { sessionId })
        }
        if (refreshUser) await refreshUser()
        const me = await api.get('/settings/me')
        if (cancelled) return
        setAccess(me.data?.access || null)
        setMsg(`You're on ${planParam} — welcome! Features are unlocked.`)
      } catch (e) {
        if (!cancelled) {
          setMsg(`Payment received — activating ${planParam}. Refresh in a moment if features are still locked.`)
          if (refreshUser) refreshUser()
        }
      } finally {
        window.history.replaceState({}, '', '/settings')
      }
    })()

    return () => { cancelled = true }
  }, [refreshUser])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/settings/me'),
      api.get('/billing/plans').catch(() => ({ data: null })),
    ])
      .then(([me, billing]) => {
        const data = me.data
        setName(data?.profile?.name || user?.name || '')
        setWeeklyRankEmail(!!data?.preferences?.weekly_rank_email)
        setAuditAlertEmail(!!data?.preferences?.audit_alert_email)
        setAccess(data?.access || null)
        const fromBilling = Array.isArray(billing.data?.plans) ? billing.data.plans : null
        setPlans(fromBilling || (Array.isArray(data?.plans) ? data.plans : []))
        setCheckoutEnabled(!!billing.data?.checkoutEnabled)
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [user?.name])

  const startCheckout = async (planId) => {
    if (planId === 'free') return
    setCheckoutPlan(planId)
    setError('')
    try {
      const { data } = await api.post('/billing/checkout', { plan: planId })
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setError(data?.error || 'Checkout unavailable')
    } catch (e) {
      setError(e.response?.data?.error || 'Checkout failed')
    }
    setCheckoutPlan(null)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setMsg('')
    try {
      await api.post('/settings/me', {
        name,
        weekly_rank_email: weeklyRankEmail,
        audit_alert_email: auditAlertEmail,
      })
      if (refreshUser) await refreshUser()
      setMsg('Saved')
      setTimeout(() => setMsg(''), 1500)
    } catch {
      setError('Failed to save')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        title="Settings"
        subtitle="Your profile and notification preferences."
      />

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FontAwesomeIcon icon={faUser} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Profile</strong>
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: T.muted }}>Loading…</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 4, textTransform: 'uppercase' }}>Email</div>
              <div style={{ fontSize: 13, color: T.text }}>{user?.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, marginBottom: 4, textTransform: 'uppercase' }}>Display name</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  width: '100%',
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 13,
                }}
              />
            </div>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <FontAwesomeIcon icon={faBell} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Notifications</strong>
        </div>
        <ToggleRow
          label="Weekly rank email"
          help="Get a weekly summary when rank scans complete."
          checked={weeklyRankEmail}
          disabled={loading || saving}
          onToggle={() => setWeeklyRankEmail(v => !v)}
        />
        <ToggleRow
          label="Audit alert emails"
          help="Email me when important audit issues are found."
          checked={auditAlertEmail}
          disabled={loading || saving}
          onToggle={() => setAuditAlertEmail(v => !v)}
        />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <FontAwesomeIcon icon={faPlug} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Current plan</strong>
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: T.muted }}>Loading…</div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}>
              {(plans.length ? plans : Object.values(PLAN_META)).map(p => {
                const active = (access?.plan || 'free') === p.id
                const price = p.priceLabel || (p.priceNok === 0 ? '0 kr' : `${p.priceNok} kr/mo`)
                const canBuy = p.id !== 'free' && !active
                return (
                  <div
                    key={p.id}
                    style={{
                      border: `2px solid ${active ? T.orange : T.border}`,
                      borderRadius: 10,
                      padding: '12px 12px 14px',
                      background: active ? '#FFF7F3' : '#fff',
                      boxShadow: active ? '0 0 0 1px rgba(230,106,57,0.12)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      marginBottom: 6,
                    }}>
                      <strong style={{ fontSize: 13, color: T.text }}>{p.label}</strong>
                      {active && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: '#C2410C',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 6 }}>
                      {price}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, marginBottom: 8 }}>
                      {p.blurb}
                    </div>
                    <ul style={{ margin: '0 0 12px', paddingLeft: 16, fontSize: 11, color: T.text2, lineHeight: 1.55, flex: 1 }}>
                      {(p.bullets || []).map(b => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {canBuy && (
                      <button
                        type="button"
                        disabled={!!checkoutPlan}
                        onClick={() => startCheckout(p.id)}
                        style={{
                          width: '100%',
                          border: 0,
                          borderRadius: 8,
                          padding: '9px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: checkoutPlan ? 'wait' : 'pointer',
                          background: checkoutEnabled ? T.orange : '#F1F5F9',
                          color: checkoutEnabled ? '#fff' : '#64748B',
                        }}
                      >
                        {checkoutPlan === p.id
                          ? 'Redirecting…'
                          : checkoutEnabled
                          ? `Select ${p.label} — pay`
                          : `Request ${p.label}`}
                      </button>
                    )}
                    {p.id === 'free' && !active && (
                      <div style={{ fontSize: 11, color: T.muted, textAlign: 'center' }}>Included by default</div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55, marginBottom: 10 }}>
              {checkoutEnabled
                ? 'Low launch pricing: Pro 199 kr/mo · Agency 499 kr/mo. Pay with card via Stripe — unlocks instantly after checkout.'
                : 'Stripe is not configured yet (add STRIPE_SECRET_KEY on the server). Until then an admin can assign your plan on Users.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'AI Visibility full', on: access?.ai_visibility_full },
                { label: 'Backlinks', on: access?.backlinks },
                { label: 'AI Assistant', on: access?.ai_assistant },
                { label: 'KW Pro', on: access?.keywords_pro },
                { label: 'Cold Email', on: access?.cold_emails },
              ].map(item => (
                <span
                  key={item.label}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: item.on ? '#DCFCE7' : '#F1F5F9',
                    color: item.on ? '#15803D' : '#64748B',
                  }}
                >
                  {item.label}: {item.on ? 'On' : 'Locked'}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <FontAwesomeIcon icon={faEnvelope} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Shortcuts</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>Projects</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/reports')}>Reports</Button>
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="primary" size="sm" onClick={save} disabled={loading || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {msg && <span style={{ fontSize: 12, color: '#15803d' }}>{msg}</span>}
        {error && <span style={{ fontSize: 12, color: '#DC2626' }}>{error}</span>}
      </div>
    </div>
  )
}
