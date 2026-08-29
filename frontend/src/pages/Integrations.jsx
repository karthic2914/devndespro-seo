import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from '../utils/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlug,
  faChartLine,
  faMagnifyingGlassChart,
  faCloudArrowUp,
  faLink,
  faCircleCheck,
  faTriangleExclamation,
  faGlobe,
  faCube,
  faStore,
  faCodeBranch,
  faShareNodes,
  faChevronDown,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { Button, PageHeader, Badge, T } from '../components/UI'
import '../styles/app/09-integrations.css'

const PUBLISHING_META = {
  wordpress: {
    label: 'WordPress', icon: faGlobe, color: T.blue,
    description: 'Publish generated posts directly to your WordPress website.',
    fields: [
      { key: 'wordpress_site_url', placeholder: 'Site URL' },
      { key: 'wordpress_username', placeholder: 'Username' },
      { key: 'wordpress_app_password', placeholder: 'App Password', type: 'password' },
    ],
  },
  shopify: {
    label: 'Shopify', icon: faStore, color: T.green,
    description: 'Connect your Shopify store for future publishing automation.',
    fields: [
      { key: 'shopify_store_domain', placeholder: 'my-store.myshopify.com' },
      { key: 'shopify_api_token', placeholder: 'Admin API Token', type: 'password' },
    ],
  },
  wix: {
    label: 'Wix', icon: faCube, color: T.amber,
    description: 'Configure Wix so blog publishing can be automated later.',
    fields: [
      { key: 'wix_site_id', placeholder: 'Site ID' },
      { key: 'wix_api_key', placeholder: 'API Key', type: 'password' },
    ],
  },
  webflow: {
    label: 'Webflow', icon: faCodeBranch, color: T.purple,
    description: 'Connect your Webflow CMS site and collection.',
    fields: [
      { key: 'webflow_site_id', placeholder: 'Site ID' },
      { key: 'webflow_collection_id', placeholder: 'Collection ID' },
      { key: 'webflow_api_token', placeholder: 'API Token', type: 'password' },
    ],
  },
  framer: {
    label: 'Framer', icon: faShareNodes, color: T.text,
    description: 'Connect Framer CMS for article publishing.',
    fields: [
      { key: 'framer_site_id', placeholder: 'Site ID' },
      { key: 'framer_collection_id', placeholder: 'Collection ID' },
      { key: 'framer_api_token', placeholder: 'API Token', type: 'password' },
    ],
  },
  webhook: {
    label: 'Webhooks', icon: faLink, color: T.orange,
    description: 'Send generated articles to Zapier, Make, or your own endpoint.',
    fields: [
      { key: 'webhook_url', placeholder: 'Webhook URL' },
      { key: 'webhook_secret', placeholder: 'Optional Secret', type: 'password' },
    ],
  },
}

function emptyPublishingForms() {
  return Object.fromEntries(
    Object.entries(PUBLISHING_META).map(([provider, meta]) => [
      provider,
      Object.fromEntries(meta.fields.map(field => [field.key, ''])),
    ])
  )
}

function IntegrationCard({ id, icon, iconColor, title, status, connected, description, expanded, onToggle, children }) {
  return (
    <section className={`integration-premium-card${connected ? ' is-connected' : ''}${expanded ? ' is-expanded' : ''}`}>
      <button type="button" className="integration-premium-card-head" onClick={() => onToggle(id)} aria-expanded={expanded}>
        <span className="integration-premium-name">
          <span className="integration-premium-icon" style={{ color: iconColor }}>
            <FontAwesomeIcon icon={icon} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{connected ? 'Active connection' : 'Tap to configure'}</small>
          </span>
        </span>
        <span className="integration-premium-head-end">
          <Badge variant={connected ? 'success' : 'default'}>{status}</Badge>
          <FontAwesomeIcon className="integration-premium-chevron" icon={faChevronDown} />
        </span>
      </button>
      <div className="integration-premium-card-body">
        <p>{description}</p>
        {children}
      </div>
    </section>
  )
}

