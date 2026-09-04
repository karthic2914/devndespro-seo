import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserPlus, faEnvelope, faTrash, faRotateRight, faCircleCheck, faClock,
  faUserGroup, faLock, faUnlock, faEllipsisVertical, faXmark, faFolder,
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, PageHeader, Badge, T } from '../components/UI'
import AppSidebar from '../components/AppSidebar'
import MobileSelect from '../components/MobileSelect'
import api from '../utils/api'
import toast from '../utils/toast'
import './Users.css'

const STATUS_VARIANT = { pending: 'warning', accepted: 'success', granted: 'success', revoked: 'default' }
const planOf = account => Number(account.id) === 1 ? 'agency' : (account.plan || (account.is_paid ? 'pro' : 'free'))
const initials = account => String(account.name || account.email || '?').split(/\s+|@/).slice(0,2).map(value => value[0]).join('').toUpperCase()

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
  const [inviteOpen, setInviteOpen] = useState(false)
  const [actionUser, setActionUser] = useState(null)

  useEffect(() => { if (authUser && authUser.id !== 1) navigate('/', { replace: true }) }, [authUser, navigate])

  const load = async () => {
    setLoading(true)
    try {
      const [ur,sr] = await Promise.all([api.get('/users'),api.get('/users/sites')])
      setUsers(Array.isArray(ur.data) ? ur.data : [])
      setSites(Array.isArray(sr.data) ? sr.data : [])
      if (sr.data?.length > 0 && !siteId) setSiteId(String(sr.data[0].id))
    } catch { setUsers([]) }
    setLoading(false)
  }

  const loadAccounts = async () => {
    setAccountsLoading(true)
    try { const { data } = await api.get('/users/accounts'); setAccounts(Array.isArray(data) ? data : []) }
    catch { setAccounts([]) }
    setAccountsLoading(false)
  }

  useEffect(() => { load(); loadAccounts() }, [])

  const setPlan = async (id,plan) => {
    setSavingId(id)
    try {
      const { data } = await api.post(`/users/${id}/set-plan`, { plan })
      setAccounts(previous => previous.map(account => account.id === id ? { ...account,...data } : account))
      toast.success(`Plan set to ${plan}`)
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to set plan') }
    setSavingId(null)
  }

  const invite = async () => {
    if (!email.trim() || !email.includes('@')) return toast.error('Enter a valid email address')
    if (!siteId) return toast.error('Select a project')
    setSending(true)
    try {
      const response = await api.post('/users/invite',{ email:email.trim(),siteId:Number(siteId) })
      toast.success(response.data.message || 'Invitation sent!')
      setEmail(''); setInviteOpen(false); await load()
    } catch (error) { toast.error(error.response?.data?.error || 'Failed to send invitation') }
    setSending(false)
  }

  const resend = async (id,userEmail) => {
    try { await api.post(`/users/resend/${id}`); toast.success(`Invitation resent to ${userEmail}`); setActionUser(null); await load() }
    catch { toast.error('Failed to resend') }
  }

  const revoke = async (id,userEmail) => {
    if (!confirm(`Remove ${userEmail}?`)) return
    try { await api.delete(`/users/${id}`); toast.success('User removed'); setActionUser(null); await load() }
    catch { toast.error('Failed to remove') }
  }

  const pending = users.filter(user => user.status === 'pending')
  const accepted = users.filter(user => user.status === 'accepted' || user.status === 'granted')
  const stats = [
    { label:'Total invited',value:users.filter(user => user.status !== 'revoked').length,icon:faUserGroup,tone:'blue' },
    { label:'Pending',value:pending.length,icon:faClock,tone:'amber' },
    { label:'Active',value:accepted.length,icon:faCircleCheck,tone:'green' },
  ]

  const planSelect = account => {
    const admin = Number(account.id) === 1
    const plan = planOf(account)
    if (admin) return <span className="users-plan-locked"><FontAwesomeIcon icon={faLock} /> Agency (full)</span>
    return <MobileSelect value={plan} disabled={savingId === account.id} label={`Plan for ${account.name || account.email}`} className="users-plan-select" onChange={event => setPlan(account.id,event.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="agency">Agency</option></MobileSelect>
  }

  return <div className="app-shell"><AppSidebar /><div className="app-main"><main className="page-content fade-in users-page">
    <PageHeader title="Team & Users" subtitle="Invite people to projects, and assign Free / Pro / Agency plans." />

    <section className="users-mobile-only users-mobile-summary">
      <div className="users-mobile-stats">{stats.map(stat => <article key={stat.label} className={`users-mobile-stat is-${stat.tone}`}><FontAwesomeIcon icon={stat.icon} /><strong>{stat.value}</strong><span>{stat.label}</span></article>)}</div>
      <button type="button" className="users-mobile-invite" onClick={() => setInviteOpen(true)}><FontAwesomeIcon icon={faUserPlus} /> Invite a user</button>
    </section>

    <Card className="users-access-card">
      <div className="users-section-heading"><FontAwesomeIcon icon={faUnlock} /><div><strong>Plans & feature access</strong><p>Admin has full access. Free includes core SEO; Pro unlocks KW Pro, Backlinks and AI; Agency adds Cold Email.</p></div></div>
      {accountsLoading ? <div className="users-empty">Loading accounts...</div> : accounts.length === 0 ? <div className="users-empty">No accounts yet.</div> : <>
        <div className="users-desktop-only users-account-table">
          <div className="users-account-head"><span>User</span><span>Plan</span><span>KW Pro</span><span>Backlinks</span><span>AI</span><span>Cold email</span></div>
          {accounts.map(account => { const admin=Number(account.id)===1; const plan=planOf(account); const pro=admin || plan==='pro' || plan==='agency'; const agency=admin || plan==='agency'; return <div className="users-account-row" key={account.id}><div><strong>{account.name || account.email}{admin && <Badge variant="success">Admin</Badge>}</strong><small>{account.email}</small></div><div>{planSelect(account)}</div><span className={pro?'is-on':''}>{pro?'On':'-'}</span><span className={pro?'is-on':''}>{pro?'On':'-'}</span><span className={pro?'is-on':''}>{pro?'On':'-'}</span><span className={agency?'is-on':''}>{agency?'On':'-'}</span></div> })}
        </div>
        <div className="users-mobile-only users-member-list">
          {accounts.map(account => { const admin=Number(account.id)===1; const plan=planOf(account); const pro=admin || plan==='pro' || plan==='agency'; const agency=admin || plan==='agency'; return <article className="users-member-card" key={account.id}><div className="users-member-top"><span className="users-avatar">{initials(account)}</span><div><strong>{account.name || account.email}</strong><small>{account.email}</small></div>{admin && <Badge variant="success">Admin</Badge>}</div><div className="users-member-plan"><span><FontAwesomeIcon icon={admin?faLock:faUnlock} /> Subscription</span>{planSelect(account)}</div><div className="users-feature-chips"><span className="is-on">Core SEO</span><span className={pro?'is-on':''}>KW Pro</span><span className={pro?'is-on':''}>Backlinks</span><span className={pro?'is-on':''}>AI</span><span className={agency?'is-on':''}>Cold email</span></div></article> })}
        </div>
      </>}
    </Card>

    <div className="users-desktop-only"><Card className="users-invite-card"><div className="users-card-title"><FontAwesomeIcon icon={faUserPlus} /><strong>Invite a new user</strong></div><div className="users-invite-grid"><input type="email" placeholder="email@example.com" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => event.key==='Enter' && invite()} /><select value={siteId} onChange={event => setSiteId(event.target.value)}>{sites.length===0 && <option value="">No projects</option>}{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select><Button variant="primary" size="sm" onClick={invite} loading={sending} disabled={sending}><FontAwesomeIcon icon={faEnvelope} /> Send invite</Button></div><p>The user will only see the selected project when they log in.</p></Card></div>

    <section className="users-desktop-only users-desktop-stats">{stats.map(stat => <Card key={stat.label}><FontAwesomeIcon icon={stat.icon} className={`is-${stat.tone}`} /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></Card>)}</section>

    <Card padding="0" className="users-invited-card"><div className="users-list-title"><strong>Invited users</strong><span>{users.filter(user => user.status!=='revoked').length}</span></div>{loading ? <div className="users-empty">Loading...</div> : users.length===0 ? <div className="users-empty">No users invited yet.</div> : <>
      <div className="users-desktop-only users-invited-table"><div className="users-invited-head"><span>Email</span><span>Project</span><span>Status</span><span>Invited</span><span>Actions</span></div>{users.map(user => <div className="users-invited-row" key={user.id}><strong>{user.email}</strong><span>{user.site_name || '-'}</span><Badge variant={STATUS_VARIANT[user.status] || 'default'}>{user.status==='granted'||user.status==='accepted'?'Active':user.status}</Badge><span>{user.invited_at ? new Date(user.invited_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '-'}</span><div>{(user.status==='pending'||user.status==='granted') && <button type="button" onClick={() => resend(user.id,user.email)} aria-label="Resend invitation"><FontAwesomeIcon icon={faRotateRight} /></button>}{user.status!=='revoked' && <button type="button" className="is-danger" onClick={() => revoke(user.id,user.email)} aria-label="Remove user"><FontAwesomeIcon icon={faTrash} /></button>}</div></div>)}</div>
      <div className="users-mobile-only users-invited-list">{users.filter(user => user.status!=='revoked').map(user => <article className="users-invited-user" key={user.id}><div><strong>{user.email}</strong><span><FontAwesomeIcon icon={faFolder} /> {user.site_name || 'No project'}</span></div><div className="users-invited-side"><Badge variant={STATUS_VARIANT[user.status] || 'default'}>{user.status==='granted'||user.status==='accepted'?'Active':user.status}</Badge><button type="button" onClick={() => setActionUser(user)} aria-label={`Actions for ${user.email}`}><FontAwesomeIcon icon={faEllipsisVertical} /></button></div></article>)}</div>
    </>}</Card>
  </main></div>

  {inviteOpen && <div className="users-sheet-overlay"><section className="users-sheet" role="dialog" aria-modal="true" aria-label="Invite a user"><div className="users-sheet-handle" /><header><div><h2>Invite a user</h2><p>Give access to one project.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header><label>Email address<input type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Project<MobileSelect value={siteId} onChange={event => setSiteId(event.target.value)} label="Choose project">{sites.length===0 && <option value="">No projects</option>}{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</MobileSelect></label><button type="button" className="users-sheet-primary" onClick={invite} disabled={sending}>{sending?'Sending...':<><FontAwesomeIcon icon={faEnvelope} /> Send invitation</>}</button></section></div>}

  {actionUser && <div className="users-sheet-overlay"><section className="users-sheet users-action-sheet" role="dialog" aria-modal="true" aria-label="User actions"><div className="users-sheet-handle" /><header><div><h2>User actions</h2><p>{actionUser.email}</p></div><button type="button" onClick={() => setActionUser(null)} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>{(actionUser.status==='pending'||actionUser.status==='granted') && <button type="button" onClick={() => resend(actionUser.id,actionUser.email)}><FontAwesomeIcon icon={faRotateRight} /> Resend invitation</button>}<button type="button" className="is-danger" onClick={() => revoke(actionUser.id,actionUser.email)}><FontAwesomeIcon icon={faTrash} /> Remove access</button></section></div>}
  </div>
}


