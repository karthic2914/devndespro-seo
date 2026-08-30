import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faCheck,
  faChevronRight,
  faPlus,
  faSpinner,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import AppProcessTopBar from '../components/AppProcessTopBar'
import { COMPETITORS_PAGE_FLOW } from '../constants/pageFlows'
import useProcessScrollSpy from '../hooks/useProcessScrollSpy'
import api from '../utils/api'
import toast from '../utils/toast'
import '../styles/app/12-competitors.css'

const cleanDomain = (value = '') => String(value).trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]

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
  const [site, setSite] = useState(null)
  const [panel, setPanel] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null)
  const [formError, setFormError] = useState('')
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(COMPETITORS_PAGE_FLOW, [loading, competitors.length])

  const yourDr = Number(metrics?.dr || 0)
  const closestGap = useMemo(() => {
    if (!competitors.length) return null
    return Math.min(...competitors.map(item => Math.abs(Number(item.dr || 0) - yourDr)))
  }, [competitors, yourDr])

  const load = async () => {
    setLoading(true)
    const [competitorsResult, metricsResult, siteResult] = await Promise.allSettled([
      api.get(`/sites/${siteId}/competitors`),
      api.get(`/sites/${siteId}/metrics`),
      api.get(`/sites/${siteId}`),
    ])
    if (competitorsResult.status === 'fulfilled') setCompetitors(Array.isArray(competitorsResult.value.data) ? competitorsResult.value.data : [])
    else toast.error(competitorsResult.reason?.response?.data?.error || 'Failed to load competitors')
    if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value.data || { dr: 0 })
    if (siteResult.status === 'fulfilled') {
      setSite(siteResult.value.data)
      setDescription(siteResult.value.data?.description || '')
    }
    setLoading(false)
  }

  useEffect(() => {
    const stored = localStorage.getItem('activeSite')
    if (stored) {
      try { setSite(JSON.parse(stored)) } catch { /* ignore invalid cached project */ }
    }
    load()
  }, [siteId])

  useEffect(() => {
    if (!panel && !pendingRemove) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPanel(null)
        setPendingRemove(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [panel, pendingRemove])

  const add = async () => {
    const domain = cleanDomain(form.name)
    if (!domain || !domain.includes('.')) {
      setFormError('Enter a valid competitor domain')
      return
    }
    setAdding(true)
    setFormError('')
    try {
      await api.post(`/sites/${siteId}/competitors`, {
        name: domain,
        dr: Math.max(0, Math.min(100, Number.parseInt(form.dr, 10) || 0)),
        notes: form.notes.trim(),
        url: `https://${domain}`,
      })
      setForm({ name: '', dr: '', notes: '' })
      setPanel(null)
      await load()
      toast.success('Competitor added')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to add competitor')
    } finally {
      setAdding(false)
    }
  }

  const autoDiscover = async () => {
    setDiscovering(true)
    try {
      const response = await api.post(`/sites/${siteId}/competitors/auto-discover`, { prune: true })
      await load()
      const inserted = response?.data?.inserted ?? 0
      const pruned = response?.data?.pruned ?? 0
      const updated = response?.data?.updated ?? 0
      const changes = []
      if (inserted) changes.push(`added ${inserted}`)
      if (updated) changes.push(`updated ${updated}`)
      if (pruned) changes.push(`removed ${pruned} off-niche`)
      toast.success(changes.length ? `Competitors refreshed (${changes.join(', ')})` : 'Competitors refreshed')
      if (response?.data?.tip) toast(response.data.tip)
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Auto-discover failed')
      if (error?.response?.data?.tip) toast(error.response.data.tip)
    } finally {
      setDiscovering(false)
    }
  }

  const saveDescription = async () => {
    if (!description.trim()) return toast.error('Add a short business description')
    setSavingDescription(true)
    try {
      await api.patch(`/sites/${siteId}/description`, { description: description.trim() })
      setPanel(null)
      toast.success('Business niche saved')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to save description')
    } finally {
      setSavingDescription(false)
    }
  }

  const remove = async () => {
    if (!pendingRemove) return
    try {
      await api.delete(`/sites/${siteId}/competitors/${pendingRemove.id}`)
      setPendingRemove(null)
      await load()
      toast.success('Competitor removed')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to remove competitor')
    }
  }

  const openPanel = name => {
    setFormError('')
    setPanel(name)
  }

  return (
    <div className="competitors-premium fade-in">
      <AppProcessTopBar
        steps={COMPETITORS_PAGE_FLOW.map(step => ({
          ...step,
          done: step.id === 'add' ? competitors.length > 0 : step.id === 'describe' ? Boolean(description.trim()) : false,
          active: scrollFlowId === step.id,
          onClick: () => {
            setScrollFlowId(step.id)
            document.getElementById(step.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          },
        }))}
      />

      <main className="page-content competitors-premium__content">
        <header className="competitors-premium__header">
          <div className="competitors-premium__title">
            <span><FontAwesomeIcon icon={faChartLine} /></span>
            <div><h1>Competitor intelligence</h1><p>See who is ahead, where the gap is closing, and who deserves attention</p></div>
          </div>
          <button type="button" className="competitors-premium__primary competitors-premium__desktop-add" onClick={() => openPanel('add')}><FontAwesomeIcon icon={faPlus} /> Add competitor</button>
        </header>

        <section className="competitors-premium__stats" aria-label="Competitor overview">
          <article><small>Tracked rivals</small><strong>{competitors.length}</strong><span>in your workspace</span></article>
          <article><small>Your authority</small><strong>DR {yourDr}</strong><span>current domain rating</span></article>
          <article><small>Closest gap</small><strong>{closestGap == null ? 'â€”' : closestGap === 0 ? 'Tied' : `Â±${closestGap}`}</strong><span>nearest competitor</span></article>
        </section>

        <section className="competitors-premium__setup" id="comp-section-setup">
          <div className="competitors-premium__setup-icon"><FontAwesomeIcon icon={description.trim() ? faCheck : faWandMagicSparkles} /></div>
          <div><strong>{description.trim() ? 'Smart discovery ready' : 'Define your niche first'}</strong><p>{description.trim() ? 'Your niche is defined and ready for relevant competitor discovery.' : 'A short description keeps unrelated domains out of your results.'}</p></div>
          <div className="competitors-premium__setup-actions">
            <button type="button" className="competitors-premium__secondary" onClick={() => openPanel('niche')}>{description.trim() ? 'Edit niche' : 'Define niche'}</button>
            <button type="button" className="competitors-premium__primary" onClick={autoDiscover} disabled={discovering || !description.trim()}><FontAwesomeIcon icon={discovering ? faSpinner : faWandMagicSparkles} spin={discovering} /> {discovering ? 'Discoveringâ€¦' : 'Discover rivals'}</button>
          </div>
        </section>

        <section className="competitors-premium__list" id="comp-section-list">
          <header><div><h2>Competitive landscape</h2><p>Domain authority compared with your site</p></div><span>{competitors.length} tracked</span></header>
          <div className="competitors-premium__columns" aria-hidden="true"><span>Domain</span><span>Authority</span><span>Gap vs you</span><span></span></div>

          <article className="competitors-premium__row competitors-premium__row--you">
            <div className="competitors-premium__brand"><span className="competitors-premium__avatar">{site?.name?.[0]?.toUpperCase() || 'Y'}</span><div><strong>{site?.name || 'Your site'}</strong><small>{site?.url || 'Active project'}</small><em>You</em></div></div>
            <div className="competitors-premium__authority"><strong>DR {yourDr}</strong><small>Authority strength</small><div><span style={{ width: `${Math.max(3, Math.min(100, yourDr))}%` }} /></div></div>
            <span className="competitors-premium__gap competitors-premium__gap--you">Baseline</span><span />
          </article>

          {loading ? <div className="competitors-premium__empty"><FontAwesomeIcon icon={faSpinner} spin /> Loading competitorsâ€¦</div> : competitors.length === 0 ? (
            <div className="competitors-premium__empty"><FontAwesomeIcon icon={faWandMagicSparkles} /><strong>No competitors tracked</strong><p>Add one manually or discover relevant rivals automatically.</p><button type="button" className="competitors-premium__primary" onClick={() => openPanel('add')}>Add competitor</button></div>
          ) : competitors.map(competitor => {
            const competitorDr = Number(competitor.dr || 0)
            const difference = competitorDr - yourDr
            const closest = closestGap != null && Math.abs(difference) === closestGap
            return (
              <article key={competitor.id} className={`competitors-premium__row ${closest ? 'competitors-premium__row--closest' : ''}`}>
                <div className="competitors-premium__brand"><span className="competitors-premium__avatar">{String(competitor.name || 'C')[0].toUpperCase()}</span><div><strong>{competitor.name}</strong><small>{competitor.summary || competitor.notes || competitor.title || 'Competitor candidate'}</small><em>{closest ? 'Closest rival' : competitor.industry || competitor.location ? 'Verified niche fit' : 'Review fit'}</em></div></div>
                <div className="competitors-premium__authority"><strong>DR {competitorDr}</strong><small>Authority strength</small><div><span style={{ width: `${Math.max(3, Math.min(100, competitorDr))}%` }} /></div></div>
                <span className={`competitors-premium__gap ${difference <= 0 ? 'competitors-premium__gap--lead' : ''}`}>{difference > 0 ? `${difference} ahead` : difference < 0 ? `You lead by ${Math.abs(difference)}` : 'Tied'}</span>
                <button type="button" className="competitors-premium__remove" aria-label={`Remove ${competitor.name}`} onClick={() => setPendingRemove(competitor)}><FontAwesomeIcon icon={faXmark} /></button>
              </article>
            )
          })}
        </section>

        <button type="button" className="competitors-premium__mobile-add" onClick={() => openPanel('add')}><FontAwesomeIcon icon={faPlus} /><span>Add competitor</span></button>
      </main>

      {discovering && <div className="competitors-premium__loading" role="status"><div><FontAwesomeIcon icon={faSpinner} spin /><strong>Discovering relevant rivals</strong><p>Checking rankings, backlinks and niche relevanceâ€¦</p></div></div>}

      {panel && <div className="competitors-premium__sheet-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && setPanel(null)}>
        <section className="competitors-premium__sheet" role="dialog" aria-modal="true" aria-labelledby="competitors-sheet-title">
          <div className="competitors-premium__sheet-handle" />
          <header><div><h2 id="competitors-sheet-title">{panel === 'niche' ? 'Business niche' : 'Add competitor'}</h2><p>{panel === 'niche' ? 'Help discovery find businesses competing for the same audience.' : 'Track a competitor using its primary domain.'}</p></div><button type="button" aria-label="Close" onClick={() => setPanel(null)}><FontAwesomeIcon icon={faXmark} /></button></header>
          {panel === 'niche' ? <div className="competitors-premium__form"><label>Business description<textarea rows="5" value={description} onChange={event => setDescription(event.target.value)} placeholder="Web design, development and SEO agency serving businesses in Norway" /></label><button type="button" className="competitors-premium__primary" onClick={saveDescription} disabled={savingDescription}>{savingDescription ? 'Savingâ€¦' : 'Save niche'}</button></div> : <div className="competitors-premium__form"><label className={formError ? 'has-error' : ''}>Competitor domain<input inputMode="url" autoCapitalize="none" autoCorrect="off" value={form.name} onChange={event => { setForm(current => ({ ...current, name: event.target.value })); setFormError('') }} placeholder="competitor.com" />{formError && <small>{formError}</small>}</label><label>Domain rating <span>(optional)</span><input type="number" min="0" max="100" inputMode="numeric" value={form.dr} onChange={event => setForm(current => ({ ...current, dr: event.target.value }))} placeholder="0â€“100" /></label><label>Internal notes <span>(optional)</span><textarea rows="3" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Why this competitor matters" /></label><button type="button" className="competitors-premium__primary" onClick={add} disabled={adding}>{adding ? 'Addingâ€¦' : 'Add competitor'}</button></div>}
        </section>
      </div>}

      {pendingRemove && <div className="competitors-premium__sheet-layer" role="presentation" onMouseDown={event => event.target === event.currentTarget && setPendingRemove(null)}><section className="competitors-premium__confirm" role="alertdialog" aria-modal="true" aria-labelledby="remove-competitor-title"><div className="competitors-premium__sheet-handle" /><h2 id="remove-competitor-title">Remove competitor?</h2><p><strong>{pendingRemove.name}</strong> will be removed from this comparison.</p><div><button type="button" className="competitors-premium__secondary" onClick={() => setPendingRemove(null)}>Cancel</button><button type="button" className="competitors-premium__danger" onClick={remove}>Remove</button></div></section></div>}
    </div>
  )
}