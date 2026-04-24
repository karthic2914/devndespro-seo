import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock,
  faBullseye,
  faPenToSquare,
  faLink,
  faBolt,
  faSitemap,
  faPlus,
  faTag,
  faGlobe,
  faHourglassHalf,
  faXmark,
  faLightbulb,
  faCheck,
  faArrowRight,
  faEnvelope,
  faMagnifyingGlass,
  faArrowUpWideShort,
  faArrowDownWideShort,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Button, Badge, Modal, Input, EmptyState, T } from '../components/UI'
  const [confirmDelete, setConfirmDelete] = useState({ open: false, site: null })
import AppSidebar from '../components/AppSidebar'

const BENCHMARKS = [
  { label: 'Avg. Time to Rank',    value: '3-6 mo', sub: 'new domain',       color: T.orange, icon: faClock },
  { label: 'Target Domain Rating', value: '20+',    sub: 'to compete',        color: T.blue,   icon: faBullseye },
  { label: 'Min. Blog Length',     value: '1,500+', sub: 'words per post',    color: T.green,  icon: faPenToSquare },
  { label: 'Dofollow Backlinks',   value: '10-30',  sub: 'to start ranking',  color: T.purple, icon: faLink },
]

const CHECKLIST = [
  { done: true,  label: 'Sitemap submitted to Google Search Console' },
  { done: true,  label: 'DMARC DNS record configured' },
  { done: true,  label: 'Top citation profiles completed' },
  { done: true,  label: 'Business directory submissions completed' },
  { done: false, label: 'Prospected 30 niche-relevant backlink targets' },
  { done: false, label: 'First SEO blog post published' },
  { done: false, label: 'Domain Authority reaches 10+' },
]

const QUICK_WINS = [
  {
    icon: faLink,
    title: 'Build Backlinks',
    desc: 'Run outreach to niche-relevant domains with contextual dofollow opportunities.',
    impact: 'High',
    eta: '2 days',
  },
  {
    icon: faPenToSquare,
    title: 'Publish Content',
    desc: 'Publish one linkable asset targeting a low-difficulty topic cluster.',
    impact: 'High',
    eta: '3 days',
  },
  {
    icon: faBolt,
    title: 'Fix Core Web Vitals',
    desc: 'Push LCP under 2.5s and CLS under 0.1 on top traffic pages.',
    impact: 'Medium',
    eta: '1 day',
  },
  {
    icon: faSitemap,
    title: 'Reclaim Link Equity',
    desc: 'Fix broken pages, add redirects, and recover backlinks pointing to dead URLs.',
    impact: 'Medium',
    eta: '45 min',
  },
]

const completedCount = CHECKLIST.filter(c => c.done).length

import api from '../utils/api'

