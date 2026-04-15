import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faSpider, faRotate, faWandMagicSparkles, faCloudArrowUp, faStar } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, MetricCard, OrangeBtn, PageHeader, GhostBtn } from '../components/UI'
import BacklinksTable from '../components/BacklinksTable'
import api from '../utils/api'

export default function Backlinks() {
  const { siteId } = useParams()
  const [backlinks, setBacklinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', dr: '', status: 'Todo', url: '', anchor: '', type: 'dofollow' })
  const [addMode, setAddMode] = useState('domain')
  const [quickDomain, setQuickDomain] = useState('')
  const [quickSettings, setQuickSettings] = useState({ status: 'Todo', type: 'dofollow' })
  const [adding, setAdding] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)
  const [seeds, setSeeds] = useState('')
  const [showCrawler, setShowCrawler] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [integrations, setIntegrations] = useState(null)
  const [loadingOpps, setLoadingOpps] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [csvText, setCsvText] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [quickDiscovering, setQuickDiscovering] = useState(false)

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

  const normalizeDomain = (raw) => {
    const v = String(raw || '').trim()
    if (!v) return ''
    const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(w).hostname.replace(/^www\./i, '').toLowerCase()
  }

  const createBacklink = async (payload, successMessage) => {
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/backlinks`, payload)
      toast.success(successMessage)
      await load()
      return true
    } catch { toast.error('Failed to add backlink') }
    setAdding(false)
    return false
  }

  const addDomain = async () => {
    let domain = ''
    try { domain = normalizeDomain(quickDomain) }
    catch { toast.error('Please enter a valid domain'); return }

    if (!domain) { toast.error('Domain is required'); return }

    const ok = await createBacklink({
      name: domain,
      dr: 0,
      status: quickSettings.status,
      url: `https://${domain}/`,
      anchor: '',
      type: quickSettings.type,
      source: 'domain',
    }, 'Domain added to backlinks')

    if (ok) setQuickDomain('')
    setAdding(false)
  }

  const addManual = async () => {
    let normalizedUrl = ''
    if (form.url.trim()) {
      try { normalizedUrl = normalizeUrl(form.url) }
      catch { toast.error('Please enter a valid source URL'); return }
    }

    const derivedName = normalizedUrl
      ? new URL(normalizedUrl).hostname.replace(/^www\./i, '')
      : ''
    const finalName = form.name.trim() || derivedName

    if (!finalName) { toast.error('Add a domain/site name or a valid source URL'); return }

    const dr = Number(form.dr)
    const ok = await createBacklink({
      name: finalName,
      dr: Number.isFinite(dr) ? Math.max(0, Math.min(100, dr)) : 0,
      status: form.status,
      url: normalizedUrl,
      anchor: form.anchor.trim(),
      type: form.type,
      source: 'manual',
    }, 'Backlink added')

    if (ok) {
      setForm({ name: '', dr: '', status: 'Todo', url: '', anchor: '', type: 'dofollow' })
    }
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

  const discoverFromProject = async () => {
    setQuickDiscovering(true)
    try {
      const stored = localStorage.getItem('activeSite')
      const site = stored ? JSON.parse(stored) : null
      const seed = site?.url ? [String(site.url).startsWith('http') ? site.url : `https://${site.url}`] : []
      const r = await api.post(`/sites/${siteId}/backlinks/crawl`, { seeds: seed })
      setCrawlResult(r.data)
      if (r.data.saved > 0) {
        toast.success(`Discovered ${r.data.saved} backlink${r.data.saved > 1 ? 's' : ''} from project crawl`)
        load()
      } else {
        toast('No new backlinks found for this project yet.', { icon: 'ℹ️' })
      }
    } catch {
      toast.error('Project backlink discovery failed')
    }
    setQuickDiscovering(false)
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
      <PageHeader
        title="Backlinks"
        subtitle="Add backlinks by domain, log exact links manually, and keep discovery tools out of the way until you need them."
      />

      <Card style={{ marginBottom: 14 }}>
        <div className="bl-intake">
          <div className="bl-intake-head">
            <div className="bl-intake-copy">
              <div className="bl-intake-kicker">Simpler workflow</div>
              <div className="bl-intake-title">Start with a domain. Switch to manual only when you already know the exact page.</div>
              <div className="bl-intake-sub">
                Domain mode is the fastest way to track outreach targets and prospects. Manual mode is for confirmed links with URL, anchor text, or DR.
              </div>
            </div>
            <div className="bl-intake-actions">
              <OrangeBtn onClick={discoverFromProject} disabled={quickDiscovering}>
                {quickDiscovering
                  ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Discovering…</>
                  : <><FontAwesomeIcon icon={faSpider} style={{ marginRight: 6 }} />Discover from project</>
                }
              </OrangeBtn>
              <GhostBtn onClick={loadAiOpportunities} style={{ height: 38 }}>
                {loadingOpps
                  ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Finding…</>
                  : <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />Find AI ideas</>
                }
              </GhostBtn>
              <GhostBtn onClick={() => setShowAdvanced(p => !p)} style={{ height: 38 }}>
                {showAdvanced ? 'Hide advanced tools' : 'Open advanced tools'}
              </GhostBtn>
            </div>
          </div>

          <div className="bl-mode-switch">
            <button className={`bl-mode-btn${addMode === 'domain' ? ' bl-mode-btn--active' : ''}`} onClick={() => setAddMode('domain')}>
              Add by domain
            </button>
            <button className={`bl-mode-btn${addMode === 'manual' ? ' bl-mode-btn--active' : ''}`} onClick={() => setAddMode('manual')}>
              Add manually
            </button>
          </div>

          <div className="bl-form-shell">
            {addMode === 'domain' ? (
              <>
                <div className="bl-domain-row">
                  <div className="bl-field">
                    <label>Domain or site</label>
                    <input
                      placeholder="clutch.co or https://clutch.co"
                      value={quickDomain}
                      onChange={e => setQuickDomain(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addDomain()}
                    />
                  </div>
                  <div className="bl-field">
                    <label>Type</label>
                    <select value={quickSettings.type} onChange={e => setQuickSettings(p => ({ ...p, type: e.target.value }))}>
                      <option value="dofollow">Dofollow</option>
                      <option value="nofollow">Nofollow</option>
                    </select>
                  </div>
                  <div className="bl-field">
                    <label>Starting status</label>
                    <select value={quickSettings.status} onChange={e => setQuickSettings(p => ({ ...p, status: e.target.value }))}>
                      <option>Todo</option>
                      <option>Pending</option>
                      <option>Live</option>
                    </select>
                  </div>
                  <OrangeBtn onClick={addDomain} disabled={adding} style={{ alignSelf: 'end', justifyContent: 'center' }}>
                    {adding ? 'Adding…' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add domain</>}
                  </OrangeBtn>
                </div>
                <div className="bl-form-help">Use this when you only need to track the referring domain first. You can update status and details later from the table.</div>
              </>
            ) : (
              <>
                <div className="bl-manual-grid">
                  <div className="bl-field">
                    <label>Referring domain or site</label>
                    <input
                      placeholder="Clutch.co"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="bl-field">
                    <label>Source URL</label>
                    <input
                      placeholder="https://example.com/post"
                      value={form.url}
                      onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                    />
                  </div>
                  <div className="bl-field bl-field--full">
                    <label>Anchor text</label>
                    <input
                      placeholder="Best SEO agency"
                      value={form.anchor}
                      onChange={e => setForm(p => ({ ...p, anchor: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addManual()}
                    />
                  </div>
                  <div className="bl-field">
                    <label>DR</label>
                    <input
                      placeholder="0-100"
                      value={form.dr}
                      type="number"
                      onChange={e => setForm(p => ({ ...p, dr: e.target.value }))}
                    />
                  </div>
                  <div className="bl-field">
                    <label>Type</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                      <option value="dofollow">Dofollow</option>
                      <option value="nofollow">Nofollow</option>
                    </select>
                  </div>
                  <div className="bl-field">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                      <option>Todo</option>
                      <option>Pending</option>
                      <option>Live</option>
                    </select>
                  </div>
                  <div className="bl-field bl-field--action">
                    <label>&nbsp;</label>
                    <OrangeBtn onClick={addManual} disabled={adding} style={{ justifyContent: 'center' }}>
                      {adding ? 'Adding…' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Save backlink</>}
                    </OrangeBtn>
                  </div>
                </div>
                <div className="bl-form-help">If you leave the site name empty, it will be derived automatically from the source URL.</div>
              </>
            )}
          </div>

          {opportunities.length > 0 && (
            <div className="bl-opportunities">
              <SectionLabel>AI link opportunities</SectionLabel>
              <div className="bl-opportunity-list">
                {opportunities.slice(0, 4).map((opp, idx) => (
                  <div key={`${opp.site}-${idx}`} className="bl-opportunity-card">
                    <div style={{ minWidth: 0 }}>
                      <div className="bl-opportunity-title">{opp.site}</div>
                      <div className="bl-opportunity-meta">{opp.type} • {opp.relevance} relevance • Estimated DR {opp.estimatedDR || 0}</div>
                      <div className="bl-opportunity-strategy">{opp.strategy}</div>
                    </div>
                    <OrangeBtn onClick={() => addOpportunity(opp)}>
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add
                    </OrangeBtn>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

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

      {/* Advanced table */}
      <Card style={{ marginBottom: 12 }}>
        <BacklinksTable
          backlinks={backlinks}
          loading={loading}
          onUpdateStatus={updateStatus}
          onRemove={remove}
        />
      </Card>

      {bestPicks.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <SectionLabel>
            <><FontAwesomeIcon icon={faStar} style={{ marginRight: 8, color: 'var(--orange)' }} />Best backlinks to show customer</>
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

      <Card>
        <div className="crawler-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FontAwesomeIcon icon={faCloudArrowUp} style={{ color: 'var(--orange)' }} />
            <SectionLabel>Advanced backlinks tools</SectionLabel>
          </div>
          <GhostBtn onClick={() => setShowAdvanced(p => !p)}>
            {showAdvanced ? 'Hide advanced' : 'Show advanced'}
          </GhostBtn>
        </div>

        {showAdvanced && (
          <div className="bl-advanced-grid">
            <div className="bl-advanced-box">
              <div className="bl-advanced-title">
                <FontAwesomeIcon icon={faCloudArrowUp} style={{ color: 'var(--orange)' }} />
                Bulk import CSV
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                Paste CSV with columns like Domain/Site, URL, Anchor Text, DR, Type, Status.
              </div>
              <textarea
                className="crawler-seeds"
                rows={6}
                placeholder={'Domain,URL,Anchor Text,DR,Type,Status\nexample.com,https://example.com/post,Best seo agency,74,dofollow,Live'}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
              />
              <div className="bl-inline-actions">
                <OrangeBtn onClick={importDetailedCsv} disabled={importingCsv}>
                  {importingCsv
                    ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Importing…</>
                    : <>Import rows</>
                  }
                </OrangeBtn>
                {importResult && (
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    Imported <strong>{importResult.imported}</strong>, skipped <strong>{importResult.skipped}</strong> from {importResult.totalRows} rows.
                  </div>
                )}
              </div>
            </div>

            <div className="bl-advanced-box">
              <div className="crawler-header" onClick={() => setShowCrawler(p => !p)}>
                <div className="bl-advanced-title" style={{ marginBottom: 0 }}>
                  <FontAwesomeIcon icon={faSpider} style={{ color: 'var(--orange)' }} />
                  Discover backlinks with crawler
                </div>
                <span className="crawler-toggle">{showCrawler ? '▲' : '▼'}</span>
              </div>

              {showCrawler && (
                <div className="crawler-body">
                  <p className="crawler-desc">
                    Uses Common Crawl and Bing by default. Add optional seed URLs to verify pages that link back to your site.
                  </p>
                  <label className="crawler-label">Seed URLs <span>(optional, one per line)</span></label>
                  <textarea
                    className="crawler-seeds"
                    rows={5}
                    placeholder={"https://clutch.co/agencies\nhttps://www.g2.com/categories/seo"}
                    value={seeds}
                    onChange={e => setSeeds(e.target.value)}
                  />
                  <div className="bl-inline-actions">
                    <OrangeBtn onClick={crawl} disabled={crawling}>
                      {crawling
                        ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Crawling…</>
                        : <><FontAwesomeIcon icon={faSpider} style={{ marginRight: 6 }} />Run crawler</>}
                    </OrangeBtn>
                    {crawlResult && (
                      <span className="crawler-result">
                        {crawlResult.saved > 0 ? `Saved ${crawlResult.saved} new backlink${crawlResult.saved > 1 ? 's' : ''}` : 'No new backlinks found'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

