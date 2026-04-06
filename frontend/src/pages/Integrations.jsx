import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlug,
  faChartLine,
  faMagnifyingGlassChart,
  faCloudArrowUp,
  faLink,
  faCircleCheck,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { Card, Button, PageHeader, Badge, T } from '../components/UI'

export default function Integrations() {
  const { siteId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ga4Form, setGa4Form] = useState({ propertyId: '', measurementId: '' })
  const [manual, setManual] = useState({ dr: '', backlinks: '', refDomains: '', organicTraffic: '', organicKeywords: '' })
  const [csvText, setCsvText] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/sites/${siteId}/integrations`)
      setData(r.data)
      setGa4Form({
        propertyId: r.data?.ga4?.propertyId || '',
        measurementId: r.data?.ga4?.measurementId || '',
      })
    } catch {
      setData(null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [siteId])

  const connectGsc = async () => {
    try {
      const r = await api.get('/auth/gsc')
      const popup = window.open(r.data.url, 'gsc_connect', 'width=560,height=700')
      const onMessage = (e) => {
        if (e.data === 'gsc_connected') {
          popup?.close()
          window.removeEventListener('message', onMessage)
          load()
        }
      }
      window.addEventListener('message', onMessage)
    } catch {
      toast.error('Failed to start GSC connection')
    }
  }

  const disconnectGsc = async () => {
    await api.delete('/auth/gsc')
    toast.success('GSC disconnected')
    load()
  }

  const saveGa4 = async () => {
    if (!ga4Form.propertyId.trim()) {
      toast.error('GA4 Property ID is required')
      return
    }
    setSaving(true)
    try {
      await api.put(`/sites/${siteId}/integrations/ga4`, ga4Form)
      toast.success('GA4 settings saved')
      await load()
    } catch {
      toast.error('Failed to save GA4 settings')
    }
    setSaving(false)
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
    } catch {
      toast.error('Failed to save metrics')
    }
    setSaving(false)
  }

  const importCsvAhrefs = async () => {
    if (!csvText.trim()) {
      toast.error('Paste CSV content first')
      return
    }
    setSaving(true)
    try {
      await api.post(`/sites/${siteId}/integrations/ahrefs/import-csv`, { csvText })
      toast.success('CSV imported')
      setCsvText('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'CSV import failed')
    }
    setSaving(false)
  }

  const disconnectAhrefs = async () => {
    await api.delete(`/sites/${siteId}/integrations/ahrefs`)
    toast.success('Ahrefs disconnected')
    load()
  }

  return (
    <div className="fade-in" style={{ padding: '1.25rem 1.5rem' }}>
      <PageHeader title="Integrations" subtitle="Connect GSC, configure GA4, and import Ahrefs metrics for richer recommendations" />

      {loading ? (
        <Card><div style={{ color: T.muted }}>Loading integrations...</div></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faPlug} style={{ color: T.blue }} />
                <strong>Google Search Console</strong>
              </div>
              <Badge variant={data?.gsc?.connected ? 'success' : 'default'}>{data?.gsc?.connected ? 'Connected' : 'Not connected'}</Badge>
            </div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 10 }}>Imports clicks, impressions, top queries, and average positions.</div>
            {!data?.gsc?.connected
              ? <Button variant="primary" size="sm" onClick={connectGsc}><FontAwesomeIcon icon={faLink} style={{ marginRight: 6 }} />Connect GSC</Button>
              : <Button variant="ghost" size="sm" onClick={disconnectGsc}>Disconnect</Button>}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faChartLine} style={{ color: T.green }} />
                <strong>Google Analytics 4</strong>
              </div>
              <Badge variant={data?.ga4?.connected ? 'success' : 'default'}>{data?.ga4?.connected ? 'Configured' : 'Not configured'}</Badge>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <input placeholder="Property ID (required)" value={ga4Form.propertyId} onChange={e => setGa4Form(p => ({ ...p, propertyId: e.target.value }))} />
              <input placeholder="Measurement ID (optional)" value={ga4Form.measurementId} onChange={e => setGa4Form(p => ({ ...p, measurementId: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" size="sm" onClick={saveGa4} loading={saving}>Save GA4</Button>
              {data?.ga4?.connected && <Button variant="ghost" size="sm" onClick={disconnectGa4}>Disconnect</Button>}
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faMagnifyingGlassChart} style={{ color: T.orange }} />
                <strong>Ahrefs Manual Metrics</strong>
              </div>
              <Badge variant={data?.ahrefs?.connected ? 'success' : 'default'}>{data?.ahrefs?.connected ? 'Connected' : 'Not connected'}</Badge>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
              <input placeholder="DR" value={manual.dr} onChange={e => setManual(p => ({ ...p, dr: e.target.value }))} />
              <input placeholder="Backlinks" value={manual.backlinks} onChange={e => setManual(p => ({ ...p, backlinks: e.target.value }))} />
              <input placeholder="Ref Domains" value={manual.refDomains} onChange={e => setManual(p => ({ ...p, refDomains: e.target.value }))} />
              <input placeholder="Traffic" value={manual.organicTraffic} onChange={e => setManual(p => ({ ...p, organicTraffic: e.target.value }))} />
              <input placeholder="Keywords" value={manual.organicKeywords} onChange={e => setManual(p => ({ ...p, organicKeywords: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Button variant="primary" size="sm" onClick={saveManualAhrefs} loading={saving}>Save Metrics</Button>
              {data?.ahrefs?.connected && <Button variant="ghost" size="sm" onClick={disconnectAhrefs}>Disconnect</Button>}
            </div>
            <div style={{ color: T.muted, fontSize: 12 }}>Tip: Use this if you track Ahrefs data externally.</div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <FontAwesomeIcon icon={faCloudArrowUp} style={{ color: T.purple }} />
              <strong>Ahrefs CSV Import</strong>
            </div>
            <div style={{ color: T.muted, fontSize: 13, marginBottom: 8 }}>
              Paste CSV content containing columns like Domain Rating, Backlinks, Referring Domains, Organic Traffic, Organic Keywords.
            </div>
            <textarea rows={7} value={csvText} onChange={e => setCsvText(e.target.value)} placeholder="Domain Rating,Backlinks,Referring Domains,Organic Traffic,Organic Keywords\n22,120,34,890,56" />
            <div style={{ marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={importCsvAhrefs} loading={saving}>Import CSV</Button>
            </div>
            {data?.ahrefs?.latest && (
              <div style={{ marginTop: 10, fontSize: 12, color: T.text2 }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ color: T.green, marginRight: 6 }} />
                Latest: DR {data.ahrefs.latest.dr} • Backlinks {data.ahrefs.latest.backlinks} • Ref Domains {data.ahrefs.latest.ref_domains}
              </div>
            )}
            {!data?.ahrefs?.latest && (
              <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>
                <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />No Ahrefs metrics imported yet.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
