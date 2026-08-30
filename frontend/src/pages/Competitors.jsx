import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faChevronDown,
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

const domainOnly = value => String(value || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]

export default function Competitors() {
  const { siteId } = useParams()
  const [competitors, setCompetitors] = useState([])
  const [metrics, setMetrics] = useState({ dr: 0 })
  const [site, setSite] = useState(null)
  const [description, setDescription] = useState('')
  const [form, setForm] = useState({ name: '', dr: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [formError, setFormError] = useState('')
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(COMPETITORS_PAGE_FLOW, [loading, competitors.length])

  const yourDr = Number(metrics?.dr || 0)
  const closestGap = useMemo(() => competitors.length
    ? Math.min(...competitors.map(item => Math.abs(Number(item.dr || 0) - yourDr)))
    : null, [competitors, yourDr])

  const load = async () => {
    setLoading(true)
    const [competitorResult, metricResult, siteResult] = await Promise.allSettled([
      api.get(`/sites/${siteId}/competitors`),
      api.get(`/sites/${siteId}/metrics`),
      api.get(`/sites/${siteId}`),
    ])
    if (competitorResult.status === 'fulfilled') setCompetitors(Array.isArray(competitorResult.value.data) ? competitorResult.value.data : [])
    else toast.error(competitorResult.reason?.response?.data?.error || 'Failed to load competitors')
    if (metricResult.status === 'fulfilled') setMetrics(metricResult.value.data || { dr: 0 })
    if (siteResult.status === 'fulfilled') {
      setSite(siteResult.value.data)
      setDescription(siteResult.value.data?.description || '')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [siteId])

  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()

      if (removeTarget) setRemoveTarget(null)
      else if (sheet) setSheet(null)
      else if (expandedId) setExpandedId(null)
    }

    window.addEventListener('keydown', closeOnEscape, true)
    return () => window.removeEventListener('keydown', closeOnEscape, true)
  }, [sheet, removeTarget, expandedId])

  useEffect(() => {
    let active = true
    let backListener

    CapacitorApp.addListener('backButton', () => {
      if (removeTarget) setRemoveTarget(null)
      else if (sheet) setSheet(null)
      else if (expandedId) setExpandedId(null)
    }).then(listener => {
      if (active) backListener = listener
      else listener.remove()
    })

    return () => {
      active = false
      backListener?.remove()
    }
  }, [sheet, removeTarget, expandedId])

  const openSheet = name => {
    setFormError('')
    setSheet(name)
  }

  const add = async () => {
    const domain = domainOnly(form.name)
    if (!domain || !domain.includes('.')) {
      setFormError('Enter a valid domain, for example competitor.com')
      return
    }
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/competitors`, {
        name: domain,
        dr: Math.max(0, Math.min(100, Number.parseInt(form.dr, 10) || 0)),
        notes: form.notes.trim(),
        url: `https://${domain}`,
      })
      setForm({ name: '', dr: '', notes: '' })
      setSheet(null)
      await load()
      toast.success('Competitor added')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to add competitor')
    } finally {
      setAdding(false)
    }
  }

  const saveDescription = async () => {
    if (!description.trim()) return toast.error('Add a short business description')
    setSavingDescription(true)
    try {
      await api.patch(`/sites/${siteId}/description`, { description: description.trim() })
      setSheet(null)
      toast.success('Business niche saved')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to save description')
    } finally {
      setSavingDescription(false)
    }
  }

  const autoDiscover = async () => {
    if (!description.trim()) return openSheet('niche')
    setDiscovering(true)
    try {
      const response = await api.post(`/sites/${siteId}/competitors/auto-discover`, { prune: true })
      await load()
      const inserted = response?.data?.inserted ?? 0
      const updated = response?.data?.updated ?? 0
      const pruned = response?.data?.pruned ?? 0
      const result = [inserted && `${inserted} added`, updated && `${updated} updated`, pruned && `${pruned} removed`].filter(Boolean)
      toast.success(result.length ? `Competitors refreshed: ${result.join(', ')}` : 'Competitors refreshed')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Auto-discover failed')
    } finally {
      setDiscovering(false)
    }
  }

  const remove = async () => {
    if (!removeTarget) return
    try {
      await api.delete(`/sites/${siteId}/competitors/${removeTarget.id}`)
      setRemoveTarget(null)
      await load()
      toast.success('Competitor removed')
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to remove competitor')
    }
  }

  return (
    <div className="competitors-clean fade-in">
      <AppProcessTopBar steps={COMPETITORS_PAGE_FLOW
          .filter(step => ['describe', 'add'].includes(step.id))
          .map(step => ({
        ...step,
        done: step.id === 'add' ? competitors.length > 0 : step.id === 'describe' ? Boolean(description.trim()) : false,
        active: scrollFlowId === step.id,
        onClick: () => {
          setScrollFlowId(step.id)
          document.getElementById(step.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
      }))} />

      <main className="page-content competitors-clean__content">
        <header className="competitors-clean__header">
          <div><h1>Competitors</h1><p>Compare domain authority and focus on your closest search rivals</p></div>
          <button type="button" className="competitors-clean__primary" onClick={() => openSheet('add')}><FontAwesomeIcon icon={faPlus} /><span>Add competitor</span></button>
        </header>

        <section className="competitors-clean__metrics" aria-label="Competitor summary">
          <div><small>Competitors</small><strong>{competitors.length}</strong></div>
          <div><small>Your DR</small><strong>{yourDr}</strong></div>
          <div><small>Closest gap</small><strong>{closestGap == null ? '-' : closestGap === 0 ? 'Tied' : closestGap}</strong></div>
        </section>

        <section className={`competitors-clean__niche ${description.trim() ? 'is-ready' : 'needs-setup'}`} id="comp-section-setup">
          <span className="competitors-clean__niche-icon"><FontAwesomeIcon icon={description.trim() ? faCheck : faWandMagicSparkles} /></span>
          <div><strong>{description.trim() ? 'Business niche configured' : 'Set your business niche'}</strong><p>{description.trim() ? 'Discovery will filter for relevant competitors.' : 'Add a short description before running automatic discovery.'}</p></div>
          <div className="competitors-clean__niche-actions">
            <button type="button" className="competitors-clean__secondary" onClick={() => openSheet('niche')}>{description.trim() ? 'Edit' : 'Set up'}</button>
            {description.trim() && <button type="button" className="competitors-clean__primary" onClick={autoDiscover} disabled={discovering}><FontAwesomeIcon icon={discovering ? faSpinner : faWandMagicSparkles} spin={discovering} />{discovering ? 'Scanning...' : 'Discover'}</button>}
          </div>
        </section>

        <section className="competitors-clean__list" id="comp-section-list">
          <header><div><h2>Comparison</h2><p>Compared with {site?.name || 'your site'} at DR {yourDr}</p></div><span>{competitors.length} tracked</span></header>
          <div className="competitors-clean__columns" aria-hidden="true"><span>Competitor</span><span>DR</span><span>Gap</span><span>Fit</span><span></span></div>

          {loading ? <div className="competitors-clean__empty"><FontAwesomeIcon icon={faSpinner} spin />Loading competitors...</div> : competitors.length === 0 ? <div className="competitors-clean__empty"><strong>No competitors yet</strong><p>Add a domain or use automatic discovery.</p><button type="button" className="competitors-clean__primary" onClick={() => openSheet('add')}>Add competitor</button></div> : competitors.map(competitor => {
            const competitorDr = Number(competitor.dr || 0)
            const difference = competitorDr - yourDr
            const closest = closestGap != null && Math.abs(difference) === closestGap
            const expanded = expandedId === competitor.id
            const fit = closest ? 'Closest rival' : competitor.industry || competitor.location ? 'Verified' : 'Review'
            return <article key={competitor.id} className={`competitors-clean__item ${expanded ? 'is-expanded' : ''}`}>
              <button type="button" className="competitors-clean__row" onClick={() => setExpandedId(expanded ? null : competitor.id)} aria-expanded={expanded}>
                <span className="competitors-clean__domain"><i>{String(competitor.name || 'C')[0].toUpperCase()}</i><span><strong>{competitor.name}</strong><small>{competitor.industry || competitor.location || 'Competitor domain'}</small></span></span>
                <strong className="competitors-clean__dr">{competitorDr}</strong>
                <span className={`competitors-clean__gap ${difference <= 0 ? 'is-leading' : ''}`}>{difference > 0 ? `+${difference}` : difference < 0 ? `-${Math.abs(difference)}` : '0'}</span>
                <span className={`competitors-clean__fit ${closest ? 'is-closest' : ''}`}>{fit}</span>
                <FontAwesomeIcon className="competitors-clean__chevron" icon={faChevronDown} />
              </button>
              {expanded && <div className="competitors-clean__details">
                <div><small>Summary</small><p>{competitor.summary || competitor.notes || competitor.title || 'No additional details available.'}</p></div>
                {(competitor.industry || competitor.location) && <div><small>Classification</small><p>{[competitor.industry, competitor.location].filter(Boolean).join(' - ')}</p></div>}
                <button type="button" className="competitors-clean__remove" onClick={() => setRemoveTarget(competitor)}>Remove competitor</button>
              </div>}
            </article>
          })}
        </section>
      </main>

      {sheet && <div className="competitors-clean__overlay" onMouseDown={event => event.target === event.currentTarget && setSheet(null)}>
        <section className="competitors-clean__sheet" role="dialog" aria-modal="true" aria-labelledby="competitors-sheet-title">
          <span className="competitors-clean__handle" />
          <header><div><h2 id="competitors-sheet-title">{sheet === 'niche' ? 'Business niche' : 'Add competitor'}</h2><p>{sheet === 'niche' ? 'Describe the audience and services that define your market.' : 'Enter the competitor primary domain.'}</p></div><button type="button" aria-label="Close" onClick={() => setSheet(null)}><FontAwesomeIcon icon={faXmark} /></button></header>
          {sheet === 'niche' ? <div className="competitors-clean__form"><label>Business description<textarea rows="5" value={description} onChange={event => setDescription(event.target.value)} placeholder="SEO and web development agency serving businesses in Norway" /></label><button type="button" className="competitors-clean__primary" onClick={saveDescription} disabled={savingDescription}>{savingDescription ? 'Saving...' : 'Save niche'}</button></div> : <div className="competitors-clean__form"><label className={formError ? 'has-error' : ''}>Domain<input value={form.name} inputMode="url" autoCapitalize="none" autoCorrect="off" onChange={event => { setForm(current => ({ ...current, name: event.target.value })); setFormError('') }} placeholder="competitor.com" />{formError && <small>{formError}</small>}</label><label>Domain rating <span>Optional</span><input type="number" min="0" max="100" inputMode="numeric" value={form.dr} onChange={event => setForm(current => ({ ...current, dr: event.target.value }))} placeholder="0 to 100" /></label><label>Notes <span>Optional</span><textarea rows="3" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Why this competitor matters" /></label><button type="button" className="competitors-clean__primary" onClick={add} disabled={adding}>{adding ? 'Adding...' : 'Add competitor'}</button></div>}
        </section>
      </div>}

      {removeTarget && <div className="competitors-clean__overlay" onMouseDown={event => event.target === event.currentTarget && setRemoveTarget(null)}><section className="competitors-clean__confirm" role="alertdialog" aria-modal="true"><span className="competitors-clean__handle" /><h2>Remove competitor?</h2><p>{removeTarget.name} will be removed from this comparison.</p><div><button type="button" className="competitors-clean__secondary" onClick={() => setRemoveTarget(null)}>Cancel</button><button type="button" className="competitors-clean__danger" onClick={remove}>Remove</button></div></section></div>}
    </div>
  )
}