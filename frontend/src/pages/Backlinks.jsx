import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from '../utils/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faSpider, faRotate, faWandMagicSparkles, faCloudArrowUp, faStar, faLock } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Card, SectionLabel, MetricCard, OrangeBtn, PageHeader, GhostBtn } from '../components/UI'
import BacklinksTable from '../components/BacklinksTable'
import api from '../utils/api'

export default function Backlinks() {
  const { siteId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canDiscover = user?.is_paid || user?.id === 1
  const [backlinks, setBacklinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', dr: '', status: 'Todo', url: '', anchor: '', type: 'dofollow' })
  const [addMode, setAddMode] = useState('domain')
  const [quickDomain, setQuickDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)
  const [seeds, setSeeds] = useState('')
  const [showCrawler, setShowCrawler] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [integrations, setIntegrations] = useState(null)
  const [loadingOpps, setLoadingOpps] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [savedOpportunities, setSavedOpportunities] = useState([])
  const [backlinkSummary, setBacklinkSummary] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [importingCsv, setImportingCsv] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [quickDiscovering, setQuickDiscovering] = useState(false)

  const load = () =>
    Promise.all([
      api.get(`/sites/${siteId}/backlinks`).catch(() => ({ data: [] })),
      api.get(`/sites/${siteId}/integrations`).catch(() => ({ data: null })),
      api.get(`/sites/${siteId}/backlink-opportunities`).catch(() => ({ data: [] })),
      api.get(`/sites/${siteId}/backlinks/summary`).catch(() => ({ data: null })),
    ])
      .then(([backlinksRes, integrationsRes, opportunitiesRes, summaryRes]) => {
        setBacklinks(Array.isArray(backlinksRes.data) ? backlinksRes.data : [])
        setIntegrations(integrationsRes.data || null)
        setSavedOpportunities(
          Array.isArray(opportunitiesRes.data) ? opportunitiesRes.data : []
        )
        setBacklinkSummary(summaryRes.data || null)
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

    try {
      domain = normalizeDomain(quickDomain)
    } catch {
      toast.error('Please enter a valid domain')
      return
    }

    if (!domain) {
      toast.error('Domain is required')
      return
    }

    setAdding(true)

    try {
      await api.post(`/sites/${siteId}/backlink-opportunities`, {
        sourceDomain: domain,
        sourceUrl: `https://${domain}/`,
        opportunityType: 'manual-prospect',
        strategy: '',
        relevance: '',
        estimatedDR: 0,
        status: 'Prospect',
        source: 'manual',
      })

      toast.success('Domain added as a backlink opportunity')
      setQuickDomain('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to add opportunity')
    }

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
    const seedList = seeds
      .split('\n')
      .map(s => s.trim())
      .filter(s => /^https?:\/\//i.test(s))

    if (!seedList.length) {
      toast.error('Add at least one external public seed URL')
      return
    }

    setCrawling(true)
    setCrawlResult(null)

    try {
      const { data } = await api.post(
        `/sites/${siteId}/backlinks/index-crawl`,
        {
          seeds: seedList,
          maxPages: 200,
          maxDepth: 1,
          domainDelayMs: 1200,
        }
      )

      setCrawlResult(data)

      const found = Number(data?.stats?.backlinksDetected || 0)

      if (found > 0) {
        toast.success(
          `Our crawler verified ${found} backlink${found > 1 ? 's' : ''}`
        )
      } else {
        toast(
          `Indexed ${data?.stats?.pagesCrawled || 0} pages and ${data?.stats?.linksExtracted || 0} links. No verified backlink to this project was found in this run.`,
          { icon: 'i' }
        )
      }

      await load()
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
        e.response?.data?.error ||
        'Own crawler failed'
      )
    }

    setCrawling(false)
  }
  const discoverFromProject = async () => {
    if (!canDiscover) {
      toast('Upgrade to unlock automatic backlink discovery', { icon: '?' })
      return
    }

    setQuickDiscovering(true)

    try {
      const { data } = await api.post(
        `/sites/${siteId}/backlinks/dataforseo-sync`,
        {
          limit: 500,
          verifyLimit: 25,
        }
      )

      setCrawlResult(data)

      if (Number(data.received || 0) > 0) {
        toast.success(
          `Found ${data.received} real backlink records from DataForSEO`
        )
      } else {
        toast(
          'DataForSEO returned no live backlinks for this project.',
          { icon: 'i' }
        )
      }

      await load()
    } catch (e) {
      toast.error(
        e.response?.data?.detail ||
        e.response?.data?.error ||
        'Real backlink discovery failed'
      )
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
      await api.post(`/sites/${siteId}/backlink-opportunities`, {
        sourceDomain: String(opp.site || '').trim(),
        sourceUrl: String(opp.siteUrl || '').trim(),
        strategy: String(opp.strategy || '').trim(),
        opportunityType: String(opp.type || 'ai-opportunity'),
        relevance: String(opp.relevance || ''),
        estimatedDR: Number(opp.estimatedDR || 0),
        evidence: String(opp.evidence || ''),
        status: 'Prospect',
        source: 'ai',
      })

      setOpportunities(prev => prev.filter(x => x.site !== opp.site))
      toast.success('Opportunity saved')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save opportunity')
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
.filter((b) => {
  const source = String(b.source || '').toLowerCase()
  const verificationStatus = String(b.verification_status || '').toLowerCase()

  const verifiedProvider =
    source === 'dataforseo' ||
    source === 'crawled' ||
    verificationStatus === 'live' ||
    verificationStatus === 'redirected'

  return b.status === 'Live' && verifiedProvider
})
.sort((a, b) => {
  const rankA = Number(a.provider_rank || a.dr || 0)
  const rankB = Number(b.provider_rank || b.dr || 0)

  const scoreA =
    (rankA * 2) +
    ((a.type || 'dofollow') === 'dofollow' ? 20 : 0) -
    Number(a.provider_spam_score || a.spam_score || 0)

  const scoreB =
    (rankB * 2) +
    ((b.type || 'dofollow') === 'dofollow' ? 20 : 0) -
    Number(b.provider_spam_score || b.spam_score || 0)

  return scoreB - scoreA
})
.slice(0, 5)

  return (
    <div className="fade-in page-content">
      <button
        type="button"
        onClick={() => navigate(`/site/${siteId}`)}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          marginBottom: 8,
          color: '#64748B',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        ← Back to Overview
      </button>

      <PageHeader
        title="Backlinks"
        subtitle="Track live links, manage outreach prospects, and discover new opportunities."
      />

      {backlinkSummary && (
        <div className="bl-real-summary" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          marginBottom: 12,
        }}>
          <MetricCard label="Live backlinks" value={backlinkSummary.totalBacklinks || 0} />
          <MetricCard label="Referring domains" value={backlinkSummary.referringDomains || 0} accent="var(--blue)" />
          <MetricCard label="Dofollow" value={`${backlinkSummary.dofollowRatio || 0}%`} accent="var(--green)" />
          <MetricCard label="New 30d" value={backlinkSummary.new30d || 0} accent="var(--purple)" />
          <MetricCard label="Lost" value={backlinkSummary.lost || 0} accent="var(--red)" />
          <MetricCard label="Opportunities" value={backlinkSummary.opportunities || savedOpportunities.length} accent="var(--amber)" />
        </div>
      )}

      <div className="bl-metric-strip">
        <MetricCard label="Total" value={backlinks.length} />
        <MetricCard label="Dofollow" value={dofollow} accent="var(--green)" />
        <MetricCard label="Live" value={live} accent="var(--blue)" />
        <MetricCard label="Pending" value={pending} accent="var(--amber)" />
        <MetricCard label="To do" value={todo} accent="var(--red)" />
        {ahrefsBacklinks > 0 && <MetricCard label="Estimated backlinks" value={ahrefsBacklinks.toLocaleString()} accent="var(--purple)" />}
        {ahrefsRefDomains > 0 && <MetricCard label="Ref domains" value={ahrefsRefDomains.toLocaleString()} accent="var(--blue)" />}
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="bl-intake">
          <div className="bl-intake-toolbar">
            <div className="bl-mode-switch" role="tablist" aria-label="Add mode">
              <button
                type="button"
                role="tab"
                aria-selected={addMode === 'domain'}
                className={`bl-mode-btn${addMode === 'domain' ? ' bl-mode-btn--active' : ''}`}
                onClick={() => setAddMode('domain')}
              >
                Prospect
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addMode === 'manual'}
                className={`bl-mode-btn${addMode === 'manual' ? ' bl-mode-btn--active' : ''}`}
                onClick={() => setAddMode('manual')}
              >
                Verified link
              </button>
            </div>

            <div className="bl-intake-actions">
              <GhostBtn onClick={discoverFromProject} disabled={quickDiscovering} title={!canDiscover ? 'Upgrade to unlock' : 'Crawl your project for referring pages'}>
                {quickDiscovering
                  ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Discovering...</>
                  : !canDiscover
                    ? <><FontAwesomeIcon icon={faLock} style={{ marginRight: 6 }} />Discover</>
                    : <><FontAwesomeIcon icon={faSpider} style={{ marginRight: 6 }} />Discover</>
                }
              </GhostBtn>
              <GhostBtn onClick={loadAiOpportunities} style={{ height: 36 }}>
                {loadingOpps
                  ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Finding...</>
                  : <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />Opportunities</>
                }
              </GhostBtn>
              <GhostBtn onClick={() => setShowAdvanced(p => !p)} style={{ height: 36 }}>
                {showAdvanced ? 'Hide tools' : 'Import / crawl'}
              </GhostBtn>
            </div>
          </div>

          <div className="bl-form-shell">
            {addMode === 'domain' ? (
              <div className="bl-quick-add">
                <div className="bl-field bl-field--grow">
                  <label htmlFor="bl-prospect-domain">Target domain</label>
                  <input
                    id="bl-prospect-domain"
                    placeholder="e.g. clutch.co"
                    value={quickDomain}
                    onChange={e => setQuickDomain(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDomain()}
                    autoComplete="off"
                  />
                </div>
                <OrangeBtn onClick={addDomain} disabled={adding || !quickDomain.trim()} style={{ alignSelf: 'end', justifyContent: 'center', minWidth: 140 }}>
                  {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add prospect</>}
                </OrangeBtn>
                <p className="bl-form-help bl-form-help--inline">
                  Outreach target only — won’t count toward live backlinks until a real URL is verified.
                </p>
              </div>
            ) : (
              <div className="bl-manual-grid">
                <div className="bl-field">
                  <label htmlFor="bl-source-url">Referring page URL</label>
                  <input
                    id="bl-source-url"
                    placeholder="https://example.com/post-with-your-link"
                    value={form.url}
                    onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div className="bl-field">
                  <label htmlFor="bl-domain-name">Domain (optional)</label>
                  <input
                    id="bl-domain-name"
                    placeholder="Auto from URL"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="bl-field bl-field--full">
                  <label htmlFor="bl-anchor">Anchor text</label>
                  <input
                    id="bl-anchor"
                    placeholder="Visible link text"
                    value={form.anchor}
                    onChange={e => setForm(p => ({ ...p, anchor: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addManual()}
                  />
                </div>
                <div className="bl-field">
                  <label htmlFor="bl-dr">DR</label>
                  <input
                    id="bl-dr"
                    placeholder="0–100"
                    value={form.dr}
                    type="number"
                    min="0"
                    max="100"
                    onChange={e => setForm(p => ({ ...p, dr: e.target.value }))}
                  />
                </div>
                <div className="bl-field">
                  <label htmlFor="bl-type">Type</label>
                  <select id="bl-type" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="dofollow">Dofollow</option>
                    <option value="nofollow">Nofollow</option>
                  </select>
                </div>
                <div className="bl-field">
                  <label htmlFor="bl-status">Status</label>
                  <select id="bl-status" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option>Todo</option>
                    <option>Pending</option>
                    <option>Live</option>
                  </select>
                </div>
                <div className="bl-field bl-field--action">
                  <label>&nbsp;</label>
                  <OrangeBtn onClick={addManual} disabled={adding} style={{ justifyContent: 'center' }}>
                    {adding ? 'Saving...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Save link</>}
                  </OrangeBtn>
                </div>
              </div>
            )}
          </div>

          {opportunities.length > 0 && (
            <div className="bl-opportunities">
              <SectionLabel>Suggested opportunities</SectionLabel>
              <div className="bl-opportunity-list">
                {opportunities.slice(0, 4).map((opp, idx) => (
                  <div key={`${opp.site}-${idx}`} className="bl-opportunity-card">
                    <div style={{ minWidth: 0 }}>
                      <div className="bl-opportunity-title">{opp.site}</div>
                      <div className="bl-opportunity-meta">{opp.type} • {opp.relevance} relevance • Estimated DR {opp.estimatedDR || 0}</div>
                      <div className="bl-opportunity-strategy">{opp.strategy}</div>
                      {opp.evidence && <div className="bl-form-help" style={{ marginTop: 6 }}>{opp.evidence}</div>}
                      {opp.siteUrl && (
                        <a href={opp.siteUrl} target="_blank" rel="noopener noreferrer" className="bl-form-help" style={{ display: 'inline-block', marginTop: 4 }}>
                          Open source
                        </a>
                      )}
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
                  <div>Domain Rank <strong>{Number(b.provider_rank || b.dr || 0)}</strong></div>
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
                    ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Importingâ€¦</>
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
                  Build our backlink index
                </div>
                <span className="crawler-toggle">{showCrawler ? 'â–²' : 'â–¼'}</span>
              </div>

              {showCrawler && (
                <div className="crawler-body">
                  <p className="crawler-desc">
                    Our crawler starts from these public pages, extracts source-to-target links, grows the DevnDespro link index, and verifies any backlink it finds to this project.
                  </p>
                  <label className="crawler-label">Seed URLs <span>(required for crawler V1, one per line)</span></label>
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
                        ? <><FontAwesomeIcon icon={faRotate} spin style={{ marginRight: 6 }} />Crawlingâ€¦</>
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






