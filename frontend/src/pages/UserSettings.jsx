import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faBell, faPlug, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, T, Button } from '../components/UI'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/settings/me')
      .then(({ data }) => {
        setName(data?.profile?.name || user?.name || '')
        setWeeklyRankEmail(!!data?.preferences?.weekly_rank_email)
        setAuditAlertEmail(!!data?.preferences?.audit_alert_email)
        setAccess(data?.access || null)
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [user?.name])

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
    <div style={{ maxWidth: 640 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FontAwesomeIcon icon={faPlug} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Your plan access</strong>
        </div>
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 8 }}>
          {access?.is_paid
            ? 'Paid plan active — Backlinks, AI Assistant, and keyword premium tools are unlocked.'
            : 'Free access includes Keywords basic, Site Audit, Overview, and more. Upgrade unlocks Backlinks and AI Assistant.'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'Backlinks', on: access?.backlinks },
            { label: 'AI Assistant', on: access?.ai_assistant },
            { label: 'KW Pro', on: access?.keywords_pro },
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
