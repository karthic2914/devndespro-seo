import { useEffect, useState } from 'react'
import api from '../../utils/api'

export default function AdminSettings() {
  const [coldEmailsEnabled, setColdEmailsEnabled] = useState(true)
  const [notifyOnNewSite, setNotifyOnNewSite] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/settings')
      .then(r => {
        setColdEmailsEnabled(!!r.data?.cold_emails_enabled)
        setNotifyOnNewSite(!!r.data?.notify_on_new_site)
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key, valueSetter, value) => {
    setSaving(true)
    setError('')
    try {
      await api.post('/settings', { key, value: !value })
      valueSetter(!value)
    } catch {
      setError('Failed to update setting')
    }
    setSaving(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Admin Settings</h2>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={coldEmailsEnabled}
            onChange={() => handleToggle('cold_emails_enabled', setColdEmailsEnabled, coldEmailsEnabled)}
            disabled={loading || saving}
            style={{ marginRight: 8 }}
          />
          Enable sending cold emails
        </label>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          When disabled, cold emails will not be sent (UI and backend enforced).
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontWeight: 600, fontSize: 15 }}>
          <input
            type="checkbox"
            checked={notifyOnNewSite}
            onChange={() => handleToggle('notify_on_new_site', setNotifyOnNewSite, notifyOnNewSite)}
            disabled={loading || saving}
            style={{ marginRight: 8 }}
          />
          Notify admin on new site added
        </label>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          When disabled, no email will be sent to admin when a user adds a new website.
        </div>
      </div>
      {error && <div style={{ color: 'red', fontSize: 13 }}>{error}</div>}
    </div>
  )
}
