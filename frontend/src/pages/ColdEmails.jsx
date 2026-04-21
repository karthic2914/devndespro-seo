import { useEffect, useState } from 'react'
import useAdminSettings from '../hooks/useAdminSettings'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faTrash } from '@fortawesome/free-solid-svg-icons'
import { Card, SectionLabel, OrangeBtn, PageHeader, EmptyState } from '../components/UI'
import api from '../utils/api'

const STATUS_OPTIONS = [
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'interested', label: 'Interested' },
  { value: 'not-interested', label: 'Not Interested' },
  { value: 'bounced', label: 'Bounced' },
]

function toCapitalizedName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
}

function defaultForm() {
  return {
    name: '',
    email: '',
    company: '',
    website: '',
    status: 'sent',
    sentAt: new Date().toISOString().slice(0, 10),
    subject: '',
    message: '',
    notes: '',
  }
}

function toDateInputValue(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function defaultSubject(name) {
  const safeName = String(name || '').trim()
  return safeName ? `Quick SEO suggestions for ${safeName}` : 'Quick SEO suggestions for your website'
}

function defaultMessage(name, website) {
  const safeName = String(name || '').trim()
  const safeWebsite = String(website || '').trim()
  return [
    'Hi,',
    '',
    safeWebsite
      ? `I came across your website (${safeWebsite}) while looking for restaurants online and had a quick look.`
      : 'I came across your website while looking for restaurants online and had a quick look.',
    '',
    'I noticed your site feels a bit slow on mobile and a couple of small SEO things could be improved.',
    '',
    'I ran a quick check using my tool.',
    '',
    'Happy to share a short report if you are interested.',
    '',
    'https://www.seo.devndespro.com',
    '',
    'Regards,',
    'www.devndespro.com',
  ].join('\n')
}

function followupSubject(name) {
  const safeName = String(name || '').trim()
  return safeName ? `Following up: SEO report for ${safeName}` : 'Following up: SEO report'
}

function followupMessage(name, website) {
  const safeWebsite = String(website || '').trim()
  return [
    'Hi,',
    '',
    safeWebsite
      ? `Following up on my previous note about ${safeWebsite}.`
      : 'Following up on my previous note about your website.',
    '',
    'If helpful, I can share a quick SEO report with practical fixes.',
    '',
    'Regards,',
    'www.devndespro.com',
  ].join('\n')
}

export default function ColdEmails() {
  const { settings, loading: settingsLoading } = useAdminSettings()
  const [rows, setRows] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const [composeMode, setComposeMode] = useState('first')
  const [savingId, setSavingId] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const pendingRows = rows.filter((r) => String(r.status || '').toLowerCase() === 'draft')
  const sentRows = rows.filter((r) => String(r.status || '').toLowerCase() !== 'draft')

  const resetComposer = (siteId = '') => {
    setDraftId(null)
    setComposeMode('first')
    setSelectedSiteId(siteId ? String(siteId) : '')
    setForm(defaultForm())
  }

  const openDraftInComposer = (draft) => {
    setDraftId(draft.id)
    setComposeMode('first')
    setSelectedSiteId(String(draft.site_id))
    setForm({
      name: draft.name || '',
      email: draft.email || '',
      company: draft.company || '',
      website: draft.website || draft.site_url || '',
      status: 'sent',
      sentAt: new Date().toISOString().slice(0, 10),
      subject: defaultSubject(draft.name),
      message: defaultMessage(draft.name, draft.website || draft.site_url),
      notes: draft.notes || '',
    })
  }

  const openFollowupInComposer = (row) => {
    setDraftId(row.id)
    setComposeMode('followup')
    setSelectedSiteId(String(row.site_id))
    setForm({
      name: row.name || '',
      email: row.email || '',
      company: row.company || '',
      website: row.website || row.site_url || '',
      status: 'follow-up',
      sentAt: new Date().toISOString().slice(0, 10),
      subject: followupSubject(row.name),
      message: followupMessage(row.name, row.website || row.site_url),
      notes: row.notes || '',
    })
  }

  const load = async () => {
    setLoading(true)
    try {
      const [prospectsRes, projectsRes] = await Promise.all([
        api.get('/sites/cold-emails'),
        api.get('/sites'),
      ])
      const list = Array.isArray(prospectsRes?.data) ? prospectsRes.data : []
      const sites = Array.isArray(projectsRes?.data) ? projectsRes.data : []
      setRows(list)
      setProjects(sites)

      const draft = list.find((r) => String(r.status || '').toLowerCase() === 'draft')
      if (draft) {
        openDraftInComposer(draft)
      } else {
        resetComposer(sites[0]?.id || '')
      }
    } catch {
      setRows([])
      setProjects([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const sendEmail = async () => {
    if (!settings.cold_emails_enabled) {
      alert('Cold email sending is currently disabled by admin.')
      return
    }
    if (!form.name.trim() || !String(form.email || '').trim()) return
    const numericSiteId = Number(selectedSiteId)
    if (!numericSiteId) return

    setSending(true)
    const subject = String(form.subject || '').trim() || defaultSubject(form.name)
    const message = String(form.message || '').trim() || defaultMessage(form.name, form.website)
    try {
      const payload = {
        siteId: numericSiteId,
        name: toCapitalizedName(form.name).trim(),
        email: String(form.email || '').trim(),
        company: form.company,
        website: form.website,
        status: composeMode === 'followup' ? 'follow-up' : 'sent',
        sentAt: form.sentAt,
        notes: form.notes,
      }
      if (draftId) {
        const { data } = await api.put(`/sites/cold-emails/${draftId}`, payload)
        setRows((prev) => prev.map((r) => (r.id === draftId ? data : r)))
      } else {
        const { data } = await api.post('/sites/cold-emails', payload)
        setRows((prev) => [data, ...prev])
      }

      const mailto = `mailto:${encodeURIComponent(String(form.email || '').trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
      window.location.href = mailto

      await load()
    } catch {
      // keep quiet; existing UX pattern in app does not use inline errors for all pages
    }
    setSending(false)
  }

  const saveProspect = async (row) => {
    setSavingId(row.id)
    try {
      const { data } = await api.put(`/sites/cold-emails/${row.id}`, {
        name: toCapitalizedName(row.name),
        email: row.email,
        company: row.company,
        website: row.website,
        status: row.status,
        sentAt: row.sent_at ? String(row.sent_at).slice(0, 10) : null,
        notes: row.notes,
      })
      setRows((prev) => prev.map((r) => (r.id === row.id ? data : r)))
    } catch {
      // keep quiet; existing UX pattern in app does not use inline errors for all pages
    }
    setSavingId(null)
  }

  const removeProspect = async (id) => {
    try {
      await api.delete(`/sites/cold-emails/${id}`)
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch {
      // keep quiet; existing UX pattern in app does not use inline errors for all pages
    }
  }

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="fade-in page-content">
      {!settings.cold_emails_enabled && !settingsLoading && (
        <div style={{ background: '#fffbe6', color: '#b45309', padding: '12px 18px', borderRadius: 8, marginBottom: 18, fontWeight: 600 }}>
          Cold email sending is currently <b>disabled</b> by admin. You can still draft and save prospects, but emails will not be sent.
        </div>
      )}
      <PageHeader
        title="Cold Email Prospects"
        subtitle="Common across all projects. New projects appear as pending drafts, then move to history after you send."
        action={(
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--orange)',
            background: 'var(--orange-dim)',
            border: '1px solid rgba(230,106,57,0.18)',
            borderRadius: 999,
            padding: '6px 10px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Owner Only
          </div>
        )}
      />

      <>

          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Pending contacts (not sent yet)</SectionLabel>
            {loading ? <EmptyState message="Loading pending contacts..." /> : pendingRows.length === 0 ? (
              <EmptyState message="No pending contacts. Add a new project to auto-create a draft here." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Project</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Website</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--dark4)', color: 'var(--text)' }}>{row.site_name || '-'}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--dark4)', color: 'var(--text)' }}>{row.name || '-'}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--dark4)', color: 'var(--text)' }}>{row.email || '-'}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--dark4)', color: 'var(--muted)' }}>{row.website || row.site_url || '-'}</td>
                        <td style={{ padding: '10px 12px', borderTop: '1px solid var(--dark4)', whiteSpace: 'nowrap' }}>
                          <OrangeBtn onClick={() => openDraftInComposer(row)}>Prepare First Email</OrangeBtn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Compose email</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
              <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: toCapitalizedName(e.target.value) }))}
              />
              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              />
              <input
                placeholder="Website"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              />
              <input
                placeholder="Email subject"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
              <input
                type="date"
                value={toDateInputValue(form.sentAt)}
                onChange={(e) => setForm((p) => ({ ...p, sentAt: e.target.value }))}
              />
            </div>
            <textarea
              placeholder="Email content to send"
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              rows={4}
              style={{ width: '100%', marginTop: 10 }}
            />
            <textarea
              placeholder="Internal notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              style={{ width: '100%', marginTop: 10 }}
            />
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <OrangeBtn onClick={sendEmail} disabled={sending || !selectedSiteId || !form.name.trim() || !String(form.email || '').trim()}>
                {sending ? 'Sending...' : <><FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: 6 }} />Send Email</>}
              </OrangeBtn>
            </div>
          </Card>

          <Card>
            <SectionLabel>Sent and follow-up history</SectionLabel>
            {loading ? <EmptyState message="Loading prospects..." /> : sentRows.length === 0 ? (
              <EmptyState message="No contacts yet. Add your first cold email contact above." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1120 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Project</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Company</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Website</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Sent Date</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Notes</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)', color: 'var(--text)' }}>
                          {row.site_name || '-'}
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <input value={row.name || ''} onChange={(e) => updateRow(row.id, { name: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <input value={row.email || ''} onChange={(e) => updateRow(row.id, { email: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <input value={row.company || ''} onChange={(e) => updateRow(row.id, { company: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <input value={row.website || ''} onChange={(e) => updateRow(row.id, { website: e.target.value })} />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <select value={row.status || 'sent'} onChange={(e) => updateRow(row.id, { status: e.target.value })}>
                            {STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)' }}>
                          <input
                            type="date"
                            value={toDateInputValue(row.sent_at)}
                            onChange={(e) => updateRow(row.id, { sent_at: e.target.value })}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)', minWidth: 220 }}>
                          <textarea
                            rows={2}
                            value={row.notes || ''}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top', borderTop: '1px solid var(--dark4)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => openFollowupInComposer(row)}
                              style={{
                                background: 'transparent',
                                color: 'var(--orange)',
                                border: '1px solid var(--orange)',
                                borderRadius: 8,
                                padding: '8px 12px',
                                cursor: 'pointer',
                              }}
                            >
                              Follow-up
                            </button>
                            <OrangeBtn onClick={() => saveProspect(row)} disabled={savingId === row.id || !String(row.name || '').trim()}>
                              {savingId === row.id ? 'Saving...' : 'Save'}
                            </OrangeBtn>
                            <button
                              onClick={() => removeProspect(row.id)}
                              style={{
                                background: 'transparent',
                                color: 'var(--red)',
                                border: '1px solid var(--red)',
                                borderRadius: 8,
                                padding: '8px 12px',
                                cursor: 'pointer',
                              }}
                            >
                              <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} />Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

      </>
    </div>
  )
}
