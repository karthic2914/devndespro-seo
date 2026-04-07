import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faCircleQuestion, faSpider, faRotate, faWandMagicSparkles, faCloudArrowUp, faStar } from '@fortawesome/free-solid-svg-icons'
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
  const [integrations, setIntegrations] = useState(null)
  const [loadingOpps, setLoadingOpps] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [csvText, setCsvText] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const load = () =>
    Promise.all([
      api.get(`/sites/${siteId}/backlinks`).catch(() => ({ data: [] })),
      api.get(`/sites/${siteId}/integrations`).catch(() => ({ data: null })),
    ])
      .then(([backlinksRes, integrationsRes]) => {
        setBacklinks(Array.isArray(backlinksRes.data) ? backlinksRes.data : [])
        setIntegrations(integrationsRes.data || null)
      })
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

  const loadAiOpportunities = async () => {
    setLoadingOpps(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/ai/link-opportunities`)
      setOpportunities(Array.isArray(data) ? data : [])
      if (!Array.isArray(data) || data.length === 0) toast('No new opportunities found right now.')
    } catch {
      toast.error('Failed to load backlink opportunities')
    }
    setLoadingOpps(false)
  }

  const addOpportunity = async (opp) => {
    try {
      await api.post(`/sites/${siteId}/backlinks`, {
        name: String(opp.site || '').trim(),
        dr: Number(opp.estimatedDR || 0),
        status: 'Todo',
        anchor: String(opp.strategy || '').trim(),
        url: '',
        type: 'dofollow',
      })
      setOpportunities(prev => prev.filter(x => x.site !== opp.site))
      toast.success('Opportunity added to backlinks')
      load()
    } catch {
      toast.error('Failed to save opportunity')
    }
  }

  const importDetailedCsv = async () => {
    if (!csvText.trim()) { toast.error('Paste CSV data first'); return }
    setImportingCsv(true)
    setImportResult(null)
    try {
      const { data } = await api.post(`/sites/${siteId}/backlinks/import-detailed-csv`, { csvText })
      setImportResult(data)
      toast.success(`Imported ${data.imported} backlinks`)
      if (data.imported > 0) setCsvText('')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'CSV import failed')
    }
    setImportingCsv(false)
  }

  const live     = backlinks.filter(b => b.status === 'Live').length
  const pending  = backlinks.filter(b => b.status === 'Pending').length
  const todo     = backlinks.filter(b => b.status === 'Todo').length
  const dofollow = backlinks.filter(b => (b.type || 'dofollow') === 'dofollow').length
  const ahrefsBacklinks = Number(integrations?.ahrefs?.latest?.backlinks || 0)
  const ahrefsRefDomains = Number(integrations?.ahrefs?.latest?.ref_domains || 0)
  const bestPicks = [...backlinks]
    .sort((a, b) => {
      const sa = (Number(a.dr || 0) * 2) + ((a.type || 'dofollow') === 'dofollow' ? 20 : 0) + (a.status === 'Live' ? 10 : 0)
      const sb = (Number(b.dr || 0) * 2) + ((b.type || 'dofollow') === 'dofollow' ? 20 : 0) + (b.status === 'Live' ? 10 : 0)
      return sb - sa
    })
    .slice(0, 5)

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
        {ahrefsBacklinks > 0 && <MetricCard label="Estimated backlinks" value={ahrefsBacklinks.toLocaleString()} accent="var(--purple)" />}
        {ahrefsRefDomains > 0 && <MetricCard label="Ref domains" value={ahrefsRefDomains.toLocaleString()} accent="var(--blue)" />}
      </div>

      {(ahrefsBacklinks > backlinks.length || ahrefsRefDomains > 0) && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
            This table shows <strong>{backlinks.length}</strong> tracked backlink records you added manually or discovered with the crawler.
            {ahrefsBacklinks > 0 && <> Your imported Ahrefs summary estimates about <strong>{ahrefsBacklinks.toLocaleString()}</strong> total backlinks and <strong>{ahrefsRefDomains.toLocaleString()}</strong> referring domains.</>}
          </div>
        </Card>
      )}

      {bestPicks.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <SectionLabel style={{ marginBottom: 8 }}>
            <FontAwesomeIcon icon={faStar} style={{ marginRight: 8, color: 'var(--orange)' }} />
            Best backlinks to show customer
          </SectionLabel>
          <div style={{ display: 'grid', gap: 8 }}>
            {bestPicks.map((b) => (
              <div key={`best-${b.id}`} style={{
                border: '1px solid var(--dark4)', borderRadius: 8,
                padding: '8px 10px', display: 'flex', justifyContent: 'space-between', gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.anchor || 'No anchor text'} • {b.type || 'dofollow'}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
                  <div>DR <strong>{b.dr || 0}</strong></div>
                  <div>{b.status}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 12 }}>
        <div className="crawler-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faCloudArrowUp} style={{ color: 'var(--orange)' }} />
            <SectionLabel style={{ margin: 0 }}>Bulk import backlinks CSV</SectionLabel>
          </div>
          <OrangeBtn onClick={importDetailedCsv} disabled={importingCsv}>
            {importingCsv
              ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Importing…</>
              : <>Import rows</>
            }
          </OrangeBtn>
        </div>
        <div className="crawler-body">
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Paste CSV with columns like Domain/Site, URL, Anchor Text, DR, Type, Status.
          </div>
          <textarea
            className="crawler-seeds"
            rows={5}
            placeholder={'Domain,URL,Anchor Text,DR,Type,Status\nexample.com,https://example.com/post,Best seo agency,74,dofollow,Live'}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          {importResult && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
              Imported <strong>{importResult.imported}</strong>, skipped <strong>{importResult.skipped}</strong> from {importResult.totalRows} rows.
            </div>
          )}
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div className="crawler-header" onClick={() => setOpportunities(p => p.length ? [] : p)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: 'var(--orange)' }} />
            <SectionLabel style={{ margin: 0 }}>AI link opportunities</SectionLabel>
          </div>
          <OrangeBtn onClick={(e) => { e.stopPropagation(); loadAiOpportunities() }} disabled={loadingOpps}>
            {loadingOpps
              ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Finding…</>
              : <>Find opportunities</>
            }
          </OrangeBtn>
        </div>
        {opportunities.length > 0 && (
          <div className="crawler-body">
            {opportunities.slice(0, 8).map((opp, idx) => (
              <div key={`${opp.site}-${idx}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                padding: idx === 0 ? '0 0 10px' : '10px 0', borderTop: idx === 0 ? 'none' : '1px solid var(--dark4)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{opp.site}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {opp.type} • {opp.relevance} relevance • Estimated DR {opp.estimatedDR || 0}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>{opp.strategy}</div>
                </div>
                <OrangeBtn onClick={() => addOpportunity(opp)}>
                  <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add
                </OrangeBtn>
              </div>
            ))}
          </div>
        )}
      </Card>

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
              By default it queries <strong>Common Crawl</strong> (8B+ pages) and <strong>Bing search</strong>.
              Add <strong>seed URLs</strong> below for a third optional source — then it verifies and saves pages that link to your site.
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

