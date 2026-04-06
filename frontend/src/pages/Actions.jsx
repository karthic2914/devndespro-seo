import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, MetricCard, Badge, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import api from '../utils/api'

export default function Actions() {
  const { siteId } = useParams()
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ text: '', impact: 'Medium' })
  const [adding, setAdding] = useState(false)

  const load = () => api.get(`/sites/${siteId}/actions`).then(r => setActions(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

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
      await api.put(`/sites/${siteId}/actions/${id}`, { done: !done })
      toast.success(done ? 'Action moved to pending' : 'Action marked complete')
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

  const done = actions.filter(a => a.done).length
  const pending = actions.filter(a => !a.done)
  const completed = actions.filter(a => a.done)

  return (
    <div className="fade-in page-content">
      <PageHeader title="Action Plan" subtitle="Track SEO tasks by priority" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
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
        <>
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
          {actions.length === 0 && <EmptyState message="No actions yet. Add your first task above." />}
        </>
      )}
    </div>
  )
}