export default function Sites() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', contactEmail: '', notifyAdmin: true })
  const [findingEmail, setFindingEmail] = useState(false)
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [errors, setErrors] = useState({})
  const { logout } = useAuth()
  const navigate = useNavigate()
  const didLoadRef = useRef(false)

  // ── Filter & sort state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  const safeSites = Array.isArray(sites) ? sites : []
  const token = localStorage.getItem('seo_token')
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    try {
      const res = await fetch('/api/sites', { headers: authHeaders })
      if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
      const data = await res.json()
      setSites(Array.isArray(data) ? data : [])
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (didLoadRef.current) return
    didLoadRef.current = true
    load()
  }, [])

  // ── Filtered + sorted sites ──────────────────────────────────────────────────
  const filteredSites = safeSites
    .filter(s => {
      const q = search.toLowerCase()
      return (
        s.name?.toLowerCase().includes(q) ||
        s.url?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'created_at') { av = new Date(av); bv = new Date(bv) }
      else { av = Number(av ?? 0); bv = Number(bv ?? 0) }
      return sortDir === 'asc' ? av - bv : bv - av
    })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return null
    return (
      <FontAwesomeIcon
        icon={sortDir === 'asc' ? faArrowUpWideShort : faArrowDownWideShort}
        style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}
      />
    )
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Project name is required'
    if (!form.url.trim()) e.url = 'Website URL is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const add = async () => {
    if (!validate()) return
    setAdding(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form),
      })
      if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to add site. Try again.')
      }
      setForm({ name: '', url: '', contactEmail: '', notifyAdmin: true })
      setShowAdd(false)
      toast.success('Project added successfully')
      load()
    } catch (e) {
      const msg = e?.message || 'Failed to add site. Try again.'
      setErrors({ url: msg })
      toast.error(msg)
    }
    setAdding(false)
  }

  const remove = async (id, e) => {
    if (e) e.stopPropagation()
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE', headers: authHeaders })
    if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
    toast.success('Project deleted')
    load()
  }

  const getDomain = (url) => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname }
    catch { return url }
  }

  const enter = (site) => {
    localStorage.setItem('activeSite', JSON.stringify(site))
    navigate(`/site/${site.id}`)
  }

  const SORT_COLS = [
    { key: 'health',        label: 'Health' },
    { key: 'keyword_count', label: 'Keywords' },
    { key: 'backlink_count',label: 'Backlinks' },
    { key: 'created_at',    label: 'Added' },
  ]

  return (
    <div className="app-shell">
      <AppSidebar />

      <div className="app-main">
        <div className="topbar">
          <span className="topbar__title">Projects</span>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />New Project
          </Button>
        </div>

        {/* Add Site Modal */}
        <Modal
          open={showAdd}
          onClose={() => { setShowAdd(false); setErrors({}) }}
          title="Add new project"
          subtitle="Start tracking SEO metrics for any website"
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button variant="primary" loading={adding} onClick={add}>
                Add Project <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="Project name" placeholder="e.g. devndespro" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} error={errors.name} icon={<FontAwesomeIcon icon={faTag} />} />
            <Input label="Website URL" placeholder="e.g. devndespro.com" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} error={errors.url} icon={<FontAwesomeIcon icon={faGlobe} />} hint="Only domains verified in your connected GSC account are allowed." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input label="Client contact email" placeholder="e.g. client@example.com" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} icon={<FontAwesomeIcon icon={faEnvelope} />} hint="Saved to Cold Email tracker automatically." style={{ flex: 1 }} />
              {user?.id === 1 && (
                <Button variant="secondary" size="sm" loading={findingEmail} style={{ minWidth: 120 }}
                  onClick={async () => {
                    if (!form.url) return toast.error('Enter a website URL first')
                    setFindingEmail(true)
                    try {
                      const r = await api.post('/extract/extract-email', { url: form.url.startsWith('http') ? form.url : `https://${form.url}` })
                      if (Array.isArray(r.data?.emails) && r.data.emails.length > 0) {
                        setForm(p => ({ ...p, contactEmail: r.data.emails[0] }))
                        toast.success('Email found and filled!')
                      } else {
                        toast.error('No email found on homepage')
                      }
                    } catch (e) {
                      toast.error('Failed to extract email')
                    }
                    setFindingEmail(false)
                  }}>
                  Find email from site
                </Button>
              )}
            </div>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="checkbox" checked={form.notifyAdmin} onChange={e => setForm(p => ({ ...p, notifyAdmin: e.target.checked }))} style={{ marginRight: 6 }} />
              Notify admin by email when this project is added
            </label>
          </div>
        </Modal>

        <div className="page-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>Projects</h1>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 8px 0' }}>
                {loading ? '' : `Total projects: ${safeSites.length}`}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {loading ? 'Loading...' : `${filteredSites.length} of ${safeSites.length} site${safeSites.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {/* Benchmarks */}
          <div className="grid-4col mb-24">
            {BENCHMARKS.map(b => (
              <div key={b.label} className="bench-card" style={{ borderTop: `3px solid ${b.color}` }}>
                <div className="bench-card__header">
                  <span className="bench-card__icon" style={{ color: b.color }}><FontAwesomeIcon icon={b.icon} /></span>
                  <span className="bench-card__title">{b.label}</span>
                </div>
                <div className="bench-card__value" style={{ color: b.color }}>{b.value}</div>
                <div className="bench-card__sub">{b.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid-sidebar-layout">

            {/* Left - projects table */}
            <div className="projects-table">

              {/* ── Search + Sort toolbar ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                background: 'var(--surface)', flexWrap: 'wrap',
              }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--muted)', fontSize: 12, pointerEvents: 'none',
                  }} />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', paddingLeft: 30, paddingRight: 10,
                      height: 32, border: '1px solid var(--border)', borderRadius: 6,
                      fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)',
                      color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Sort buttons */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {SORT_COLS.map(col => (
                    <button
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      style={{
                        height: 32, padding: '0 10px', borderRadius: 6, fontSize: 12,
                        fontFamily: 'inherit', cursor: 'pointer', border: '1px solid var(--border)',
                        background: sortCol === col.key ? 'var(--accent)' : 'var(--bg)',
                        color: sortCol === col.key ? '#fff' : 'var(--muted)',
                        fontWeight: sortCol === col.key ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {col.label}<SortIcon col={col.key} />
                    </button>
                  ))}
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{
                        height: 32, padding: '0 10px', borderRadius: 6, fontSize: 12,
                        fontFamily: 'inherit', cursor: 'pointer',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                        color: 'var(--muted)',
                      }}
                    >
                      <FontAwesomeIcon icon={faXmark} style={{ marginRight: 4 }} />Clear
                    </button>
                  )}
                </div>
              </div>

              {/* ── Scrollable table body ── */}
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <div className="projects-table__head">
                  {['Project', 'Health', 'Keywords', 'Backlinks', 'Added', ''].map(h => (
                    <div key={h} className="projects-table__head-cell">{h}</div>
                  ))}
                </div>

                {loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}><FontAwesomeIcon icon={faHourglassHalf} /></div>
                    Loading projects...
                  </div>
                ) : filteredSites.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
                    <div style={{ marginBottom: 16 }}>
                      {search ? `No projects matching "${search}"` : 'No projects yet'}
                    </div>
                    <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: 8 }} />Add Your First Project
                    </Button>
                  </div>
                ) : (
                  filteredSites.map((site, idx) => (
                    <div
                      key={site.id}
                      className="project-row"
                      onClick={() => enter(site)}
                      style={{
                        background: idx % 2 === 0 ? 'rgba(244,246,249,0.7)' : '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        position: 'relative',
                        borderRadius: 8,
                        marginBottom: 4,
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = '#f3f4f6')}
                      onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(244,246,249,0.7)' : '#fff')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="project-row__avatar" style={{ width: 36, height: 36, padding: 0, overflow: 'hidden', background: 'transparent', border: 'none' }}>
                          <img
                            src={`https://${getDomain(site.url)}/favicon.ico`}
                            alt={site.name}
                            width={36} height={36}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'transparent', display: 'block' }}
                            onError={(e) => {
                              if (!e.currentTarget.dataset.fallback) {
                                e.currentTarget.dataset.fallback = 'true'
                                e.currentTarget.src = `https://www.google.com/s2/favicons?sz=64&domain=${getDomain(site.url)}`
                              }
                            }}
                          />
                        </div>
                        <div>
                          <div className="project-row__name">{site.name}</div>
                          <div className="project-row__url">{site.url}</div>
                        </div>
                      </div>
                      <div className="project-row__dash">{site.health ?? '-'}</div>
                      <div className="project-row__dash">{site.keyword_count ?? 0}</div>
                      <div className="project-row__dash">{site.backlink_count ?? 0}</div>
                      <div className="project-row__date">
                        {new Date(site.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                      {/* Quick Actions Menu */}
                      <div
                        style={{ position: 'absolute', right: 10, top: 10, zIndex: 2 }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            borderRadius: 4, fontSize: 18, color: '#9CA3AF',
                            transition: 'background 0.15s',
                          }}
                          title="Quick actions"
                          onClick={e => {
                            e.stopPropagation();
                            setConfirmDelete({ open: true, site })
                          }}
                        >
                          ⋮
                        </button>
                      </div>
                          {/* Delete confirmation modal */}
                          <Modal
                            open={confirmDelete.open}
                            onClose={() => setConfirmDelete({ open: false, site: null })}
                            title="Delete Project?"
                            width={380}
                            footer={
                              <>
                                <Button variant="secondary" onClick={() => setConfirmDelete({ open: false, site: null })}>Cancel</Button>
                                <Button
                                  variant="danger"
                                  onClick={async () => {
                                    if (confirmDelete.site) await remove(confirmDelete.site.id)
                                    setConfirmDelete({ open: false, site: null })
                                  }}
                                >
                                  Delete
                                </Button>
                              </>
                            }
                          >
                            <div style={{ fontSize: 15, color: '#b91c1c', marginBottom: 8, fontWeight: 600 }}>
                              Are you sure you want to delete <span style={{ color: '#111' }}>{confirmDelete.site?.name}</span>?
                            </div>
                            <div style={{ fontSize: 13, color: '#6B7280' }}>
                              This will permanently remove the project and all its data. This action cannot be undone.
                            </div>
                          </Modal>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="right-rail">
              <div className="da-goal-card">
                <div className="da-goal-card__label">
                  <FontAwesomeIcon icon={faBullseye} />Domain Authority Goal
                </div>
                <div className="da-goal-card__nums">
                  <span className="da-goal-card__num">0</span>
                  <span className="da-goal-card__arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                  <span className="da-goal-card__num">20</span>
                </div>
                <div className="da-goal-card__bar"><div className="da-goal-card__fill" /></div>
                <p className="da-goal-card__tip">Focus this week on niche-relevant outreach, unlinked mention reclamation, and contextual backlinks.</p>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Setup Checklist</div>
                  <Badge variant="orange">{completedCount}/{CHECKLIST.length}</Badge>
                </div>
                <div className="checklist-progress">
                  <div className="checklist-progress__fill" style={{ width: `${(completedCount / CHECKLIST.length) * 100}%` }} />
                </div>
                {CHECKLIST.map((item, i) => (
                  <div key={i} className={`checklist-item checklist-item--${item.done ? 'done' : 'todo'}`}>
                    <div className={`checklist-check checklist-check--${item.done ? 'done' : 'todo'}`}>
                      {item.done && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="quick-wins-title">
                  <FontAwesomeIcon icon={faLightbulb} />SEO Action Queue
                </div>
                {QUICK_WINS.map((tip, idx) => (
                  <div key={tip.title} className="quick-win-row">
                    <div className="quick-win-row__rank">{idx + 1}</div>
                    <span className="quick-win-row__icon"><FontAwesomeIcon icon={tip.icon} /></span>
                    <div className="quick-win-row__content">
                      <div className="quick-win-row__top">
                        <div className="quick-win-row__title">{tip.title}</div>
                        <span className={`quick-win-row__impact quick-win-row__impact--${tip.impact.toLowerCase()}`}>{tip.impact}</span>
                      </div>
                      <div className="quick-win-row__desc">{tip.desc}</div>
                      <div className="quick-win-row__meta">ETA: {tip.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}