import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus, faEnvelope, faTrash, faRotateRight,
  faCircleCheck, faClock, faUserGroup, faLock, faUnlock,
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, PageHeader, Badge, T } from '../components/UI'
import AppSidebar from '../components/AppSidebar'
import api from '../utils/api'
import toast from '../utils/toast'

const STATUS_VARIANT = { pending: 'warning', accepted: 'success', granted: 'success', revoked: 'default' }

export default function Users() {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [siteId, setSiteId] = useState('')
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    if (authUser && authUser.id !== 1) navigate('/', { replace: true })
  }, [authUser])

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

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try {
      const { data } = await api.get('/users/accounts')
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      setAccounts([])
    }
    setAccountsLoading(false)
  }

  useEffect(() => { load(); loadAccounts() }, [])

  const patchFeatures = async (id, patch) => {
    setSavingId(id)
    try {
      const { data } = await api.patch(`/users/${id}/features`, patch)
      setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...data } : a)))
      toast.success('Access updated')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update access')
    }
    setSavingId(null)
  }

  const markPaid = async (id, paid) => {
    setSavingId(id)
    try {
      const { data } = await api.post(`/users/${id}/mark-paid`, { paid })
      setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...data } : a)))
      toast.success(paid ? 'Marked paid — Backlinks & Keywords unlocked' : 'Marked unpaid')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to update payment')
    }
    setSavingId(null)
  }

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
  const accepted = users.filter(u => u.status === 'accepted' || u.status === 'granted')

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
      <div className="page-content fade-in">
      <PageHeader
        title="Team & Users"
        subtitle="Invite people to projects, and unlock Keywords / Backlinks when they pay — or grant access manually."
      />

      {/* Feature access */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FontAwesomeIcon icon={faUnlock} style={{ color: T.orange }} />
          <strong style={{ fontSize: 14 }}>Feature access</strong>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
          Admin always has full access. For other users: mark <strong>Paid</strong> (auto-unlocks Keywords + Backlinks),
          or toggle each feature manually. Payment webhooks can call the same unlock automatically.
        </div>

        {accountsLoading ? (
          <div style={{ color: T.muted, fontSize: 13 }}>Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: T.muted, fontSize: 13 }}>No accounts yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px,1.4fr) 70px 90px 90px 110px',
              gap: 8,
              padding: '8px 4px',
              borderBottom: `1px solid ${T.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: T.muted,
              textTransform: 'uppercase',
            }}>
              <div>User</div>
              <div>Paid</div>
              <div>Keywords</div>
              <div>Backlinks</div>
              <div>Quick</div>
            </div>
            {accounts.map(a => {
              const isAdmin = Number(a.id) === 1
              const busy = savingId === a.id
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(180px,1.4fr) 70px 90px 90px 110px',
                    gap: 8,
                    padding: '10px 4px',
                    borderBottom: '1px solid #F3F4F6',
                    alignItems: 'center',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: T.text }}>
                      {a.name || a.email}
                      {isAdmin && <Badge variant="success" style={{ marginLeft: 8 }}>Admin</Badge>}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{a.email}</div>
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={isAdmin || !!a.is_paid}
                      disabled={isAdmin || busy}
                      onChange={e => patchFeatures(a.id, { is_paid: e.target.checked })}
                      title="Paid unlocks Keywords + Backlinks"
                    />
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={isAdmin || !!a.keywords_enabled || !!a.is_paid}
                      disabled={isAdmin || busy || !!a.is_paid}
                      onChange={e => patchFeatures(a.id, { keywords_enabled: e.target.checked })}
                      title={a.is_paid ? 'Included with Paid' : 'Enable Keywords'}
                    />
                  </div>
                  <div>
                    <input
                      type="checkbox"
                      checked={isAdmin || !!a.backlinks_enabled || !!a.is_paid}
                      disabled={isAdmin || busy || !!a.is_paid}
                      onChange={e => patchFeatures(a.id, { backlinks_enabled: e.target.checked })}
                      title={a.is_paid ? 'Included with Paid' : 'Enable Backlinks'}
                    />
                  </div>
                  <div>
                    {!isAdmin && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => markPaid(a.id, !a.is_paid)}
                        style={{
                          border: `1px solid ${T.border}`,
                          background: a.is_paid ? '#FEF2F2' : '#ECFDF5',
                          color: a.is_paid ? '#B91C1C' : '#047857',
                          borderRadius: 7,
                          padding: '5px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {a.is_paid ? 'Unpay' : 'Mark paid'}
                      </button>
                    )}
                    {isAdmin && (
                      <span style={{ fontSize: 11, color: T.muted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <FontAwesomeIcon icon={faLock} /> Full access
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

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
          { label: 'Total Invited', value: users.filter(u => u.status !== 'revoked').length, icon: faUserGroup, color: T.blue },
          { label: 'Pending', value: pending.length, icon: faClock, color: T.amber },
          { label: 'Active', value: accepted.length, icon: faCircleCheck, color: T.green },
        ].map(s => (
          <Card key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 60, borderRadius: 8, background: s.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div style={{ fontSize: 12, color: T.text2 }}>{u.site_name || '-'}</div>
                <div>
                  <Badge variant={STATUS_VARIANT[u.status] || 'default'}>
                    {u.status === 'granted' || u.status === 'accepted' ? 'Active' : u.status}
                  </Badge>
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {u.invited_at ? new Date(u.invited_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(u.status === 'pending' || u.status === 'granted') && (
                    <button onClick={() => resend(u.id, u.email)} title={u.status === 'granted' ? 'Resend access reminder' : 'Resend invite'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.blue, padding: '4px 6px', borderRadius: 4 }}>
                      <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                  )}
                  {u.status !== 'revoked' && (
                    <button onClick={() => revoke(u.id, u.email)} title="Remove user"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.red, padding: '4px 6px', borderRadius: 4 }}>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </Card>
      </div>
      </div>
    </div>
  )
}
