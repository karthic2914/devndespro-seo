import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faXmark, faWandMagicSparkles, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import AppProcessTopBar from '../components/AppProcessTopBar'
import { COMPETITORS_PAGE_FLOW } from '../constants/pageFlows'
import api from '../utils/api'
import toast from '../utils/toast'

export default function Competitors() {
  const { siteId } = useParams()
  const [competitors, setCompetitors] = useState([])
  const [metrics, setMetrics] = useState({ dr: 0 })
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', dr: '', notes: '' })
  const [adding, setAdding] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [description, setDescription] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)
  const [siteData, setSiteData] = useState(null)
  const [site, setSite] = useState(null)

  const load = () => {
    api.get(`/sites/${siteId}/competitors`).then(r => setCompetitors(r.data)).finally(() => setLoading(false))
    api.get(`/sites/${siteId}/metrics`).then(r => setMetrics(r.data)).catch(() => {})
    api.get(`/sites/${siteId}`).then(r => { setSiteData(r.data); setDescription(r.data?.description || '') }).catch(() => {})
  }

  useEffect(() => {
    const stored = localStorage.getItem('activeSite')
    if (stored) setSite(JSON.parse(stored))
    load()
  }, [siteId])

  const add = async () => {
    if (!form.name.trim()) return
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/competitors`, {
        name: form.name.trim(),
        dr: parseInt(form.dr) || 0,
        notes: form.notes,
        url: `https://${String(form.name).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]}`,
      })
      setForm({ name: '', dr: '', notes: '' })
      load()
      toast.success('Competitor added')
    } catch {
      toast.error('Failed to add competitor')
    }
    setAdding(false)
  }

  const autoDiscover = async () => {
    setDiscovering(true)
    try {
      const res = await api.post(`/sites/${siteId}/competitors/auto-discover`, { prune: true })
      load()
      const inserted = res?.data?.inserted ?? 0
      const pruned = res?.data?.pruned ?? 0
      const updated = res?.data?.updated ?? 0
      const parts = []
      if (pruned) parts.push(`removed ${pruned} off-niche`)
      if (inserted) parts.push(`added ${inserted}`)
      if (updated) parts.push(`updated ${updated} with details`)
      if (parts.length) toast.success(`Competitors refreshed (${parts.join(', ')})`)
      else toast.success('Competitors refreshed')
      if (res?.data?.tip) toast(res.data.tip)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Auto-discover failed')
      if (e?.response?.data?.tip) toast(e.response.data.tip)
      load()
    }
    setDiscovering(false)
  }

  const saveDescription = async () => {
    setSavingDescription(true)
    try {
      await api.patch(`/sites/${siteId}/description`, { description })
      toast.success('Description saved')
    } catch {
      toast.error('Failed to save description')
    }
    setSavingDescription(false)
  }

  const remove = async (id) => {
    try { await api.delete(`/sites/${siteId}/competitors/${id}`); load(); toast.success('Competitor removed') } catch { toast.error('Failed to remove competitor') }
  }

  return (
    <div className="fade-in">
      <AppProcessTopBar
        steps={COMPETITORS_PAGE_FLOW.map((s) => ({
          ...s,
          done: s.id === 'add' ? competitors.length > 0 : s.id === 'describe' ? Boolean(description.trim()) : false,
          active: s.id === 'describe' ? !description.trim() : s.id === 'add' ? competitors.length === 0 : false,
        }))}
      />
      <div className="page-content">
      {discovering && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(255,255,255,0.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14,
        }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 36, color: 'var(--orange)' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Discovering competitors...</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Checking real ranking data and filtering for relevance</div>
        </div>
      )}
      <PageHeader title="Competitors" subtitle="Type competitors manually, or auto-discover from backlinks, rankings, and your site crawl" />
      <Card style={{ marginBottom: 14 }} id="comp-section-setup">
        <SectionLabel>Business description</SectionLabel>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Critical for correct competitors. Example: “Web design, web development and SEO agency for businesses in Norway / Scandinavia.”
          Auto-Discover uses this to keep rivals in your niche (not random sites that only share backlinks).
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            placeholder="e.g. Deploys agentic AI systems - AI agent governance and security orchestration platform for enterprises"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            style={{ flex: 1, minWidth: 200, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <OrangeBtn onClick={saveDescription} disabled={savingDescription}>
            {savingDescription ? 'Saving...' : 'Save'}
          </OrangeBtn>
        </div>
      </Card>
      <Card style={{ marginBottom: 14 }} id="comp-section-list">
        <SectionLabel>Add competitor</SectionLabel>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input placeholder="domain.com" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
          <input placeholder="DR" value={form.dr} onChange={e => setForm(p => ({ ...p, dr: e.target.value }))} style={{ width: 80 }} type="number" />
          <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ flex: 2, minWidth: 160 }} />
          <OrangeBtn onClick={add} disabled={adding}>
            {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
          </OrangeBtn>
        </div>
        <div style={{ marginTop: 10 }}>
          <OrangeBtn onClick={autoDiscover} disabled={discovering}>
            {discovering
              ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 6 }} />Discovering...</>
              : <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />Auto-Discover Competitors</>}
          </OrangeBtn>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
            Finds same-niche agencies (web design / SEO / development), adds industry + summary details, and removes off-niche auto matches.
          </span>
        </div>
      </Card>
      <Card>
        <SectionLabel>Your DR vs competitors</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--dark4)' }}>
          <div style={{ width: 36, height: 60, background: 'var(--orange)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0 }}>
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
              <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--dark4)' }}>
                <div style={{ width: 36, height: 60, background: 'var(--dark4)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text2)', flexShrink: 0 }}>{c.name[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  {(c.industry || c.location) && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginTop: 2 }}>
                      {[c.industry, c.location].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {(c.summary || c.notes) && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {c.summary || c.notes}
                    </div>
                  )}
                  {c.title && c.title !== c.summary && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{c.title}</div>
                  )}
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
    </div>
  )
}

