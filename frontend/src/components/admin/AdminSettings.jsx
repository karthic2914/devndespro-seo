import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faUsers, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons'
import api from '../../utils/api'
import { Card, PageHeader, T, Button } from '../UI'

const MODULES = [
  { key: 'module_backlinks', label: 'Backlinks', help: 'Show Backlinks in project navigation (still needs paid unlock per user).' },
  { key: 'module_ai_assistant', label: 'AI Assistant', help: 'Currently hidden in the app nav. Turn on here later, then remove the nav `hidden` flag in Layout.jsx to show it again.' },
  { key: 'module_ai_visibility', label: 'AI Visibility', help: 'Show AI Visibility for all project users.' },
  { key: 'module_competitors', label: 'Competitors', help: 'Show Competitors page.' },
  { key: 'module_email_reports', label: 'Email Reports', help: 'Show Email Reports page.' },
  { key: 'module_cold_emails', label: 'Cold Email', help: 'Show Cold Email page (sending also uses toggle below).' },
]

function ToggleRow({ label, help, checked, disabled, onToggle }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      padding: '12px 0',
      borderBottom: `1px solid ${T.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
        {help && <div style={{ fontSize: 12, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>{help}</div>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        style={{
          border: 0,
          background: 'transparent',
          color: checked ? T.green || '#16A34A' : '#94A3B8',
          fontSize: 28,
          lineHeight: 1,
          cursor: disabled ? 'wait' : 'pointer',
          padding: 0,
        }}
        aria-label={checked ? 'Disable' : 'Enable'}
      >
        <FontAwesomeIcon icon={checked ? faToggleOn : faToggleOff} />
      </button>
    </div>
  )
}

export default function AdminSettings() {
  const navigate = useNavigate()
  const [coldEmailsEnabled, setColdEmailsEnabled] = useState(true)
  const [notifyOnNewSite, setNotifyOnNewSite] = useState(true)
  const [notifyOnPurchase, setNotifyOnPurchase] = useState(true)
  const [sendWelcomeOnPurchase, setSendWelcomeOnPurchase] = useState(true)
  const [modules, setModules] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/settings')
      .then(r => {
        setColdEmailsEnabled(!!r.data?.cold_emails_enabled)
        setNotifyOnNewSite(!!r.data?.notify_on_new_site)
        setNotifyOnPurchase(r.data?.notify_on_purchase !== false)
        setSendWelcomeOnPurchase(r.data?.send_welcome_on_purchase !== false)
        setModules(r.data?.modules || {})
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (key, current) => {
    setSaving(true)
    setError('')
    setSavedMsg('')
    try {
      await api.post('/settings', { key, value: !current })
      if (key === 'cold_emails_enabled') setColdEmailsEnabled(!current)
      else if (key === 'notify_on_new_site') setNotifyOnNewSite(!current)
      else if (key === 'notify_on_purchase') setNotifyOnPurchase(!current)
      else if (key === 'send_welcome_on_purchase') setSendWelcomeOnPurchase(!current)
      else setModules(prev => ({ ...prev, [key]: !current }))
      setSavedMsg('Saved')
      setTimeout(() => setSavedMsg(''), 1500)
    } catch {
      setError('Failed to update setting')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        title="Settings"
        subtitle="Platform controls - pages, notifications, and access rules."
      />

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <FontAwesomeIcon icon={faGear} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Pages & modules</strong>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8, lineHeight: 1.5 }}>
          Turn modules off to hide them for everyone. Paid unlocks still apply on top for Backlinks / AI Assistant / KW Pro.
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: T.muted, padding: '12px 0' }}>Loading…</div>
        ) : MODULES.map(m => (
          <ToggleRow
            key={m.key}
            label={m.label}
            help={m.help}
            checked={modules[m.key] !== false}
            disabled={loading || saving}
            onToggle={() => handleToggle(m.key, modules[m.key] !== false)}
          />
        ))}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>Platform</strong>
        <ToggleRow
          label="Enable cold email sending"
          help="When off, cold emails will not send even if the page is visible."
          checked={coldEmailsEnabled}
          disabled={loading || saving}
          onToggle={() => handleToggle('cold_emails_enabled', coldEmailsEnabled)}
        />
        <ToggleRow
          label="Notify admin on new site"
          help="Email admin when a user adds a website."
          checked={notifyOnNewSite}
          disabled={loading || saving}
          onToggle={() => handleToggle('notify_on_new_site', notifyOnNewSite)}
        />
        <ToggleRow
          label="Notify admin on purchase"
          help="Email admin when billing webhook upgrades a user to Pro or Agency."
          checked={notifyOnPurchase}
          disabled={loading || saving}
          onToggle={() => handleToggle('notify_on_purchase', notifyOnPurchase)}
        />
        <ToggleRow
          label="Send welcome email on upgrade"
          help="Email the buyer an onboarding welcome when they move to Pro or Agency."
          checked={sendWelcomeOnPurchase}
          disabled={loading || saving}
          onToggle={() => handleToggle('send_welcome_on_purchase', sendWelcomeOnPurchase)}
        />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FontAwesomeIcon icon={faUsers} style={{ color: T.orange }} />
              <strong style={{ fontSize: 14 }}>Per-user access</strong>
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
              Assign Free / Pro / Agency plans on the Users page.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/users')}>
            Open Users
          </Button>
        </div>
      </Card>

      {savedMsg && <div style={{ fontSize: 12, color: '#15803d', marginBottom: 8 }}>{savedMsg}</div>}
      {error && <div style={{ fontSize: 13, color: '#DC2626' }}>{error}</div>}
    </div>
  )
}
