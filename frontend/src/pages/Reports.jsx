import { useEffect, useMemo, useState } from 'react'
import './Reports.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine, faFileCirclePlus, faFileLines, faDownload, faShareNodes,
  faTrash, faMagnifyingGlass, faEllipsisVertical, faXmark, faCheckCircle,
  faFolderOpen, faKey, faLink, faHeartPulse, faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import AppSidebar from '../components/AppSidebar'

const TYPES = {
  complete: { label: 'Complete SEO', description: 'Health, keywords, backlinks and recent activity  |  Recommended' },
  executive: { label: 'Executive summary', description: 'A concise client-ready performance overview' },
  technical: { label: 'Technical overview', description: 'Health score and technical activity summary' },
}

const formatDate = value => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

function reportHtml(report) {
  const data = report.snapshot || {}
  const activity = (data.recent || []).map(item => `
    <tr><td>${item.name || '-'}</td><td>${item.type || '-'}</td><td>${item.message || '-'}</td></tr>
  `).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${report.name}</title><style>
    body{font-family:Arial,sans-serif;color:#172033;margin:42px}h1{margin-bottom:4px}.muted{color:#718096}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:28px 0}.stat{border:1px solid #dfe5ef;border-radius:12px;padding:16px}.stat strong{display:block;font-size:26px;margin-top:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:10px;text-align:left;border-bottom:1px solid #e8edf4;font-size:13px}th{color:#64748b}
    @media print{button{display:none}}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}}
  </style></head><body><h1>${report.name}</h1><div class="muted">${TYPES[report.reportType]?.label || 'SEO report'}  |  Generated ${formatDate(report.createdAt)}</div>
  <div class="grid"><div class="stat">Projects<strong>${data.projects || 0}</strong></div><div class="stat">Average health<strong>${data.avgHealth || 0}%</strong></div><div class="stat">Keywords<strong>${data.keywords || 0}</strong></div><div class="stat">Backlinks<strong>${data.backlinks || 0}</strong></div></div>
  <h2>Recent activity</h2><table><thead><tr><th>Project</th><th>Type</th><th>Update</th></tr></thead><tbody>${activity || '<tr><td colspan="3">No recent activity</td></tr>'}</tbody></table>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))<\/script></body></html>`
}

export default function Reports() {
  const [summary, setSummary] = useState({ projects: 0, keywords: 0, backlinks: 0, avgHealth: 0, reports: 0 })
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [actionsReport, setActionsReport] = useState(null)
  const [reportType, setReportType] = useState('portfolio')
  const [reportName, setReportName] = useState('')
  const [error, setError] = useState('')
  const [context, setContext] = useState({ isAdmin: false, sites: [] })
  const [scope, setScope] = useState('site')
  const [siteId, setSiteId] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryResponse, reportsResponse, contextResponse] = await Promise.all([
        api.get('/reports/summary'), api.get('/reports/list'), api.get('/reports/context'),
      ])
      setSummary(summaryResponse.data)
      setReports(Array.isArray(reportsResponse.data) ? reportsResponse.data : [])
      setContext(contextResponse.data || { isAdmin: false, sites: [] })
      const firstSite = contextResponse.data?.sites?.[0]?.id
      if (firstSite) setSiteId(String(firstSite))
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not load reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => reports.filter(report => {
    const matchesQuery = !query.trim() || report.name.toLowerCase().includes(query.trim().toLowerCase())
    const matchesStatus = status === 'all' || report.status === status
    return matchesQuery && matchesStatus
  }), [reports, query, status])

  const openCreate = () => {
    const selected = context.sites.find(site => String(site.id) === String(siteId))
    setReportName(`${selected?.name || 'SEO'} Report - ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}`)
    setReportType('complete')
    setScope(context.isAdmin ? scope : 'site')
    setCreateOpen(true)
  }

  const generate = async () => {
    if (!reportName.trim() || ((scope === 'site' || !context.isAdmin) && !siteId)) return
    setGenerating(true)
    setError('')
    try {
      const { data } = await api.post('/reports/generate', { name: reportName.trim(), reportType, scope: context.isAdmin ? scope : 'site', siteId: scope === 'site' || !context.isAdmin ? Number(siteId) : null })
      setReports(current => [data, ...current])
      setSummary(current => ({ ...current, reports: Number(current.reports || 0) + 1 }))
      setCreateOpen(false)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not generate report.')
    } finally {
      setGenerating(false)
    }
  }

  const download = report => {
    const popup = window.open('', '_blank')
    if (!popup) return setError('Allow pop-ups to download the report as PDF.')
    popup.opener = null
    popup.document.open()
    popup.document.write(reportHtml(report))
    popup.document.close()
    setActionsReport(null)
  }

  const share = async report => {
    const text = `${report.name}\nProjects: ${report.snapshot?.projects || 0}  |  Health: ${report.snapshot?.avgHealth || 0}%  |  Keywords: ${report.snapshot?.keywords || 0}  |  Backlinks: ${report.snapshot?.backlinks || 0}`
    try {
      if (navigator.share) await navigator.share({ title: report.name, text })
      else {
        await navigator.clipboard.writeText(text)
        setError('Report summary copied to clipboard.')
      }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') setError('Could not share this report.')
    }
    setActionsReport(null)
  }

  const remove = async report => {
    if (!window.confirm(`Delete "${report.name}"?`)) return
    try {
      await api.delete(`/reports/${report.id}`)
      setReports(current => current.filter(item => item.id !== report.id))
      setSummary(current => ({ ...current, reports: Math.max(0, Number(current.reports || 1) - 1) }))
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not delete report.')
    }
    setActionsReport(null)
  }

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <div className="topbar"><span className="topbar__title">Reports</span></div>
        <main className="page-content fade-in reports-page reports-manager">
          <header className="reports-manager__header">
            <div><h1>Reports</h1><p>Create, download and share client-ready SEO reports.</p></div>
            <button type="button" className="reports-primary" onClick={openCreate}><FontAwesomeIcon icon={faFileCirclePlus} /> Generate report</button>
          </header>

          {error && <button type="button" className="reports-notice" onClick={() => setError('')}>{error}<FontAwesomeIcon icon={faXmark} /></button>}

          <section className="reports-manager__stats" aria-label="Reports overview">
            <article><span><FontAwesomeIcon icon={faFileLines} /> Generated reports</span><strong>{loading ? '-' : summary.reports || reports.length}</strong><small>Saved and ready to share</small></article>
            <article><span><FontAwesomeIcon icon={faFolderOpen} /> Projects</span><strong>{loading ? '-' : summary.projects}</strong><small>Included in portfolio reports</small></article>
            <article><span><FontAwesomeIcon icon={faKey} /> Tracked keywords</span><strong>{loading ? '-' : summary.keywords}</strong><small>Across your projects</small></article>
            <article><span><FontAwesomeIcon icon={faHeartPulse} /> Average health</span><strong>{loading ? '-' : `${summary.avgHealth}%`}</strong><small>{summary.backlinks || 0} backlinks monitored</small></article>
          </section>

          <section className="reports-manager__workspace">
            <div className="reports-manager__toolbar">
              <label className="reports-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reports..." /></label>
              <select value={status} onChange={event => setStatus(event.target.value)} aria-label="Report status"><option value="all">All statuses</option><option value="ready">Ready</option></select>
            </div>
            <div className="reports-manager__tabs"><button className="is-active">All reports <span>{reports.length}</span></button><button onClick={openCreate}>Templates <span>3</span></button></div>

            {loading ? <div className="reports-empty"><FontAwesomeIcon icon={faSpinner} spin /> Loading reports...</div> : filtered.length === 0 ? (
              <div className="reports-empty"><FontAwesomeIcon icon={faFileLines} /><h2>{reports.length ? 'No matching reports' : 'Create your first report'}</h2><p>Generate a real snapshot from your current SEO portfolio.</p><button className="reports-primary" onClick={openCreate}>Generate report</button></div>
            ) : (
              <div className="reports-list">
                <div className="reports-list__head"><span>Report</span><span>Type</span><span>Status</span><span>Generated</span><span>Actions</span></div>
                {filtered.map(report => <article className="reports-row" key={report.id}>
                  <div className="reports-row__name"><span className="reports-row__icon"><FontAwesomeIcon icon={faChartLine} /></span><div><strong>{report.name}</strong><small>{report.snapshot?.subject?.name || `${report.snapshot?.projects || 0} projects`}  |  {report.snapshot?.keywords || 0} keywords  |  {report.snapshot?.backlinks || 0} backlinks</small></div></div>
                  <div data-label="Type">{TYPES[report.reportType]?.label || 'Complete SEO'}</div>
                  <div data-label="Status"><span className="reports-status"><FontAwesomeIcon icon={faCheckCircle} /> Ready</span></div>
                  <div data-label="Generated"><strong>{formatDate(report.createdAt)}</strong></div>
                  <div className="reports-row__actions"><button onClick={() => download(report)} aria-label="Download report"><FontAwesomeIcon icon={faDownload} /></button><button onClick={() => share(report)} aria-label="Share report"><FontAwesomeIcon icon={faShareNodes} /></button><button className="reports-more" onClick={() => setActionsReport(report)} aria-label="More report actions"><FontAwesomeIcon icon={faEllipsisVertical} /></button></div>
                </article>)}
              </div>
            )}
          </section>
        </main>
      </div>

      {createOpen && <div className="reports-sheet-overlay"><section className="reports-sheet reports-generate-sheet" role="dialog" aria-modal="true" aria-label="Generate report"><div className="reports-sheet__handle" /><header><div><h2>Generate report</h2><p>{context.isAdmin ? 'Choose one project or create an all-project portfolio snapshot.' : 'Create a secure report from a project you can access.'}</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>
  {context.isAdmin && <div className="reports-scope"><button type="button" className={scope === 'site' ? 'is-selected' : ''} onClick={() => setScope('site')}>Single project</button><button type="button" className={scope === 'portfolio' ? 'is-selected' : ''} onClick={() => setScope('portfolio')}>All projects</button></div>}
  {(scope === 'site' || !context.isAdmin) && <label>Project<select value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Select a project</option>{context.sites.map(site => <option key={site.id} value={site.id}>{site.name}  |  {site.url}</option>)}</select></label>}
  {!context.isAdmin && <p className="reports-permission-note">Only projects assigned to your account are available.</p>}
  <label>Report name<input value={reportName} onChange={event => setReportName(event.target.value)} maxLength={180} /></label>
  <div className="reports-template-grid">{Object.entries(TYPES).map(([value,type]) => <button type="button" key={value} className={reportType === value ? 'is-selected' : ''} onClick={() => setReportType(value)}><FontAwesomeIcon icon={value === 'technical' ? faHeartPulse : value === 'executive' ? faFileLines : faChartLine} /><strong>{type.label}</strong><span>{type.description}</span></button>)}</div>
  <div className="reports-sheet__footer"><button type="button" className="reports-cancel" onClick={() => setCreateOpen(false)}>Cancel</button><button type="button" className="reports-primary reports-sheet__submit" disabled={generating || !reportName.trim() || ((scope === 'site' || !context.isAdmin) && !siteId)} onClick={generate}>{generating ? <><FontAwesomeIcon icon={faSpinner} spin /> Generating...</> : <><FontAwesomeIcon icon={faFileCirclePlus} /> Generate report</>}</button></div>
</section></div>}

      {actionsReport && <div className="reports-sheet-overlay"><section className="reports-sheet reports-actions-sheet" role="dialog" aria-modal="true" aria-label="Report actions"><div className="reports-sheet__handle" /><header><div><h2>{actionsReport.name}</h2><p>Choose an action</p></div><button onClick={() => setActionsReport(null)} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header><button onClick={() => download(actionsReport)}><FontAwesomeIcon icon={faDownload} /> Download / print PDF</button><button onClick={() => share(actionsReport)}><FontAwesomeIcon icon={faShareNodes} /> Share summary</button><button className="is-danger" onClick={() => remove(actionsReport)}><FontAwesomeIcon icon={faTrash} /> Delete report</button></section></div>}
    </div>
  )
}



