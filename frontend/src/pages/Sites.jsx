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
  faChevronUp,
  faChevronDown,
  faEllipsisV,
  faTrash,
  faSliders,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Button, Badge, Modal, Input, EmptyState, T } from '../components/UI'
import AppSidebar from '../components/AppSidebar'

const BENCHMARKS = [
  { label: 'Avg. Time to Rank',    value: '3-6 mo', sub: 'new domain',       color: T.orange, icon: faClock },
  { label: 'Target Domain Rating', value: '20+',    sub: 'to compete',        color: T.blue,   icon: faBullseye },
  { label: 'Min. Blog Length',     value: '1,500+', sub: 'words per post',    color: T.green,  icon: faPenToSquare },
  { label: 'Dofollow Backlinks',   value: '10-30',  sub: 'to start ranking',  color: T.purple, icon: faLink },
]



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
  const [confirmDelete, setConfirmDelete] = useState({ open: false, site: null })
  const [showAeoBanner, setShowAeoBanner] = useState(() => localStorage.getItem('aeo_banner_dismissed') !== '1')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [summary, setSummary] = useState(null)

  // -- Filter & sort state ------------------------------------------------------
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
      const sumRes = await fetch('/api/sites/summary', { headers: authHeaders })
      if (sumRes.ok) {
        const sumData = await sumRes.json()
        setSummary(sumData)
      }
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

  // -- Filtered + sorted sites --------------------------------------------------
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
        icon={sortDir === 'asc' ? faChevronUp : faChevronDown}
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

  const remove = async (id) => {
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
    { key: 'aeo_score',     label: 'AEO Score' },
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
          {user?.id === 1 && (
            <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
              <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />New Project
            </Button>
          )}
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

        {/* Delete Confirmation Modal - outside the map loop */}
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

          {/* AEO Announcement Banner */}
          {showAeoBanner && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b2e 0%, #2d1f4e 100%)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              boxShadow: '0 2px 12px rgba(99,60,180,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                    New: AEO Audits are now live!
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    See how AI-ready your content is for ChatGPT, Perplexity & Google AI Overviews — re-run any site audit to get your AEO score.
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowAeoBanner(false); localStorage.setItem('aeo_banner_dismissed', '1') }}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                Dismiss
              </button>
            </div>
          )}

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

              {/* Search + Filter toolbar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
              }}>
                <div style={{ position: 'relative', flex: 1 }}>
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
                      width: '100%', paddingLeft: 30, paddingRight: 40,
                      height: 34, border: '1px solid var(--border)', borderRadius: 6,
                      fontSize: 13, fontFamily: 'inherit', background: 'var(--bg)',
                      color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{
                      position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 2,
                    }}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                  {/* Filter icon */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      onClick={() => setShowSortDropdown(v => !v)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: showSortDropdown ? 'var(--accent)' : 'none',
                        border: '1px solid var(--border)', borderRadius: 5,
                        cursor: 'pointer', color: showSortDropdown ? '#fff' : 'var(--muted)',
                        fontSize: 12, padding: '3px 7px', lineHeight: 1,
                      }}
                      title="Sort by"
                    >
                      <FontAwesomeIcon icon={faSliders} />
                    </button>
                    {showSortDropdown && (
                      <div style={{
                        position: 'absolute', right: 0, top: 36, zIndex: 100,
                        background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 180, padding: 6,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort by</div>
                        {SORT_COLS.map(col => (
                          <button key={col.key} onClick={() => { toggleSort(col.key); setShowSortDropdown(false) }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none',
                            background: sortCol === col.key ? '#FFF4EE' : 'none',
                            color: sortCol === col.key ? 'var(--accent)' : 'var(--text)',
                            fontWeight: sortCol === col.key ? 700 : 400,
                            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}>
                            {col.label}
                            {sortCol === col.key && <FontAwesomeIcon icon={sortDir === 'asc' ? faChevronUp : faChevronDown} style={{ fontSize: 10 }} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable table body */}
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                <div className="projects-table__head">
                  {['Project', 'Health', 'AEO', 'Keywords', 'Backlinks', 'Added', ''].map(h => (
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
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: `hsl(${(site.name.charCodeAt(0) * 37) % 360}, 60%, 55%)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                          textTransform: 'uppercase', letterSpacing: 0,
                        }}>
                          {site.name.charAt(0)}
                        </div>
                        <div>
                          <div className="project-row__name">{site.name}</div>
                          <div className="project-row__url">{site.url}</div>
                        </div>
                      </div>
                      <div className="project-row__dash">{site.health ?? '-'}</div>
                      <div className="project-row__dash" style={{ color: site.aeo_score >= 80 ? '#16A34A' : site.aeo_score >= 55 ? '#D97706' : site.aeo_score ? '#DC2626' : 'var(--muted)', fontWeight: site.aeo_score ? 700 : 400 }}>{site.aeo_score ?? '—'}</div>
                      <div className="project-row__dash">{site.keyword_count ?? 0}</div>
                      <div className="project-row__dash">{site.backlink_count ?? 0}</div>
                      <div className="project-row__date">
                        {new Date(site.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </div>
                      {/* Quick Actions Menu */}
                      <div
                        style={{ position: 'absolute', right: 10, top: 10, zIndex: 2, display: user?.id === 1 ? 'block' : 'none' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                            borderRadius: 4, fontSize: 18, color: '#9CA3AF',
                            transition: 'background 0.15s',
                          }}
                          title="Delete project"
                          onClick={e => {
                            e.stopPropagation()
                            setConfirmDelete({ open: true, site })
                          }}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
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
                  <span className="da-goal-card__num">{summary?.max_dr ?? 0}</span>
                  <span className="da-goal-card__arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                  <span className="da-goal-card__num">20</span>
                </div>
                <div className="da-goal-card__bar"><div className="da-goal-card__fill" style={{ width: `${Math.min(((summary?.max_dr ?? 0) / 20) * 100, 100)}%` }} /></div>
                <p className="da-goal-card__tip">{summary?.max_dr >= 20 ? 'Goal reached! Target DR 40+ next.' : summary?.max_dr >= 10 ? 'Good progress � keep building backlinks to hit DR 20.' : 'Focus this week on niche-relevant outreach, unlinked mention reclamation, and contextual backlinks.'}</p>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Setup Checklist</div>
                  {summary && <Badge variant="orange">{summary.checklist.filter(c => c.done).length}/{summary.checklist.length}</Badge>}
                </div>
                <div className="checklist-progress">
                  <div className="checklist-progress__fill" style={{ width: summary ? `${(summary.checklist.filter(c => c.done).length / summary.checklist.length) * 100}%` : `0%` }} />
                </div>
                {(summary?.checklist ?? []).map((item, i) => (
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
                {(summary?.actions ?? []).map((tip, idx) => (
                  <div key={tip.title} className="quick-win-row">
                    <div className="quick-win-row__rank">{idx + 1}</div>

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