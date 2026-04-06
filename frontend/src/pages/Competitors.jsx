import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import api from '../utils/api'

export default function Competitors() {
  const { siteId } = useParams()
  const [competitors, setCompetitors] = useState([])
  const [metrics, setMetrics] = useState({ dr: 0 })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', dr: '', notes: '' })
  const [adding, setAdding] = useState(false)
  const [site, setSite] = useState(null)

  const load = () => {
    api.get(`/sites/${siteId}/competitors`).then(r => setCompetitors(r.data)).finally(() => setLoading(false))
    api.get(`/sites/${siteId}/metrics`).then(r => setMetrics(r.data)).catch(() => {})
  }

  useEffect(() => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))
    load()
  }, [siteId])

  const add = async () => {
    if (!form.name.trim()) return
    setAdding(true)
    try { await api.post(`/sites/${siteId}/competitors`, { name: form.name.trim(), dr: parseInt(form.dr) || 0, notes: form.notes }); setForm({ name: '', dr: '', notes: '' }); load() } catch {}
    setAdding(false)
  }

  const remove = async (id) => {
    try { await api.delete(`/sites/${siteId}/competitors/${id}`); load() } catch {}
  }

  return (
    <div className="fade-in page-content">
      <PageHeader title="Competitors" subtitle="Track competitor Domain Ratings and benchmark" />
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Add competitor</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input placeholder="domain.com" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
          <input placeholder="DR" value={form.dr} onChange={e => setForm(p => ({ ...p, dr: e.target.value }))} style={{ width: 80 }} type="number" />
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ flex: 2, minWidth: 160 }} />
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
        </div>
      </Card>
      <Card>
        <SectionLabel>Your DR vs competitors</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--dark4)' }}>
          <div style={{ width: 36, height: 36, background: 'var(--orange)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>
            {site?.name?.[0]?.toUpperCase() || 'Y'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{site?.name || 'Your site'} <span style={{ fontSize: 11, background: 'var(--orange-dim)', color: 'var(--orange)', padding: '1px 7px', borderRadius: 10, marginLeft: 4 }}>You</span></div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{site?.url}</div>
          </div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>DR {metrics.dr}</div>
        </div>
        {loading ? <EmptyState message="Loading..." /> : competitors.length === 0 ? <EmptyState message="No competitors added yet." /> :
          competitors.map(c => {
            const diff = c.dr - metrics.dr
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--dark4)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--dark4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text2)', flexShrink: 0 }}>{c.name[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                  {c.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.notes}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: diff > 0 ? 'var(--red)' : 'var(--green)' }}>DR {c.dr}</div>
                  <div style={{ fontSize: 11, color: diff > 0 ? 'var(--red)' : 'var(--green)', marginTop: 2 }}>{diff > 0 ? `${diff} ahead` : diff < 0 ? `you lead by ${Math.abs(diff)}` : 'tied'}</div>
                </div>
                <button onClick={() => remove(c.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18, marginLeft: 8 }}><FontAwesomeIcon icon={faXmark} /></button>
              </div>
            )
          })
        }
      </Card>
    </div>
  )
}
