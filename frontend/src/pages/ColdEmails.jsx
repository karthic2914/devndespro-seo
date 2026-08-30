import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPaperPlane,
  faTrash,
  faChevronDown,
  faChevronRight,
  faCheck,
  faClock,
  faEnvelope,
  faPenToSquare,
  faReply,
  faUsers,
  faXmark,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import useAdminSettings from '../hooks/useAdminSettings'
import toast from '../utils/toast'
import api from '../utils/api'
import '../styles/app/11-cold-emails.css'

const STATUS_OPTIONS = [
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'interested', label: 'Interested' },
  { value: 'not-interested', label: 'Not interested' },
  { value: 'bounced', label: 'Bounced' },
]

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function toCapitalizedName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
}

function defaultForm() {
  return {
    name: '', email: '', company: '', website: '', status: 'sent',
    sentAt: new Date().toISOString().slice(0, 10), subject: '', message: '', notes: '',
  }
}

function defaultSubject(name) {
  const safeName = String(name || '').trim()
  return safeName ? `Quick SEO suggestions for ${safeName}` : 'Quick SEO suggestions for your website'
}

function defaultMessage(name, website) {
  const safeWebsite = String(website || '').trim()
  return [
    'Hi,', '',
    safeWebsite
      ? `I came across your website (${safeWebsite}) and had a quick look.`
      : 'I came across your website and had a quick look.',
    '', 'I noticed a few opportunities that could improve its visibility in Google and AI search.',
    '', 'I ran a quick check using my tool and would be happy to share a short report.',
    '', 'https://www.seo.devndespro.com', '', 'Regards,', 'www.devndespro.com',
  ].join('\n')
}

function followupMessage(website) {
  return [
    'Hi,', '',
    website ? `Following up on my previous note about ${website}.` : 'Following up on my previous note about your website.',
    '', 'If helpful, I can share a quick SEO report with practical fixes.',
    '', 'Regards,', 'www.devndespro.com',
  ].join('\n')
}

