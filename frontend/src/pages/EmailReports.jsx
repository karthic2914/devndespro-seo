import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import toast from '../utils/toast'
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
  faUsers,
  faCalendarDay,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '../components/UI'
import api from '../utils/api'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import '../styles/app/10-email-reports.css'

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const hour = i % 12 === 0 ? 12 : i % 12
  const period = i < 12 ? 'AM' : 'PM'
  return { value: i, label: `${hour}:00 ${period} (UTC)` }
})

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

const MONTH_DAYS = Array.from({ length: 28 }, (_, index) => index + 1)

const REPORT_ITEMS = [
  { label: 'KPI Overview', desc: 'DR, health, clicks and impressions' },
  { label: 'Top Keywords', desc: 'Position, volume and difficulty' },
  { label: 'Live Backlinks', desc: 'Domain, DR and link type' },
  { label: 'Open Actions', desc: 'Pending SEO tasks by impact' },
  { label: 'Competitors', desc: 'DR comparison and notes' },
  { label: 'Alerts', desc: 'Unread SEO alerts' },
]

export default function EmailReports() {
  const { siteId } = useParams()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [validatingEmail, setValidatingEmail] = useState(false)
  const [smtpOk, setSmtpOk] = useState(null)

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get(`/sites/${siteId}/email-report`)
      setSettings({
        enabled: !!data.enabled,
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
        send_hour: data.send_hour ?? 8,
        frequency: ['daily', 'weekly', 'monthly'].includes(data.frequency) ? data.frequency : 'daily',
        send_weekday: Number.isInteger(data.send_weekday) ? data.send_weekday : 1,
        send_month_day: Number.isInteger(data.send_month_day) ? data.send_month_day : 1,
        last_sent_at: data.last_sent_at,
      })
    } catch {
      toast.error('Failed to load email settings')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined

    let backListener
    let cancelled = false

    CapacitorApp.addListener('backButton', () => {
      const activeElement = document.activeElement

      // Dismiss a focused input or the soft keyboard, then remain here.
      // The native time dialog consumes its own first Back action.
      if (activeElement instanceof HTMLElement) activeElement.blur()
    }).then(listener => {
      if (cancelled) listener.remove()
      else backListener = listener
    })

    const stopEmulatorEscape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()

      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) activeElement.blur()
    }

    document.addEventListener('keydown', stopEmulatorEscape, true)

    return () => {
      cancelled = true
      backListener?.remove()
      document.removeEventListener('keydown', stopEmulatorEscape, true)
    }
  }, [])

  const save = async patch => {
    setSaving(true)
    try {
      const updated = { ...settings, ...patch }
      const { data } = await api.put(`/sites/${siteId}/email-report`, updated)
      setSettings({
        enabled: !!data.enabled,
        recipients: Array.isArray(data.recipients) ? data.recipients : [],
        send_hour: data.send_hour ?? 8,
        frequency: ['daily', 'weekly', 'monthly'].includes(data.frequency) ? data.frequency : 'daily',
        send_weekday: Number.isInteger(data.send_weekday) ? data.send_weekday : 1,
        send_month_day: Number.isInteger(data.send_month_day) ? data.send_month_day : 1,
        last_sent_at: data.last_sent_at,
      })
      toast.success('Settings saved')
      return true
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save settings')
      return false
    } finally {
      setSaving(false)
    }
  }

  const addEmail = async () => {
    if (validatingEmail || saving) return

    const email = newEmail.trim().toLowerCase()
    setEmailError('')

    if (!email) {
      setEmailError('Enter an email address')
      return
    }
    if (settings.recipients.includes(email)) {
      setEmailError('This recipient is already added')
      return
    }

    setValidatingEmail(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/email-report/validate-recipient`, { email })
      const validatedEmail = data.email
      const updated = { ...settings, recipients: [...settings.recipients, validatedEmail] }
      const saved = await save(updated)
      if (saved) {
        setSettings(updated)
        setNewEmail('')
        setEmailError('')
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Email address could not be verified'
      setEmailError(message)
      toast.error(message)
    } finally {
      setValidatingEmail(false)
    }
  }
  const removeEmail = email => {
    const updated = {
      ...settings,
      recipients: settings.recipients.filter(item => item !== email),
    }
    setSettings(updated)
    save(updated)
  }

  const toggleEnabled = () => {
    const updated = { ...settings, enabled: !settings.enabled }
    setSettings(updated)
    save(updated)
  }

  const changeHour = value => {
    const updated = { ...settings, send_hour: Number.parseInt(value, 10) }
    setSettings(updated)
    save(updated)
  }

  const changeFrequency = frequency => {
    const updated = { ...settings, frequency }
    setSettings(updated)
    save(updated)
  }

  const changeWeekday = value => {
    const updated = { ...settings, send_weekday: Number.parseInt(value, 10) }
    setSettings(updated)
    save(updated)
  }

  const changeMonthDay = value => {
    const updated = { ...settings, send_month_day: Number.parseInt(value, 10) }
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
    } catch (error) {
      setSmtpOk(false)
      toast.error(error.response?.data?.error || 'Failed to send. Check SMTP settings.')
    } finally {
      setSending(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="email-reports-page fade-in page-content">
        <div className="er-loading">Loading Email Reports...</div>
      </div>
    )
  }

  const hourLabel = HOURS.find(item => item.value === settings.send_hour)?.label
    || `${settings.send_hour}:00 UTC`

  const scheduleLabel = settings.frequency === 'weekly'
    ? `${WEEKDAYS[settings.send_weekday]}, ${hourLabel}`
    : settings.frequency === 'monthly'
      ? `Day ${settings.send_month_day}, ${hourLabel}`
      : `Daily, ${hourLabel}`

  const deliveryLabel = smtpOk === true
    ? 'Ready'
    : smtpOk === false
      ? 'Needs attention'
      : 'Not tested'

  return (
    <div className="email-reports-page fade-in page-content">
      <header className="er-page-header">
        <div className="er-heading">
          <span className="er-heading-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faEnvelope} />
          </span>
          <div>
            <h1>Email Reports</h1>
            <p>Schedule polished SEO updates for your customers</p>
          </div>
        </div>

        <Button
          className="er-send-now"
          onClick={sendNow}
          disabled={sending || !settings.recipients.length}
        >
          <FontAwesomeIcon icon={faPaperPlane} />
          {sending ? 'Sending...' : 'Send report now'}
        </Button>
      </header>

      <section className="er-status-grid" aria-label="Email report status">
        <article className={`er-status-card ${settings.enabled ? 'is-success' : ''}`}>
          <span className="er-status-icon"><FontAwesomeIcon icon={settings.enabled ? faToggleOn : faToggleOff} /></span>
          <div><small>Automation</small><strong>{settings.enabled ? 'Active' : 'Paused'}</strong></div>
        </article>
        <article className="er-status-card">
          <span className="er-status-icon"><FontAwesomeIcon icon={faCalendarDay} /></span>
          <div><small>Next schedule</small><strong>{settings.enabled ? scheduleLabel : 'Not scheduled'}</strong></div>
        </article>
        <article className="er-status-card">
          <span className="er-status-icon"><FontAwesomeIcon icon={faUsers} /></span>
          <div><small>Recipients</small><strong>{settings.recipients.length} active</strong></div>
        </article>
      </section>

      <details className={`er-delivery-notice ${smtpOk === false ? 'has-error' : ''}`}>
        <summary>
          <span className="er-delivery-copy">
            <FontAwesomeIcon icon={smtpOk === true ? faCircleCheck : faCircleInfo} />
            <span><strong>Email delivery</strong><small>{deliveryLabel}. Open setup details if delivery is unavailable.</small></span>
          </span>
          <span className="er-delivery-state">{deliveryLabel}</span>
        </summary>
        <div className="er-setup-details">
          <p>Add the following values to the backend <code>.env</code> file:</p>
          <code className="er-config-code">
            SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS=app-password SMTP_FROM=&quot;SEO Reports &lt;you@gmail.com&gt;&quot;
          </code>
          <p>For Gmail, create an App Password under Security, 2-Step Verification, App passwords.</p>
        </div>
      </details>

      <div className="er-workspace">
        <section className="er-panel er-settings-panel">
          <div className="er-panel-header">
            <div><h2>Delivery schedule</h2><p>Choose when customers receive the report</p></div>
            <button
              type="button"
              className={`er-toggle ${settings.enabled ? 'is-on' : ''}`}
              onClick={toggleEnabled}
              disabled={saving}
              aria-pressed={settings.enabled}
              aria-label={settings.enabled ? 'Disable daily reports' : 'Enable daily reports'}
            >
              <span>{settings.enabled ? 'Enabled' : 'Disabled'}</span>
              <FontAwesomeIcon icon={settings.enabled ? faToggleOn : faToggleOff} />
            </button>
          </div>

          <div className="er-schedule-row">
            <label htmlFor="er-frequency">Frequency
              <select
                id="er-frequency"
                value={settings.frequency}
                onChange={event => changeFrequency(event.target.value)}
                disabled={saving}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            {settings.frequency === 'weekly' && (
              <label htmlFor="er-weekday">Day of week
                <select
                  id="er-weekday"
                  value={settings.send_weekday}
                  onChange={event => changeWeekday(event.target.value)}
                  disabled={saving}
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>{day}</option>
                  ))}
                </select>
              </label>
            )}

            {settings.frequency === 'monthly' && (
              <label htmlFor="er-month-day">Day of month
                <select
                  id="er-month-day"
                  value={settings.send_month_day}
                  onChange={event => changeMonthDay(event.target.value)}
                  disabled={saving}
                >
                  {MONTH_DAYS.map(day => (
                    <option key={day} value={day}>Day {day}</option>
                  ))}
                </select>
              </label>
            )}
            <label htmlFor="er-send-hour">Send time
              <span className="er-select-wrap er-time-wrap">
                <FontAwesomeIcon icon={faClock} />
                <input
                  id="er-send-hour"
                  className="er-time-input"
                  type="time"
                  step="3600"
                  value={`${String(settings.send_hour).padStart(2, '0')}:00`}
                  onChange={event => {
                    if (!event.target.value) return
                    const hour = Number.parseInt(event.target.value.split(':')[0], 10)
                    if (Number.isInteger(hour)) changeHour(hour)
                  }}
                  disabled={saving}
                />
              </span>
            </label>
          </div>

          {settings.last_sent_at && (
            <div className="er-last-sent">
              <FontAwesomeIcon icon={faCircleCheck} />
              Last sent {new Date(settings.last_sent_at).toLocaleString()}
            </div>
          )}

          <div className="er-divider" />

          <div className="er-panel-header er-recipient-heading">
            <div><h2>Recipients</h2><p>Everyone receives the complete SEO report</p></div>
            <span className="er-count">{settings.recipients.length}</span>
          </div>

          <div className="er-add-recipient">
            <label htmlFor="er-new-email">Email address
              <input
                id="er-new-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                spellCheck={false}
                maxLength={254}
                value={newEmail}
                aria-invalid={emailError ? 'true' : 'false'}
                aria-describedby={emailError ? 'er-email-error' : undefined}
                onChange={event => {
                  setNewEmail(event.target.value)
                  if (emailError) setEmailError('')
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addEmail()
                }}
                placeholder="name@company.com"
              />
              {emailError && <small id="er-email-error" className="er-field-error" role="alert">{emailError}</small>}
            </label>
            <Button onClick={addEmail} disabled={saving || validatingEmail || !newEmail.trim()}>
              <FontAwesomeIcon icon={faPlus} /> {validatingEmail ? 'Checking...' : 'Add recipient'}
            </Button>
          </div>

          {settings.recipients.length === 0 ? (
            <div className="er-empty-state">
              <span><FontAwesomeIcon icon={faEnvelope} /></span>
              <strong>No recipients yet</strong>
              <p>Add a customer email address to enable report delivery.</p>
            </div>
          ) : (
            <div className="er-recipient-list">
              {settings.recipients.map(email => (
                <div className="er-recipient-row" key={email}>
                  <span className="er-avatar">{email[0].toUpperCase()}</span>
                  <span className="er-recipient-email">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    disabled={saving}
                    aria-label={`Remove ${email}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="er-panel er-included-panel">
          <div className="er-panel-header"><div><h2>Report contents</h2><p>Included automatically</p></div></div>
          <div className="er-content-list">
            {REPORT_ITEMS.map(item => (
              <div className="er-content-item" key={item.label}>
                <span><FontAwesomeIcon icon={faCircleCheck} /></span>
                <div><strong>{item.label}</strong><small>{item.desc}</small></div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}