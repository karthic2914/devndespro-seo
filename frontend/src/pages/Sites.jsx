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

export default function Sites() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '' })
  const [adding, setAdding] = useState(false)
  const [errors, setErrors] = useState({})
  const { logout } = useAuth()
  const navigate = useNavigate()
  const didLoadRef = useRef(false)
  const safeSites = Array.isArray(sites) ? sites : []
  const token = localStorage.getItem('seo_token')
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    try {
      const res = await fetch('/api/sites', { headers: authHeaders })

      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      const data = await res.json()
      setSites(Array.isArray(data) ? data : [])
    } catch {
      setSites([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    // React StrictMode runs effects twice in dev; guard to avoid duplicate API calls.
    if (didLoadRef.current) return
    didLoadRef.current = true
    load()
  }, [])

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
      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to add site. Try again.')
      }
      setForm({ name: '', url: '' })
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
    e.stopPropagation()
    if (!confirm('Delete this project and all its data?')) return
    const res = await fetch(`/api/sites/${id}`, { method: 'DELETE', headers: authHeaders })
    if (res.status === 401) {
      logout()
      navigate('/login', { replace: true })
      return
    }
    toast.success('Project deleted')
    load()
  }
const getDomain = (url) => {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return url
  }
}
  const enter = (site) => {
    localStorage.setItem('activeSite', JSON.stringify(site))
    navigate(`/site/${site.id}`)
  }

  return (
    <div className="app-shell">

      {/* â”€â”€ Sidebar â”€â”€ */}
      <AppSidebar />

      {/* â”€â”€ Main â”€â”€ */}
      <div className="app-main">
        <div className="topbar">
          <span className="topbar__title">Projects</span>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />New Project
          </Button>
        </div>

        {/* â”€â”€ Add Site Modal â”€â”€ */}
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
          </div>
        </Modal>

        {/* â”€â”€ Main Content â”€â”€ */}
        <div className="page-content">

          {/* Page heading */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>Projects</h1>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {loading ? 'Loading...' : `${safeSites.length} site${safeSites.length !== 1 ? 's' : ''} tracked`}
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

          {/* Two-column layout */}
          <div className="grid-sidebar-layout">

            {/* Left - projects table */}
            <div className="projects-table">
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
              ) : safeSites.length === 0 ? (
                <EmptyState
                  icon={<FontAwesomeIcon icon={faGlobe} />}
                  title="No projects yet"
                  desc="Add your first website to start tracking keyword rankings, backlinks and domain authority."
                  action={<Button variant="primary" onClick={() => setShowAdd(true)}><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add your first project</Button>}
                />
              ) : (
                safeSites.map(site => (
                  <div key={site.id} className="project-row" onClick={() => enter(site)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                          className="project-row__avatar"
                          style={{
                            width: 36,
                            height: 36,
                            padding: 0,
                            overflow: 'hidden',
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          <img
                            src={`https://${getDomain(site.url)}/favicon.ico`}
                            alt={site.name}
                            width={36}
                            height={36}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              background: 'transparent',
                              display: 'block',
                            }}
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
                    <button className="project-row__del" onClick={e => remove(site.id, e)}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Right sidebar */}
            <div className="right-rail">

              {/* DA Goal */}
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

              {/* Setup checklist */}
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

              {/* Quick wins */}
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
