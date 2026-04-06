import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, Badge, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import api from '../utils/api'

export default function Keywords() {
  const { siteId } = useParams()
  const [keywords, setKeywords] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ keyword: '', volume: '', difficulty: 'Easy', position: '' })
  const [adding, setAdding] = useState(false)

  const load = () => api.get(`/sites/${siteId}/keywords`).then(r => setKeywords(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [siteId])

  const add = async () => {
    if (!form.keyword.trim()) return
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/keywords`, { keyword: form.keyword.trim(), volume: parseInt(form.volume) || 0, difficulty: form.difficulty, position: parseInt(form.position) || null })
      setForm({ keyword: '', volume: '', difficulty: 'Easy', position: '' })
      load()
    } catch {}
    setAdding(false)
  }

  const updatePos = async (id, position) => {
    try { await api.put(`/sites/${siteId}/keywords/${id}`, { position: parseInt(position) || null }) } catch {}
  }

  const remove = async (id) => {
    try { await api.delete(`/sites/${siteId}/keywords/${id}`); load() } catch {}
  }

  return (
    <div className="fade-in">
      <PageHeader title="Keywords" subtitle="Track your target keyword positions" />
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Add keyword</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input placeholder="Keyword" value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 2, minWidth: 200 }} />
          <input placeholder="Vol/mo" value={form.volume} onChange={e => setForm(p => ({ ...p, volume: e.target.value }))} style={{ width: 90 }} type="number" />
          <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} style={{ width: 110 }}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
          <input placeholder="Position" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} style={{ width: 90 }} type="number" min="1" max="100" />
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
        </div>
      </Card>
      <Card>
        <SectionLabel>Tracked keywords ({keywords.length})</SectionLabel>
        {loading ? <EmptyState message="Loading..." /> : keywords.length === 0 ? <EmptyState message="No keywords yet. Add your first keyword above." /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 40px', gap: 8, fontSize: 11, color: 'var(--muted)', padding: '0 0 8px', borderBottom: '1px solid var(--dark4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span>Keyword</span><span style={{ textAlign: 'right' }}>Vol/mo</span><span style={{ textAlign: 'center' }}>Difficulty</span><span style={{ textAlign: 'center' }}>Position</span><span></span>
            </div>
            {keywords.map(k => (
              <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 40px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--dark4)' }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{k.keyword}</span>
                <span style={{ fontSize: 13, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{k.volume?.toLocaleString()}</span>
                <div style={{ textAlign: 'center' }}><Badge status={k.difficulty} /></div>
                <input type="number" placeholder="—" defaultValue={k.position || ''} onBlur={e => updatePos(k.id, e.target.value)} style={{ width: '100%', textAlign: 'center', padding: '5px 8px', fontSize: 13 }} min="1" max="100" />
                <button onClick={() => remove(k.id)} style={{ background: 'none', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}><FontAwesomeIcon icon={faXmark} /></button>
              </div>
            ))}
          </>
        )}
      </Card>
    </div>
  )
}
