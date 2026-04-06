import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCircleQuestion, faSpider, faRotate } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, MetricCard, OrangeBtn, PageHeader } from '../components/UI'
import BacklinksTable from '../components/BacklinksTable'
import api from '../utils/api'

export default function Backlinks() {
  const { siteId } = useParams()
  const [backlinks, setBacklinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', dr: '', status: 'Todo', url: '', anchor: '', type: 'dofollow' })
  const [adding, setAdding] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)
  const [seeds, setSeeds] = useState('')
  const [showCrawler, setShowCrawler] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const load = () =>
    api.get(`/sites/${siteId}/backlinks`)
      .then(r => setBacklinks(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [siteId])

  const normalizeUrl = (raw) => {
    const v = String(raw || '').trim()
    if (!v) return ''
    const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(w).href
  }

  const add = async () => {
    if (!form.name.trim()) { toast.error('Site name is required'); return }
    let normalizedUrl = ''
    if (form.url.trim()) {
      try { normalizedUrl = normalizeUrl(form.url) }
      catch { toast.error('Please enter a valid source URL'); return }
    }
    setAdding(true)
    try {
      const dr = Number(form.dr)
      await api.post(`/sites/${siteId}/backlinks`, {
        name: form.name.trim(),
        dr: Number.isFinite(dr) ? Math.max(0, Math.min(100, dr)) : 0,
        status: form.status, url: normalizedUrl,
        anchor: form.anchor.trim(), type: form.type,
      })
      setForm({ name: '', dr: '', status: 'Todo', url: '', anchor: '', type: 'dofollow' })
      toast.success('Backlink added')
      setShowAdd(false)
      load()
    } catch { toast.error('Failed to add backlink') }
    setAdding(false)
  }

  const updateStatus = async (id, status) => {
    try { await api.put(`/sites/${siteId}/backlinks/${id}`, { status }); load() }
    catch { toast.error('Failed to update status') }
  }

  const remove = async (id) => {
    try { await api.delete(`/sites/${siteId}/backlinks/${id}`); toast.success('Removed'); load() }
    catch { toast.error('Failed to remove') }
  }

  const crawl = async () => {
    setCrawling(true); setCrawlResult(null)
    try {
      const seedList = seeds.split('\n').map(s => s.trim()).filter(s => s.startsWith('http'))
      const r = await api.post(`/sites/${siteId}/backlinks/crawl`, { seeds: seedList })
      setCrawlResult(r.data)
      if (r.data.saved > 0) { toast.success(`Discovered ${r.data.saved} new backlink${r.data.saved > 1 ? 's' : ''}!`); load() }
      else toast('No new backlinks found this crawl.')
    } catch { toast.error('Crawl failed') }
    setCrawling(false)
  }

  const live     = backlinks.filter(b => b.status === 'Live').length
  const pending  = backlinks.filter(b => b.status === 'Pending').length
  const todo     = backlinks.filter(b => b.status === 'Todo').length
  const dofollow = backlinks.filter(b => (b.type || 'dofollow') === 'dofollow').length

  return (
    <div className="fade-in page-content">
      <PageHeader title="Backlinks" subtitle="Track, discover and analyse your link building profile" />

      {/* Metric strip */}
      <div className="bl-metric-strip">
        <MetricCard label="Total" value={backlinks.length} />
        <MetricCard label="Dofollow" value={dofollow} accent="var(--green)" />
        <MetricCard label="Live" value={live} accent="var(--blue)" />
        <MetricCard label="Pending" value={pending} accent="var(--amber)" />
        <MetricCard label="To do" value={todo} accent="var(--red)" />
      </div>

      {/* Crawler */}
      <Card style={{ marginBottom: 12 }}>
        <div className="crawler-header" onClick={() => setShowCrawler(p => !p)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faSpider} style={{ color: 'var(--orange)' }} />
            <SectionLabel style={{ margin: 0 }}>Discover backlinks — web crawler</SectionLabel>
          </div>
          <span className="crawler-toggle">{showCrawler ? '▲' : '▼'}</span>
        </div>
        {showCrawler && (
          <div className="crawler-body">
            <p className="crawler-desc">
              Queries <strong>Common Crawl</strong> (8B+ pages), <strong>Bing search</strong>, and any
              <strong> seed URLs</strong> you paste — verifies and saves pages that link to your site.
            </p>
            <label className="crawler-label">Seed URLs <span>(optional — one per line)</span></label>
            <textarea className="crawler-seeds" rows={4}
              placeholder={"https://clutch.co/agencies\nhttps://www.g2.com/categories/seo"}
              value={seeds} onChange={e => setSeeds(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <OrangeBtn onClick={crawl} disabled={crawling}>
                {crawling
                  ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Crawling…</>
                  : <><FontAwesomeIcon icon={faSpider} style={{ marginRight: 6 }} />Run crawler</>}
              </OrangeBtn>
              {crawlResult && (
                <span className="crawler-result">
                  {crawlResult.saved > 0 ? `✓ ${crawlResult.saved} new backlink${crawlResult.saved > 1 ? 's' : ''} saved` : 'No new backlinks found'}
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Add manually */}
      <Card style={{ marginBottom: 12 }}>
        <div className="crawler-header" onClick={() => setShowAdd(p => !p)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faPlus} style={{ color: 'var(--orange)' }} />
            <SectionLabel style={{ margin: 0 }}>Add backlink manually</SectionLabel>
            <div className="tooltip-trigger">
              <FontAwesomeIcon icon={faCircleQuestion} />
              <div className="tooltip-popup">Add one opportunity per domain and move it from Todo → Pending → Live.</div>
            </div>
          </div>
          <span className="crawler-toggle">{showAdd ? '▲' : '▼'}</span>
        </div>
        {showAdd && (
          <div className="crawler-body">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input placeholder="Site name (e.g. Clutch.co)" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 2, minWidth: 160 }} />
              <input placeholder="Source URL" value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))} style={{ flex: 2, minWidth: 160 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              <input placeholder="Anchor text" value={form.anchor}
                onChange={e => setForm(p => ({ ...p, anchor: e.target.value }))} style={{ flex: 2, minWidth: 140 }} />
              <input placeholder="DR (0–100)" value={form.dr} type="number"
                onChange={e => setForm(p => ({ ...p, dr: e.target.value }))} style={{ width: 90 }} />
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ width: 120 }}>
                <option value="dofollow">Dofollow</option>
                <option value="nofollow">Nofollow</option>
              </select>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ width: 110 }}>
                <option>Todo</option><option>Pending</option><option>Live</option>
              </select>
              <OrangeBtn onClick={add} disabled={adding}>
                {adding ? 'Adding…' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
              </OrangeBtn>
            </div>
          </div>
        )}
      </Card>

      {/* Advanced table */}
      <Card>
        <BacklinksTable
          backlinks={backlinks}
          loading={loading}
          onUpdateStatus={updateStatus}
          onRemove={remove}
        />
      </Card>
    </div>
  )
}