export default function Integrations() {
  const { siteId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('analytics')
  const [expandedCard, setExpandedCard] = useState('gsc')
  const [ga4Form, setGa4Form] = useState({ propertyId: '', measurementId: '' })
  const [manual, setManual] = useState({ dr: '', backlinks: '', refDomains: '', organicTraffic: '', organicKeywords: '' })
  const [csvText, setCsvText] = useState('')
  const [publishingForms, setPublishingForms] = useState(emptyPublishingForms)

  const load = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/sites/${siteId}/integrations`)
      setData(response.data)
      setGa4Form({
        propertyId: response.data?.ga4?.propertyId || '',
        measurementId: response.data?.ga4?.measurementId || '',
      })
      const empty = emptyPublishingForms()
      setPublishingForms(Object.fromEntries(
        Object.keys(PUBLISHING_META).map(provider => [
          provider,
          response.data?.publishing?.[provider]?.values || empty[provider],
        ])
      ))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [siteId])

  const connectedCount = useMemo(() => {
    if (!data) return 0
    return Number(!!data.gsc?.connected) + Number(!!data.ga4?.connected) + Number(!!data.ahrefs?.connected) +
      Object.values(data.publishing || {}).filter(provider => provider?.connected).length
  }, [data])

  const toggleCard = id => setExpandedCard(current => current === id ? null : id)

  const connectGsc = async () => {
    try {
      const response = await api.get('/auth/gsc')
      const popup = window.open(response.data.url, 'gsc_connect', 'width=560,height=700')
      let settled = false
      const finish = async () => {
        if (settled) return
        settled = true
        popup?.close()
        await load()
      }
      const onMessage = event => {
        if (event.data === 'gsc_connected') {
          window.removeEventListener('message', onMessage)
          finish()
        }
      }
      window.addEventListener('message', onMessage)
      const interval = window.setInterval(async () => {
        try {
          const status = await api.get('/auth/gsc/status')
          if (status?.data?.connected) {
            window.clearInterval(interval)
            window.removeEventListener('message', onMessage)
            await finish()
          }
        } catch { /* transient polling failure */ }
      }, 1000)
      window.setTimeout(() => {
        window.clearInterval(interval)
        window.removeEventListener('message', onMessage)
      }, 20000)
    } catch { toast.error('Failed to start GSC connection') }
  }

  const disconnectGsc = async () => {
    await api.delete('/auth/gsc')
    toast.success('GSC disconnected')
    load()
  }

  const saveGa4 = async () => {
    if (!ga4Form.propertyId.trim()) return toast.error('GA4 Property ID is required')
    setSaving(true)
    try {
      await api.put(`/sites/${siteId}/integrations/ga4`, ga4Form)
      toast.success('GA4 settings saved')
      await load()
    } catch { toast.error('Failed to save GA4 settings') }
    finally { setSaving(false) }
  }

  const disconnectGa4 = async () => {
    await api.delete(`/sites/${siteId}/integrations/ga4`)
    toast.success('GA4 disconnected')
    load()
  }

  const saveManualAhrefs = async () => {
    setSaving(true)
    try {
      await api.post(`/sites/${siteId}/integrations/ahrefs/manual`, manual)
      toast.success('Metrics saved')
      setManual({ dr: '', backlinks: '', refDomains: '', organicTraffic: '', organicKeywords: '' })
      await load()
    } catch { toast.error('Failed to save metrics') }
    finally { setSaving(false) }
  }

  const importCsvAhrefs = async () => {
    if (!csvText.trim()) return toast.error('Paste CSV content first')
    setSaving(true)
    try {
      await api.post(`/sites/${siteId}/integrations/ahrefs/import-csv`, { csvText })
      toast.success('CSV imported')
      setCsvText('')
      await load()
    } catch (error) { toast.error(error.response?.data?.error || 'CSV import failed') }
    finally { setSaving(false) }
  }

  const disconnectAhrefs = async () => {
    await api.delete(`/sites/${siteId}/integrations/ahrefs`)
    toast.success('Ahrefs disconnected')
    load()
  }

  const updatePublishingForm = (provider, key, value) => {
    setPublishingForms(previous => ({
      ...previous,
      [provider]: { ...previous[provider], [key]: value },
    }))
  }

  const savePublishing = async provider => {
    setSaving(true)
    try {
      await api.put(`/sites/${siteId}/integrations/publishing/${provider}`, publishingForms[provider])
      toast.success(`${PUBLISHING_META[provider].label} settings saved`)
      await load()
    } catch (error) { toast.error(error?.response?.data?.error || 'Failed to save integration') }
    finally { setSaving(false) }
  }

  const disconnectPublishing = async provider => {
    setSaving(true)
    try {
      await api.delete(`/sites/${siteId}/integrations/publishing/${provider}`)
      toast.success(`${PUBLISHING_META[provider].label} disconnected`)
      await load()
    } catch { toast.error('Failed to disconnect integration') }
    finally { setSaving(false) }
  }

  const tabs = [
    { id: 'analytics', label: 'Analytics' },
    { id: 'publishing', label: 'Publishing' },
    { id: 'imports', label: 'Imports' },
  ]

  return (
    <main className="integrations-premium-page fade-in">
      <header className="integrations-premium-hero">
        <div className="integrations-premium-heading">
          <PageHeader title="Integrations" subtitle="Connect search data, analytics, and publishing destinations" />
          <button type="button" className="integrations-refresh" onClick={load} disabled={loading}>
            <FontAwesomeIcon icon={faArrowsRotate} /> Refresh
          </button>
        </div>
        <div className="integrations-summary">
          <div><strong>{connectedCount}</strong><span>Connected</span></div>
          <div><strong>9</strong><span>Available</span></div>
          <div><strong>0</strong><span>Needs attention</span></div>
        </div>
      </header>

      <nav className="integrations-tabs" role="tablist" aria-label="Integration type">
        {tabs.map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); setExpandedCard(null) }}>
            {tab.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="integrations-loading">Loading integrations...</div>
      ) : (
        <div className="integrations-premium-grid">
          {activeTab === 'analytics' && (
            <>
              <IntegrationCard id="gsc" icon={faPlug} iconColor={T.blue} title="Google Search Console"
                status={data?.gsc?.connected ? 'Connected' : 'Not connected'} connected={data?.gsc?.connected}
                description="Search clicks, impressions, top queries, and average positions."
                expanded={expandedCard === 'gsc'} onToggle={toggleCard}>
                <div className="integration-actions">
                  {!data?.gsc?.connected
                    ? <Button variant="primary" size="sm" onClick={connectGsc}><FontAwesomeIcon icon={faLink} /> Connect GSC</Button>
                    : <Button variant="ghost" size="sm" onClick={disconnectGsc}>Disconnect</Button>}
                </div>
              </IntegrationCard>

              <IntegrationCard id="ga4" icon={faChartLine} iconColor={T.green} title="Google Analytics 4"
                status={data?.ga4?.connected ? 'Configured' : 'Not configured'} connected={data?.ga4?.connected}
                description="Engagement, traffic, and conversion signals for your SEO workspace."
                expanded={expandedCard === 'ga4'} onToggle={toggleCard}>
                <div className="integration-fields two-columns">
                  <input placeholder="Property ID (required)" value={ga4Form.propertyId} onChange={event => setGa4Form(value => ({ ...value, propertyId: event.target.value }))} />
                  <input placeholder="Measurement ID (optional)" value={ga4Form.measurementId} onChange={event => setGa4Form(value => ({ ...value, measurementId: event.target.value }))} />
                </div>
                <div className="integration-actions"><Button variant="primary" size="sm" onClick={saveGa4} loading={saving}>Save GA4</Button>{data?.ga4?.connected && <Button variant="ghost" size="sm" onClick={disconnectGa4}>Disconnect</Button>}</div>
              </IntegrationCard>

              <IntegrationCard id="ahrefs" icon={faMagnifyingGlassChart} iconColor={T.orange} title="Ahrefs Manual Metrics"
                status={data?.ahrefs?.connected ? 'Connected' : 'Not connected'} connected={data?.ahrefs?.connected}
                description="Add externally tracked authority and backlink metrics."
                expanded={expandedCard === 'ahrefs'} onToggle={toggleCard}>
                <div className="integration-fields metrics-grid">
                  {[
                    ['dr', 'DR'], ['backlinks', 'Backlinks'], ['refDomains', 'Ref Domains'],
                    ['organicTraffic', 'Traffic'], ['organicKeywords', 'Keywords'],
                  ].map(([key, placeholder]) => <input key={key} placeholder={placeholder} value={manual[key]} onChange={event => setManual(value => ({ ...value, [key]: event.target.value }))} />)}
                </div>
                <div className="integration-actions"><Button variant="primary" size="sm" onClick={saveManualAhrefs} loading={saving}>Save metrics</Button>{data?.ahrefs?.connected && <Button variant="ghost" size="sm" onClick={disconnectAhrefs}>Disconnect</Button>}</div>
              </IntegrationCard>
            </>
          )}

          {activeTab === 'publishing' && Object.entries(PUBLISHING_META).map(([provider, meta]) => {
            const providerState = data?.publishing?.[provider]
            return (
              <IntegrationCard key={provider} id={provider} icon={meta.icon} iconColor={meta.color} title={meta.label}
                status={providerState?.connected ? 'Configured' : 'Not configured'} connected={providerState?.connected}
                description={meta.description} expanded={expandedCard === provider} onToggle={toggleCard}>
                <div className="integration-fields">
                  {meta.fields.map(field => <input key={field.key} type={field.type || 'text'} autoComplete="off"
                    placeholder={field.placeholder} value={publishingForms[provider]?.[field.key] || ''}
                    onChange={event => updatePublishingForm(provider, field.key, event.target.value)} />)}
                </div>
                <div className="integration-actions"><Button variant="primary" size="sm" onClick={() => savePublishing(provider)} loading={saving}>Save</Button>{providerState?.connected && <Button variant="ghost" size="sm" onClick={() => disconnectPublishing(provider)}>Disconnect</Button>}</div>
              </IntegrationCard>
            )
          })}

          {activeTab === 'imports' && (
            <IntegrationCard id="csv" icon={faCloudArrowUp} iconColor={T.purple} title="Ahrefs CSV Import"
              status={data?.ahrefs?.latest ? 'Imported' : 'Ready'} connected={!!data?.ahrefs?.latest}
              description="Import Domain Rating, backlinks, referring domains, traffic, and keywords."
              expanded={expandedCard === 'csv'} onToggle={toggleCard}>
              <textarea rows={7} value={csvText} onChange={event => setCsvText(event.target.value)} placeholder={'Domain Rating,Backlinks,Referring Domains,Organic Traffic,Organic Keywords\n22,120,34,890,56'} />
              <div className="integration-actions"><Button variant="secondary" size="sm" onClick={importCsvAhrefs} loading={saving}>Import CSV</Button></div>
              {data?.ahrefs?.latest ? <div className="integration-import-note success"><FontAwesomeIcon icon={faCircleCheck} /> Latest: DR {data.ahrefs.latest.dr} | Backlinks {data.ahrefs.latest.backlinks} | Ref Domains {data.ahrefs.latest.ref_domains}</div>
                : <div className="integration-import-note"><FontAwesomeIcon icon={faTriangleExclamation} /> No Ahrefs metrics imported yet.</div>}
            </IntegrationCard>
          )}
        </div>
      )}
    </main>
  )
}