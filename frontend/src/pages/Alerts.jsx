import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCircleXmark,
  faTriangleExclamation,
  faCircleInfo,
  faCircleCheck,
  faCheckDouble,
  faMagnifyingGlass,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons'
import { Button, PageHeader, Badge, T } from '../components/UI'
import api from '../utils/api'

function severityIcon(severity) {
  if (severity === 'error')   return { icon: faCircleXmark,       color: T.red   }
  if (severity === 'warning') return { icon: faTriangleExclamation, color: T.amber }
  if (severity === 'success') return { icon: faCircleCheck,        color: T.green }
  return                             { icon: faCircleInfo,          color: T.blue  }
}

export default function Alerts() {
  const { siteId } = useParams()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = () =>
    api.get(`/sites/${siteId}/alerts`).then(r => setAlerts(r.data || [])).finally(() => setLoading(false))

  useEffect(() => { load() }, [siteId])

  const markRead = async (id) => {
    await api.put(`/alerts/${id}/read`).catch(() => {})
    setAlerts(p => p.map(a => a.id === id ? { ...a, read: true } : a))
  }

  const markAllRead = async () => {
    await api.put(`/sites/${siteId}/alerts/read-all`).catch(() => {})
    setAlerts(p => p.map(a => ({ ...a, read: true })))
  }

  const unread = alerts.filter(a => !a.read).length
  const filtered = filter === 'all' ? alerts : filter === 'unread' ? alerts.filter(a => !a.read) : alerts.filter(a => a.severity === filter)

  return (
    <div className="fade-in page-content">
      <PageHeader
        title="Alerts"
        subtitle="Notifications from audits, ranking changes, and system events"
        action={unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            <FontAwesomeIcon icon={faCheckDouble} style={{ marginRight: 6 }} />Mark all read
          </Button>
        )}
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--dark2)', padding: 4, borderRadius: 8, border: `1px solid var(--dark3)`, width: 'fit-content' }}>
        {[
          { id: 'all',     label: `All (${alerts.length})` },
          { id: 'unread',  label: `Unread (${unread})` },
          { id: 'error',   label: 'Errors' },
          { id: 'warning', label: 'Warnings' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            background: filter === f.id ? '#fff' : 'transparent',
            border: 'none', padding: '5px 14px', borderRadius: 6, fontSize: 12,
            fontWeight: filter === f.id ? 600 : 400,
            color: filter === f.id ? T.text : T.muted,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: filter === f.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}>{f.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: T.muted, fontSize: 13 }}>
          <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 8 }} />Loading alerts…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ background: 'var(--dark2)', borderRadius: 12, border: `1px solid var(--dark3)`, padding: '4rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.25 }}><FontAwesomeIcon icon={faBell} /></div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
            {filter === 'all' ? 'No alerts yet' : `No ${filter} alerts`}
          </div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Run a site audit to generate alerts for any critical SEO issues found on your pages.
          </div>
          <div style={{ marginTop: 20 }}>
            <Badge variant="info"><FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 6 }} />Run an audit from the Site Audit page</Badge>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: 'var(--dark2)', borderRadius: 12, border: `1px solid var(--dark3)`, overflow: 'hidden' }}>
          {filtered.map((alert, i) => {
            const { icon, color } = severityIcon(alert.severity)
            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderBottom: i < filtered.length - 1 ? `1px solid var(--dark3)` : 'none',
                  background: alert.read ? 'transparent' : `${color}08`,
                  transition: 'background 0.2s',
                }}
              >
                <FontAwesomeIcon icon={icon} style={{ color, fontSize: 16, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: alert.type === 'audit' ? T.orangeDim : T.blueDim,
                      color: alert.type === 'audit' ? T.orange : T.blue,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{alert.type}</span>
                    {!alert.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                  </div>
                  <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{alert.message}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                    {new Date(alert.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!alert.read && (
                  <button onClick={() => markRead(alert.id)} style={{
                    background: 'none', border: `1px solid var(--dark3)`, borderRadius: 6,
                    padding: '4px 10px', fontSize: 11, color: T.text2,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--dark3)'; e.currentTarget.style.color = T.text2 }}
                  >Mark read</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
