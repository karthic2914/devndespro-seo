import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEnvelope,
  faPlus,
  faTrash,
  faPaperPlane,
  faToggleOn,
  faToggleOff,
  faClock,
  faCircleCheck,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import { PageHeader, Button } from '../components/UI'
import api from '../utils/api'

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 === 0 ? 12 : i % 12
  const ampm = i < 12 ? 'AM' : 'PM'
  return { value: i, label: `${h}:00 ${ampm} (UTC)` }
})

export default function EmailReports() {
  const { siteId } = useParams()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [smtpOk, setSmtpOk] = useState(null)

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get(`/sites/${siteId}/email-report`)
      setSettings({
        enabled: !!data.enabled,
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
        send_hour: data.send_hour ?? 8,
        last_sent_at: data.last_sent_at,
      })
    } catch {
      toast.error('Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const save = async (patch) => {
    setSaving(true)
    try {
      const updated = { ...settings, ...patch }
      const { data } = await api.put(`/sites/${siteId}/email-report`, updated)
      setSettings({
        enabled: !!data.enabled,
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
        send_hour: data.send_hour ?? 8,
        last_sent_at: data.last_sent_at,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    if (settings.recipients.includes(email)) {
      toast.error('Email already added')
      return
    }
    const updated = { ...settings, recipients: [...settings.recipients, email] }
    setSettings(updated)
    setNewEmail('')
    save(updated)
  }

  const removeEmail = (email) => {
    const updated = { ...settings, recipients: settings.recipients.filter(e => e !== email) }
    setSettings(updated)
    save(updated)
  }

  const toggleEnabled = () => {
    const updated = { ...settings, enabled: !settings.enabled }
    setSettings(updated)
    save(updated)
  }

  const changeHour = (h) => {
    const updated = { ...settings, send_hour: parseInt(h) }
    setSettings(updated)
    save(updated)
  }

  const sendNow = async () => {
    if (!settings.recipients.length) {
      toast.error('Add at least one recipient first')
      return
    }
    setSending(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/email-report/send-now`, {
        recipients: settings.recipients,
      })
      setSmtpOk(true)
      toast.success(`Report sent to ${data.sent_to.join(', ')}`)
      fetchSettings()
    } catch (e) {
      setSmtpOk(false)
      toast.error(e.response?.data?.error || 'Failed to send. Check SMTP settings.')
    } finally {
      setSending(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="fade-in page-content">
        <PageHeader title="Email Reports" subtitle="Daily SEO summary emails" />
        <div style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Loading...</div>
      </div>
    )
  }

  const hourLabel = HOURS.find(h => h.value === settings.send_hour)?.label || `${settings.send_hour}:00 UTC`

  return (
    <div className="fade-in page-content">
      <PageHeader
        title="Email Reports"
        subtitle="Send a comprehensive daily SEO report to your customers"
        action={
          <Button onClick={sendNow} disabled={sending || !settings.recipients.length}>
            <FontAwesomeIcon icon={faPaperPlane} />
            {sending ? 'Sending...' : 'Send Report Now'}
          </Button>
        }
      />

      {/* SMTP info banner */}
      <div style={{
        background: 'var(--dark3)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 18px',
        marginBottom: 24,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        <FontAwesomeIcon icon={faCircleInfo} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>SMTP Setup Required</strong> — Add these to your backend{' '}
          <code style={{ background: 'var(--dark2)', padding: '1px 6px', borderRadius: 4 }}>.env</code> file:
          <br />
          <code style={{ background: 'var(--dark2)', padding: '4px 8px', borderRadius: 4, display: 'inline-block', marginTop: 6, fontSize: 12 }}>
            SMTP_HOST=smtp.gmail.com &nbsp; SMTP_PORT=587 &nbsp; SMTP_USER=you@gmail.com &nbsp; SMTP_PASS=app-password &nbsp; SMTP_FROM="SEO Reports &lt;you@gmail.com&gt;"
          </code>
          <br />
          <span style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            For Gmail, use an App Password (Settings → Security → 2-Step Verification → App passwords).
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Enable Toggle */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Daily Reports</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {settings.enabled ? 'Active — sending daily' : 'Disabled — no reports will be sent'}
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: settings.enabled ? 'var(--green)' : 'var(--border)', lineHeight: 1 }}
              title={settings.enabled ? 'Disable' : 'Enable'}
            >
              <FontAwesomeIcon icon={settings.enabled ? faToggleOn : faToggleOff} />
            </button>
          </div>
          {settings.last_sent_at && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ color: 'var(--green)', marginRight: 6 }} />
              Last sent: {new Date(settings.last_sent_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Send Time */}
        <div className="card" style={{ padding: '20px 22px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            <FontAwesomeIcon icon={faClock} style={{ marginRight: 8, color: 'var(--orange)' }} />
            Send Time (UTC)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Report is sent once per day at this hour (UTC timezone).
          </div>
          <select
            value={settings.send_hour}
            onChange={e => changeHour(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--dark2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
            }}
          >
            {HOURS.map(h => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Recipients */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 24 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: 8, color: 'var(--orange)' }} />
          Recipients ({settings.recipients.length})
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          All recipients will receive the full daily SEO report email.
        </div>

        {/* Add email input */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
            placeholder="customer@example.com"
            style={{
              flex: 1,
              background: 'var(--dark2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
            }}
          />
          <Button onClick={addEmail} disabled={saving}>
            <FontAwesomeIcon icon={faPlus} /> Add
          </Button>
        </div>

        {/* Email list */}
        {settings.recipients.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
            No recipients yet. Add an email above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {settings.recipients.map(email => (
              <div key={email} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--dark2)', borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--orange)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }}>
                    {email[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{email}</span>
                </div>
                <button
                  onClick={() => removeEmail(email)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '4px 8px' }}
                  title="Remove"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* What's included */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>What's Included in the Report</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'KPI Overview', desc: 'DR, Health, Clicks, Impressions' },
            { label: 'Top Keywords', desc: 'Position, volume, difficulty' },
            { label: 'Live Backlinks', desc: 'Domain, DR, link type' },
            { label: 'Open Actions', desc: 'Pending SEO tasks by impact' },
            { label: 'Competitors', desc: 'DR comparison & notes' },
            { label: 'Alerts', desc: 'Unread SEO alerts' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--dark2)', borderRadius: 8, padding: '12px 14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ color: 'var(--green)', fontSize: 13 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