function SelectSheet({ open, title, options, value, onSelect, onClose }) {
  if (!open) return null
  return createPortal(
    <div className="cex-sheet-layer" role="presentation" onClick={onClose}>
      <section className="cex-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <div className="cex-sheet-handle" />
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>
        <div className="cex-sheet-options">
          {options.map(option => (
            <button type="button" key={option.value} className={String(value) === String(option.value) ? 'is-selected' : ''} onClick={() => { onSelect(option.value); onClose() }}>
              <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              <span className="cex-radio">{String(value) === String(option.value) && <span />}</span>
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body
  )
}

export default function ColdEmails() {
  const location = useLocation()
  const { settings, loading: settingsLoading } = useAdminSettings()
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [draftId, setDraftId] = useState(null)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [composeMode, setComposeMode] = useState('first')
  const [activeTab, setActiveTab] = useState('compose')
  const [form, setForm] = useState(defaultForm)
  const [formErrors, setFormErrors] = useState({})
  const [draftState, setDraftState] = useState('saved')
  const [projectSheetOpen, setProjectSheetOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const pendingRows = useMemo(() => rows.filter(row => String(row.status || '').toLowerCase() === 'draft'), [rows])
  const sentRows = useMemo(() => rows.filter(row => String(row.status || '').toLowerCase() !== 'draft'), [rows])
  const repliedCount = sentRows.filter(row => ['replied', 'interested'].includes(String(row.status || '').toLowerCase())).length
  const followupCount = sentRows.filter(row => String(row.status || '').toLowerCase() === 'follow-up').length
  const selectedProject = projects.find(project => String(project.id) === String(selectedSiteId))

  const updateForm = patch => {
    setForm(previous => ({ ...previous, ...patch }))
    setFormErrors(previous => {
      const next = { ...previous }
      Object.keys(patch).forEach(key => delete next[key])
      return next
    })
    setDraftState('saving')
  }

  useEffect(() => {
    if (draftState !== 'saving') return undefined
    const timer = window.setTimeout(() => {
      localStorage.setItem('devndespro-cold-email-draft', JSON.stringify({ form, selectedSiteId, draftId, composeMode }))
      setDraftState('saved')
    }, 600)
    return () => window.clearTimeout(timer)
  }, [form, selectedSiteId, draftId, composeMode, draftState])

  useEffect(() => {
    const draft = location.state
    if (!draft?.draftSubject && !draft?.draftBody) return
    setForm(previous => ({
      ...previous,
      company: draft.draftToHint || previous.company,
      subject: draft.draftSubject || previous.subject,
      message: draft.draftBody || previous.message,
      notes: draft.draftToHint ? `AI media outreach: ${draft.draftToHint}` : previous.notes,
    }))
    setActiveTab('compose')
  }, [location.state])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let listener
    let cancelled = false
    CapacitorApp.addListener('backButton', () => {
      if (projectSheetOpen) setProjectSheetOpen(false)
      else if (reviewOpen) setReviewOpen(false)
      else document.activeElement?.blur?.()
    }).then(result => { if (cancelled) result.remove(); else listener = result })
    return () => { cancelled = true; listener?.remove() }
  }, [projectSheetOpen, reviewOpen])

  const resetComposer = (siteId = '') => {
    setDraftId(null)
    setComposeMode('first')
    setSelectedSiteId(siteId ? String(siteId) : '')
    setForm(defaultForm())
    setFormErrors({})
    setActiveTab('compose')
  }

  const openDraftInComposer = draft => {
    setDraftId(draft.id)
    setComposeMode('first')
    setSelectedSiteId(String(draft.site_id))
    setForm({
      name: draft.name || '', email: draft.email || '', company: draft.company || '',
      website: draft.website || draft.site_url || '', status: 'sent',
      sentAt: new Date().toISOString().slice(0, 10),
      subject: defaultSubject(draft.name),
      message: defaultMessage(draft.name, draft.website || draft.site_url), notes: draft.notes || '',
    })
    setActiveTab('compose')
  }

  const openFollowupInComposer = row => {
    setDraftId(row.id)
    setComposeMode('followup')
    setSelectedSiteId(String(row.site_id))
    setForm({
      name: row.name || '', email: row.email || '', company: row.company || '',
      website: row.website || row.site_url || '', status: 'follow-up',
      sentAt: new Date().toISOString().slice(0, 10),
      subject: `Following up: SEO report for ${row.name || 'your website'}`,
      message: followupMessage(row.website || row.site_url), notes: row.notes || '',
    })
    setActiveTab('compose')
  }

  const load = async () => {
    setLoading(true)
    try {
      const [prospectsResponse, projectsResponse] = await Promise.all([api.get('/sites/cold-emails'), api.get('/sites')])
      const list = Array.isArray(prospectsResponse?.data) ? prospectsResponse.data : []
      const sites = Array.isArray(projectsResponse?.data) ? projectsResponse.data : []
      setRows(list)
      setProjects(sites)
      const draft = list.find(row => String(row.status || '').toLowerCase() === 'draft')
      if (draft) openDraftInComposer(draft)
      else resetComposer(sites[0]?.id || '')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load cold email data')
      setRows([])
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const validateComposer = () => {
    const errors = {}
    if (!selectedSiteId) errors.project = 'Choose a project'
    if (!form.name.trim()) errors.name = 'Enter a contact name'
    if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address'
    if (!form.subject.trim()) errors.subject = 'Enter an email subject'
    if (!form.message.trim()) errors.message = 'Enter an email message'
    setFormErrors(errors)
    if (Object.keys(errors).length) {
      toast.error('Check the highlighted fields')
      return false
    }
    return true
  }

  const openReview = () => {
    if (!settings.cold_emails_enabled) return toast.error('Cold email sending is disabled by admin')
    if (validateComposer()) setReviewOpen(true)
  }

  const confirmSend = async () => {
    setSending(true)
    try {
      const payload = {
        siteId: Number(selectedSiteId), name: toCapitalizedName(form.name).trim(), email: form.email.trim().toLowerCase(),
        company: form.company.trim(), website: form.website.trim(),
        status: composeMode === 'followup' ? 'follow-up' : 'sent', sentAt: form.sentAt, notes: form.notes,
      }
      if (draftId) await api.put(`/sites/cold-emails/${draftId}`, payload)
      else await api.post('/sites/cold-emails', payload)
      const mailto = `mailto:${encodeURIComponent(payload.email)}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.message)}`
      setReviewOpen(false)
      window.location.href = mailto
      await load()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to prepare email')
    } finally {
      setSending(false)
    }
  }

  const saveLocalDraft = () => {
    localStorage.setItem('devndespro-cold-email-draft', JSON.stringify({ form, selectedSiteId, draftId, composeMode }))
    setDraftState('saved')
    toast.success('Draft saved')
  }

  const updateRow = (id, patch) => setRows(previous => previous.map(row => row.id === id ? { ...row, ...patch } : row))

  const saveProspect = async row => {
    setSavingId(row.id)
    try {
      const { data } = await api.put(`/sites/cold-emails/${row.id}`, {
        name: toCapitalizedName(row.name), email: row.email, company: row.company, website: row.website,
        status: row.status, sentAt: row.sent_at ? String(row.sent_at).slice(0, 10) : null, notes: row.notes,
      })
      setRows(previous => previous.map(item => item.id === row.id ? data : item))
      toast.success('Contact updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update contact')
    } finally {
      setSavingId(null)
    }
  }

  const removeProspect = async id => {
    if (!window.confirm('Delete this contact?')) return
    try {
      await api.delete(`/sites/cold-emails/${id}`)
      setRows(previous => previous.filter(row => row.id !== id))
      toast.success('Contact deleted')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete contact')
    }
  }

  const projectOptions = projects.map(project => ({ value: String(project.id), label: project.name, description: project.url }))

  return (
    <div className="cold-email-page fade-in page-content">
      <header className="cex-page-header">
        <div className="cex-heading"><span><FontAwesomeIcon icon={faPaperPlane} /></span><div><h1>Cold Email</h1><p>Turn qualified prospects into conversations</p></div></div>
        <button type="button" className="cex-primary cex-desktop-new" onClick={() => resetComposer(projects[0]?.id || '')}><FontAwesomeIcon icon={faPenToSquare} /> New email</button>
      </header>

      {!settings.cold_emails_enabled && !settingsLoading && (
        <div className="cex-warning">Sending is disabled by admin. You can still prepare and save drafts.</div>
      )}

      <section className="cex-summary" aria-label="Cold email summary">
        <article><small>Drafts</small><strong>{pendingRows.length}</strong></article>
        <article><small>Follow-ups</small><strong>{followupCount}</strong></article>
        <article><small>Sent</small><strong>{sentRows.length}</strong></article>
        <article className="is-success"><small>Replies</small><strong>{repliedCount}</strong></article>
      </section>

      <nav className="cex-tabs" aria-label="Cold email sections">
        {[
          ['prospects', 'Drafts'], ['compose', 'Compose'], ['history', 'History'],
        ].map(([id, label]) => <button type="button" key={id} className={activeTab === id ? 'is-active' : ''} aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>

      {activeTab === 'prospects' && (
        <section className="cex-panel cex-prospect-page">
          <div className="cex-section-header"><div><h2>Drafts</h2><p>Email drafts waiting for review</p></div><span>{pendingRows.length} drafts</span></div>
          {loading ? <div className="cex-empty">Loading prospects...</div> : pendingRows.length === 0 ? (
            <div className="cex-empty"><FontAwesomeIcon icon={faUsers} /><strong>No pending contacts</strong><p>New project drafts will appear here automatically.</p></div>
          ) : <div className="cex-prospect-list">{pendingRows.map(row => (
            <button type="button" key={row.id} className="cex-prospect-row" onClick={() => openDraftInComposer(row)}>
              <span className="cex-avatar">{String(row.name || row.site_name || 'P')[0].toUpperCase()}</span>
              <span><strong>{row.name || row.site_name || 'New prospect'}</strong><small>{row.email || row.website || row.site_url || 'Contact details required'}</small></span>
              <span className="cex-prospect-actions"><span className="cex-draft-badge">Draft</span><FontAwesomeIcon icon={faChevronRight} /></span>
            </button>
          ))}</div>}
        </section>
      )}

      {activeTab === 'compose' && (
        <section className="cex-compose-grid">
          <aside className="cex-panel cex-compose-prospects">
            <div className="cex-section-header"><div><h2>Drafts</h2><p>Waiting for review</p></div><span>{pendingRows.length}</span></div>
            {pendingRows.length === 0 ? <div className="cex-empty is-compact">No pending contacts</div> : pendingRows.map(row => (
              <button type="button" key={row.id} className={`cex-prospect-row ${draftId === row.id ? 'is-selected' : ''}`} onClick={() => openDraftInComposer(row)}>
                <span className="cex-avatar">{String(row.name || row.site_name || 'P')[0].toUpperCase()}</span>
                <span><strong>{row.name || row.site_name}</strong><small>{row.email || row.website || 'Add details'}</small></span>
                <span className="cex-draft-badge">Draft</span>
              </button>
            ))}
          </aside>

          <article className="cex-panel cex-composer">
            <div className="cex-section-header"><div><h2>{composeMode === 'followup' ? 'Compose follow-up' : 'Compose email'}</h2><p>Personalized outreach that is ready to review</p></div><div className="cex-draft-state"><span className="cex-draft-badge">{composeMode === 'followup' ? 'Follow-up' : 'Draft'}</span><span className="cex-save-state"><FontAwesomeIcon icon={draftState === 'saved' ? faCheck : faClock} />{draftState === 'saved' ? 'All changes saved' : 'Saving...'}</span></div></div>
            <div className="cex-fields">
              <label className={formErrors.project ? 'has-error' : ''}>Project
                <button type="button" className="cex-select-trigger" onClick={() => setProjectSheetOpen(true)}><span>{selectedProject?.name || 'Choose project'}</span><FontAwesomeIcon icon={faChevronDown} /></button>
                {formErrors.project && <small>{formErrors.project}</small>}
              </label>
              <label className={formErrors.email ? 'has-error' : ''}>Recipient<input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.email} onChange={event => updateForm({ email: event.target.value })} placeholder="name@company.com" />{formErrors.email && <small>{formErrors.email}</small>}</label>
              <label className={formErrors.name ? 'has-error' : ''}>Contact name<input value={form.name} onChange={event => updateForm({ name: toCapitalizedName(event.target.value) })} placeholder="Contact name" />{formErrors.name && <small>{formErrors.name}</small>}</label>
              <label>Company<input value={form.company} onChange={event => updateForm({ company: event.target.value })} placeholder="Company" /></label>
              <label>Website<input type="url" inputMode="url" value={form.website} onChange={event => updateForm({ website: event.target.value })} placeholder="https://company.com" /></label>
              <label>Send date<input type="date" value={String(form.sentAt || '').slice(0, 10)} onChange={event => updateForm({ sentAt: event.target.value })} /></label>
              <label className={`is-wide ${formErrors.subject ? 'has-error' : ''}`}>Subject<input value={form.subject} onChange={event => updateForm({ subject: event.target.value })} placeholder="Email subject" />{formErrors.subject && <small>{formErrors.subject}</small>}</label>
            </div>
            <div className="cex-message-head"><strong>Message</strong><span><button type="button" onClick={() => updateForm({ subject: defaultSubject(form.name), message: defaultMessage(form.name, form.website) })}>Use template</button><button type="button"><FontAwesomeIcon icon={faWandMagicSparkles} /> Improve with AI</button></span></div>
            <label className={`cex-message ${formErrors.message ? 'has-error' : ''}`}><textarea rows="7" value={form.message} onChange={event => updateForm({ message: event.target.value })} placeholder="Write your email..." />{formErrors.message && <small>{formErrors.message}</small>}</label>
            <details className="cex-notes"><summary>Internal notes</summary><textarea rows="3" value={form.notes} onChange={event => updateForm({ notes: event.target.value })} placeholder="Notes are not included in the email" /></details>
            <footer className="cex-compose-actions"><span className="cex-verified"><FontAwesomeIcon icon={faEnvelope} />Review recipient before sending</span><div><button type="button" className="cex-secondary" onClick={saveLocalDraft}>Save draft</button><button type="button" className="cex-primary" onClick={openReview} disabled={sending}>Review &amp; send</button></div></footer>
          </article>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="cex-panel">
          <div className="cex-section-header"><div><h2>History</h2><p>Sent emails, replies and follow-ups</p></div><span>{sentRows.length}</span></div>
          {loading ? <div className="cex-empty">Loading history...</div> : sentRows.length === 0 ? <div className="cex-empty"><FontAwesomeIcon icon={faEnvelope} /><strong>No sent emails yet</strong></div> : (
            <div className="cex-history-list">{sentRows.map(row => (
              <details className="cex-history-card" key={row.id}>
                <summary><span className="cex-avatar">{String(row.name || 'C')[0].toUpperCase()}</span><span><strong>{row.name}</strong><small>{row.company || row.site_name} Â· {row.email}</small></span><span className={`cex-status is-${row.status}`}>{STATUS_OPTIONS.find(option => option.value === row.status)?.label || row.status}</span><FontAwesomeIcon icon={faChevronDown} /></summary>
                <div className="cex-history-editor">
                  <label>Name<input value={row.name || ''} onChange={event => updateRow(row.id, { name: event.target.value })} /></label>
                  <label>Email<input type="email" value={row.email || ''} onChange={event => updateRow(row.id, { email: event.target.value })} /></label>
                  <label>Company<input value={row.company || ''} onChange={event => updateRow(row.id, { company: event.target.value })} /></label>
                  <label>Status<select value={row.status || 'sent'} onChange={event => updateRow(row.id, { status: event.target.value })}>{STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="is-wide">Notes<textarea rows="2" value={row.notes || ''} onChange={event => updateRow(row.id, { notes: event.target.value })} /></label>
                  <div className="cex-history-actions"><button type="button" onClick={() => openFollowupInComposer(row)}><FontAwesomeIcon icon={faReply} /> Follow-up</button><button type="button" className="cex-primary" onClick={() => saveProspect(row)} disabled={savingId === row.id}>{savingId === row.id ? 'Saving...' : 'Save'}</button><button type="button" className="is-danger" onClick={() => removeProspect(row.id)}><FontAwesomeIcon icon={faTrash} /> Delete</button></div>
                </div>
              </details>
            ))}</div>
          )}
        </section>
      )}

      <SelectSheet open={projectSheetOpen} title="Choose project" options={projectOptions} value={selectedSiteId} onClose={() => setProjectSheetOpen(false)} onSelect={value => { setSelectedSiteId(value); setDraftState('saving'); setFormErrors(previous => ({ ...previous, project: undefined })) }} />

      {reviewOpen && createPortal(
        <div className="cex-review-layer" role="presentation" onClick={() => setReviewOpen(false)}>
          <section className="cex-review" role="dialog" aria-modal="true" aria-label="Review email" onClick={event => event.stopPropagation()}>
            <header><div><h2>Review email</h2><p>Confirm everything before opening your email app</p></div><button type="button" onClick={() => setReviewOpen(false)} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button></header>
            <dl><div><dt>To</dt><dd>{form.name} &lt;{form.email}&gt;</dd></div><div><dt>Subject</dt><dd>{form.subject}</dd></div></dl>
            <pre>{form.message}</pre>
            <footer><button type="button" className="cex-secondary" onClick={() => setReviewOpen(false)}>Back to edit</button><button type="button" className="cex-primary" onClick={confirmSend} disabled={sending}><FontAwesomeIcon icon={faPaperPlane} />{sending ? 'Preparing...' : 'Open email app'}</button></footer>
          </section>
        </div>, document.body
      )}
    </div>
  )
}