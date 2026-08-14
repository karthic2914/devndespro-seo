import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from '../utils/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, MetricCard, Badge, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import PageProcessGuide from '../components/PageProcessGuide'
import { ACTIONS_PAGE_FLOW } from '../constants/pageFlows'
import api from '../utils/api'

export default function Actions() {
  const { siteId } = useParams()
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [form, setForm] = useState({ text: '', impact: 'Medium' })
  const [adding, setAdding] = useState(false)

  const load = () =>
    api.get(`/sites/${siteId}/actions`)
      .then(async () => {
        try {
          const synced = await api.post(`/sites/${siteId}/actions/sync-from-audit`)
          if (Array.isArray(synced.data?.actions)) {
            setActions(synced.data.actions)
            if (synced.data.completed > 0) {
              toast.success(`${synced.data.completed} issue(s) marked fixed from latest audit`)
            }
            return
          }
        } catch { /* fall through */ }
        const r = await api.get(`/sites/${siteId}/actions`)
        setActions(Array.isArray(r.data) ? r.data : [])
      })
      .finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

  const refreshFromAudit = async () => {
    setSyncing(true)
    try {
      const synced = await api.post(`/sites/${siteId}/actions/sync-from-audit`)
      if (Array.isArray(synced.data?.actions)) setActions(synced.data.actions)
      const seeded = Number(synced.data?.seeded) || 0
      const completed = Number(synced.data?.completed) || 0
      if (seeded || completed) {
        toast.success(`Synced: ${seeded} new, ${completed} fixed`)
      } else {
        toast.success('Action Plan already matches latest audit')
      }
    } catch {
      toast.error('Could not refresh from audit')
    }
    setSyncing(false)
  }

  const add = async () => {
    if (!form.text.trim()) {
      toast.error('Action text is required')
      return
    }
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/actions`, { text: form.text.trim(), impact: form.impact })
      setForm({ text: '', impact: 'Medium' })
      toast.success('Action added')
      load()
    } catch {
      toast.error('Failed to add action')
    }
    setAdding(false)
  }

  const toggle = async (id, done) => {
    try {
      const { data } = await api.put(`/sites/${siteId}/actions/${id}`, { done: !done })
      if (!done && data?.healthDelta) {
        toast.success(`Completed. Site Health +${data.healthDelta}`)
      } else {
        toast.success(done ? 'Action moved to pending' : 'Action marked complete')
      }
      load()
    } catch {
      toast.error('Failed to update action')
    }
  }

  const remove = async (id) => {
    try {
      await api.delete(`/sites/${siteId}/actions/${id}`)
      toast.success('Action deleted')
      load()
    } catch {
      toast.error('Failed to delete action')
    }
  }

  const pending = [...actions.filter(a => !a.done)].sort((a, b) => {
    const rank = (impact) => {
      const i = String(impact || '').toLowerCase()
      if (i === 'critical') return 0
      if (i === 'high') return 1
      if (i === 'medium') return 2
      if (i === 'low') return 3
      return 4
    }
    return rank(a.impact) - rank(b.impact)
  })
  const completed = actions.filter(a => a.done)
  const done = completed.length

  return (
    <div className="fade-in page-content">
      <PageHeader
        title="Action Plan"
        subtitle="Track SEO tasks by priority — auto-synced from your latest audit"
        action={
          <OrangeBtn onClick={refreshFromAudit} disabled={syncing || loading} style={{ height: 36 }}>
            {syncing ? 'Refreshing…' : 'Refresh from audit'}
          </OrangeBtn>
        }
      />
      <PageProcessGuide
        title="Action Plan process — follow these steps"
        tip="Work top impact first. Same clickable flow pattern as Audit and Overview."
        steps={ACTIONS_PAGE_FLOW.map((s) => ({
          ...s,
          done: s.id === 'pending' ? pending.length === 0 && actions.length > 0 : false,
          active: s.id === 'priority' || (s.id === 'pending' && pending.length > 0),
        }))}
      />
      <div id="actions-section-banner" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        <MetricCard label="Total tasks" value={actions.length} />
        <MetricCard label="Completed" value={done} accent="var(--green)" />
        <MetricCard label="Remaining" value={actions.length - done} accent="var(--orange)" />
      </div>
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Add action</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          <input placeholder="New action item..." value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 1 }} />
          <select value={form.impact} onChange={e => setForm(p => ({ ...p, impact: e.target.value }))} style={{ width: 120 }}>
            <option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
        </div>
      </Card>
      {loading ? <EmptyState message="Loading..." /> : (
        <div id="actions-section-list">
          {pending.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <SectionLabel>Pending ({pending.length})</SectionLabel>
              {pending.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dark4)' }}>
                  <div onClick={() => toggle(a.id, a.done)} style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--dark4)', cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--orange)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--dark4)'} />
                  <span style={{ flex: 1, fontSize: 14 }}>{a.text}</span>
                  <Badge status={a.impact} />
                  <button onClick={() => remove(a.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18 }}><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              ))}
            </Card>
          )}
          {completed.length > 0 && (
            <Card>
              <SectionLabel>Completed ({completed.length})</SectionLabel>
              {completed.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--dark4)', opacity: 0.5 }}>
                  <div onClick={() => toggle(a.id, a.done)} style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--green-dim)', border: '2px solid var(--green)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--green)', fontSize: 11 }}><FontAwesomeIcon icon={faCheck} /></span>
                  </div>
                  <span style={{ flex: 1, fontSize: 14, textDecoration: 'line-through', color: 'var(--text2)' }}>{a.text}</span>
                  <button onClick={() => remove(a.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18 }}><FontAwesomeIcon icon={faXmark} /></button>
                </div>
              ))}
            </Card>
          )}
          {actions.length === 0 && <EmptyState message="No open tasks. Run or refresh from audit to pull failing checks." />}
        </div>
      )}
    </div>
  )
}
