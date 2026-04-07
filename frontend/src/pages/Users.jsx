import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus, faEnvelope, faTrash, faRotateRight,
  faCircleCheck, faClock, faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Card, Button, PageHeader, Badge, T } from '../components/UI'
import api from '../utils/api'
import toast from 'react-hot-toast'

const STATUS_VARIANT = { pending: 'warning', accepted: 'success', revoked: 'default' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [siteId, setSiteId] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [ur, sr] = await Promise.all([
        api.get('/users'),
        api.get('/users/sites'),
      ])
      setUsers(Array.isArray(ur.data) ? ur.data : [])
      setSites(Array.isArray(sr.data) ? sr.data : [])
      if (sr.data?.length > 0 && !siteId) setSiteId(String(sr.data[0].id))
    } catch {
      setUsers([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const invite = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    if (!siteId) {
      toast.error('Select a project')
      return
    }
    setSending(true)
    try {
      const r = await api.post('/users/invite', { email: email.trim(), siteId: Number(siteId) })
      toast.success(r.data.message || 'Invitation sent!')
      setEmail('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send invitation')
    }
    setSending(false)
  }

  const resend = async (id, userEmail) => {
    try {
      await api.post(`/users/resend/${id}`)
      toast.success(`Invitation resent to ${userEmail}`)
      await load()
    } catch {
      toast.error('Failed to resend')
    }
  }

  const revoke = async (id, userEmail) => {
    if (!confirm(`Remove ${userEmail}?`)) return
    try {
      await api.delete(`/users/${id}`)
      toast.success('User removed')
      await load()
    } catch {
      toast.error('Failed to remove')
    }
  }

  const pending = users.filter(u => u.status === 'pending')
  const accepted = users.filter(u => u.status === 'accepted')

  return (
    <div className="fade-in" style={{ padding: '1.25rem 1.5rem' }}>
      <PageHeader
        title="Team & Users"
        subtitle="Invite people to access a specific project. They'll receive an email with a login link."
      />

      {/* Invite form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <FontAwesomeIcon icon={faUserPlus} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Invite a new user</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 8 }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && invite()}
          />
          <select
            value={siteId}
            onChange={e => setSiteId(e.target.value)}
            style={{
              border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: T.text,
              background: '#fff', cursor: 'pointer',
            }}
          >
            {sites.length === 0 && <option value="">No projects</option>}
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={invite} loading={sending} disabled={sending}>
            <FontAwesomeIcon icon={faEnvelope} style={{ marginRight: 6 }} />
            Send Invite
          </Button>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>
          The user will only see the selected project when they log in.
        </div>
      </Card>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Invited', value: users.length, icon: faUserGroup, color: T.blue },
          { label: 'Pending', value: pending.length, icon: faClock, color: T.amber },
          { label: 'Active', value: accepted.length, icon: faCircleCheck, color: T.green },
        ].map(s => (
          <Card key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={s.icon} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>{s.value}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* User list */}
      <Card padding="0">
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}` }}>
          <strong style={{ fontSize: 13 }}>Invited Users</strong>
        </div>

        {loading ? (
          <div style={{ padding: '1.5rem', color: T.muted, fontSize: 13 }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: T.muted, fontSize: 13 }}>
            No users invited yet. Use the form above to invite someone.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 140px 100px', padding: '8px 20px', background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
              {['Email', 'Project', 'Status', 'Invited', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>

            {users.map((u, i) => (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 100px 140px 100px',
                padding: '12px 20px', alignItems: 'center',
                borderBottom: i < users.length - 1 ? `1px solid #F3F4F6` : 'none',
              }}>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{u.email}</div>
                <div style={{ fontSize: 12, color: T.text2 }}>{u.site_name || '—'}</div>
                <div>
                  <Badge variant={STATUS_VARIANT[u.status] || 'default'}>{u.status}</Badge>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {u.invited_at ? new Date(u.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {u.status === 'pending' && (
                    <button onClick={() => resend(u.id, u.email)} title="Resend invite"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue, padding: '4px 6px', borderRadius: 4 }}>
                      <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                  )}
                  <button onClick={() => revoke(u.id, u.email)} title="Remove user"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: '4px 6px', borderRadius: 4 }}>
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  )
}