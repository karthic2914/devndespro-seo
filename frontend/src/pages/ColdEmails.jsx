import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
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
    notes: '',
  }
}

export default function ColdEmails() {
  const { siteId } = useParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const load = async () => {
    setLoading(true)
    setForbidden(false)
    try {
      const { data } = await api.get(`/sites/${siteId}/cold-emails`)
      setRows(data || [])
    } catch (error) {
      setRows([])
      if (error?.response?.status === 403) setForbidden(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [siteId])

  const addProspect = async () => {
    if (!form.name.trim()) return
    setAdding(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/cold-emails`, {
        ...form,
        name: toCapitalizedName(form.name).trim(),
      })
      setRows((prev) => [data, ...prev])
      setForm(defaultForm())
    } catch {
      // keep quiet; existing UX pattern in app does not use inline errors for all pages
    }
    setAdding(false)
  }

  const saveProspect = async (row) => {
    setSavingId(row.id)
    try {
      const { data } = await api.put(`/sites/${siteId}/cold-emails/${row.id}`, {
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
      await api.delete(`/sites/${siteId}/cold-emails/${id}`)
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
      <PageHeader
        title="Cold Email Prospects"
        subtitle="Store people you contacted and track reply/follow-up status (this list is per project)"
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

      {forbidden ? (
        <Card>
          <EmptyState
            title="Access restricted"
            message="Only the site owner can view cold email prospects for this project."
          />
        </Card>
      ) : (
        <>

          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Add new contact</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: 10 }}>
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
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={form.sentAt}
                onChange={(e) => setForm((p) => ({ ...p, sentAt: e.target.value }))}
              />
            </div>
            <textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              style={{ width: '100%', marginTop: 10 }}
            />
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <OrangeBtn onClick={addProspect} disabled={adding || !form.name.trim()}>
                {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add Contact</>}
              </OrangeBtn>
            </div>
          </Card>

          <Card>
            <SectionLabel>Your sent prospects</SectionLabel>
            {loading ? <EmptyState message="Loading prospects..." /> : rows.length === 0 ? (
              <EmptyState message="No contacts yet. Add your first cold email contact above." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 980 }}>
                  <thead>
                    <tr>
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
                    {rows.map((row) => (
                      <tr key={row.id}>
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
                            value={row.sent_at ? String(row.sent_at).slice(0, 10) : ''}
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
      )}
    </div>
  )
}
