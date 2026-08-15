/**
 * Digital PR for AI visibility — industry-style media pipeline.
 * Discover → Shortlist → Outreach → Track (published / AI cited)
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faNewspaper,
  faArrowsRotate,
  faPaperPlane,
  faExternalLink,
  faDownload,
  faFilter,
  faMagnifyingGlass,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { Card, SectionLabel, OrangeBtn, T } from './UI'
import { canUseColdEmails } from '../utils/features'
import { useAuth } from '../hooks/useAuth'

const STATUS_OPTIONS = [
  { value: 'discovered', label: 'Discovered' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'contacted', label: 'Outreach sent' },
  { value: 'in_discussion', label: 'In discussion' },
  { value: 'published', label: 'Published' },
  { value: 'ai_cited', label: 'AI cited' },
]

function authorityStyle(level) {
  const v = String(level || '').toLowerCase()
  if (v === 'high') return { bg: '#DCFCE7', color: '#166534', label: 'High' }
  if (v === 'low') return { bg: '#F1F5F9', color: '#64748B', label: 'Low' }
  return { bg: '#FFEDD5', color: '#C2410C', label: 'Medium' }
}

function statusLabel(value) {
  return STATUS_OPTIONS.find((s) => s.value === value)?.label || value
}

export default function AiMediaTrustPanel({ siteId, siteName, siteUrl, onOutletCountChange }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [outlets, setOutlets] = useState([])
  const [meta, setMeta] = useState(null)
  const [authorityFilter, setAuthorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [savingId, setSavingId] = useState(null)
  const [market, setMarket] = useState('nordic')
  const [niche, setNiche] = useState('')
  const [checkingMentions, setCheckingMentions] = useState(false)
  const [mentionSummary, setMentionSummary] = useState(null)
  const [showRetestBanner, setShowRetestBanner] = useState(false)

  const loadSaved = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(`/sites/${siteId}/ai-visibility/media-opportunities`)
      const list = Array.isArray(data?.outlets) ? data.outlets : []
      setOutlets(list)
      setMeta(data?.meta || null)
      onOutletCountChange?.(list.length)
      const published = list.some((o) =>
        ['published', 'ai_cited'].includes(o.status) || o.mentionFound
      )
      setShowRetestBanner(published)
    } catch (e) {
      if (e.response?.status !== 403) {
        setError(e.response?.data?.error || 'Could not load media list')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    if (siteId) loadSaved()
  }, [siteId])

  const discover = async (force = false) => {
    setRefreshing(true)
    setError('')
    try {
      const { data } = await api.post(`/sites/${siteId}/ai-visibility/media-opportunities`, {
        force,
        market,
        niche: niche.trim(),
      })
      const list = Array.isArray(data?.outlets) ? data.outlets : []
      setOutlets(list)
      setMeta(data?.meta || null)
      onOutletCountChange?.(list.length)
      if (!list.length) setError('No media suggestions returned. Try again.')
    } catch (e) {
      setError(e.response?.data?.error || 'Could not find media opportunities')
    }
    setRefreshing(false)
  }

  const checkMentions = async () => {
    setCheckingMentions(true)
    setError('')
    try {
      const { data } = await api.post(`/sites/${siteId}/ai-visibility/media-opportunities/check-mentions`)
      const list = Array.isArray(data?.outlets) ? data.outlets : []
      setOutlets(list)
      onOutletCountChange?.(list.length)
      setMentionSummary({ checked: data?.checked || 0, found: data?.found || 0 })
      if ((data?.found || 0) > 0) setShowRetestBanner(true)
    } catch (e) {
      setError(e.response?.data?.error || 'Mention check failed')
    }
    setCheckingMentions(false)
  }

  const updateStatus = async (id, status) => {
    setSavingId(id)
    try {
      const { data } = await api.patch(`/sites/${siteId}/ai-visibility/media-opportunities/${id}`, { status })
      setOutlets((prev) => prev.map((o) => (o.id === id ? { ...o, ...data } : o)))
      if (['published', 'ai_cited'].includes(status)) setShowRetestBanner(true)
    } catch (e) {
      setError(e.response?.data?.error || 'Could not update status')
    }
    setSavingId(null)
  }

  const openOutreach = async (outlet) => {
    const subject = `Story idea: ${siteName || 'our company'} for ${outlet.name}`
    const body = [
      `Hi,`,
      ``,
      `I follow ${outlet.name} and thought this might fit your coverage of ${outlet.topic || 'this topic'}.`,
      ``,
      `${siteName || 'We'} (${siteUrl || ''}) - ${outlet.pitch || 'happy to share a short brief or expert comment.'}`,
      ``,
      `Would this be interesting for a future piece?`,
      ``,
      `Thanks,`,
    ].join('\n')

    if (outlet.id && outlet.status === 'discovered') {
      await updateStatus(outlet.id, 'contacted')
    } else if (outlet.id && outlet.status === 'shortlisted') {
      await updateStatus(outlet.id, 'contacted')
    }

    if (canUseColdEmails(user)) {
      navigate(`/site/${siteId}/cold-emails`, {
        state: {
          draftSubject: subject,
          draftBody: body,
          draftToHint: outlet.contactHint || outlet.name,
        },
      })
      return
    }

    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      '_blank'
    )
  }

  const exportCsv = () => {
    const header = ['Outlet', 'URL', 'Country', 'Topic', 'AI Authority', 'Status', 'Mention', 'Mention URL', 'Pitch', 'Why']
    const lines = [header.join(',')]
    for (const o of filtered) {
      const row = [
        o.name,
        o.url,
        o.country,
        o.topic,
        o.aiAuthority,
        statusLabel(o.status),
        o.mentionFound ? 'Yes' : (o.mentionCheckedAt ? 'No' : ''),
        o.mentionUrl || '',
        o.pitch,
        o.why,
      ].map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
      lines.push(row.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `digital-pr-media-${siteId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => {
    return outlets.filter((o) => {
      if (authorityFilter !== 'all' && String(o.aiAuthority).toLowerCase() !== authorityFilter) return false
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      return true
    })
  }, [outlets, authorityFilter, statusFilter])

  const counts = meta || {
    total: outlets.length,
    high: outlets.filter((o) => o.aiAuthority === 'High').length,
    shortlisted: outlets.filter((o) => o.status === 'shortlisted').length,
    contacted: outlets.filter((o) => o.status === 'contacted').length,
    published: outlets.filter((o) => ['published', 'ai_cited'].includes(o.status)).length,
  }

  return (
    <Card
      padding="1.15rem 1.25rem"
      style={{
        marginBottom: 14,
        border: `1px solid ${T.border}`,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <FontAwesomeIcon icon={faNewspaper} style={{ color: T.orange }} />
            <SectionLabel>Find media & track outreach</SectionLabel>
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4, lineHeight: 1.45, maxWidth: 720 }}>
            Discover → shortlist High AI-trust → outreach → check mentions. Start with Discover media.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            title="Target market"
            style={{ height: 36, borderRadius: 8, border: `1px solid ${T.border}`, padding: '0 10px', fontSize: 12 }}
          >
            <option value="nordic">Market: Nordic</option>
            <option value="europe">Market: Europe</option>
            <option value="global">Market: Global</option>
          </select>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Niche focus (e.g. SEO tools)"
            style={{
              height: 36,
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              padding: '0 10px',
              fontSize: 12,
              minWidth: 160,
            }}
          />
          {outlets.length > 0 ? (
            <button
              type="button"
              onClick={checkMentions}
              disabled={checkingMentions}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: '#fff',
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 700,
                color: T.text2,
                cursor: checkingMentions ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} spin={checkingMentions} />
              {checkingMentions ? 'Checking…' : 'Check mentions'}
            </button>
          ) : null}
          {outlets.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              style={{
                height: 36,
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: '#fff',
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 700,
                color: T.text2,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FontAwesomeIcon icon={faDownload} /> Export CSV
            </button>
          ) : null}
          <OrangeBtn
            onClick={() => discover(outlets.length > 0)}
            disabled={refreshing || loading}
            style={{ height: 36 }}
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={refreshing} style={{ marginRight: 6 }} />
            {refreshing ? 'Working…' : outlets.length ? 'Refresh discover' : 'Discover media'}
          </OrangeBtn>
        </div>
      </div>

      {/* Pipeline status chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Chip label="Outlets" value={counts.total || 0} />
        <Chip label="High AI trust" value={counts.high || 0} tone="green" />
        <Chip label="Shortlisted" value={counts.shortlisted || 0} tone="orange" />
        <Chip label="Outreach sent" value={counts.contacted || 0} />
        <Chip label="Mentions found" value={counts.mentioned || outlets.filter((o) => o.mentionFound).length} tone="green" />
        <Chip label="Published / cited" value={counts.published || 0} tone="green" />
      </div>

      {mentionSummary ? (
        <div style={{ marginTop: 10, fontSize: 12, color: T.muted }}>
          Last mention check: scanned {mentionSummary.checked} outlets, found {mentionSummary.found} brand mention(s).
        </div>
      ) : null}

      {showRetestBanner ? (
        <div style={{
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid #BBF7D0',
          background: '#F0FDF4',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#15803D' }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>Close the loop</div>
            <div style={{ fontSize: 12, color: '#166534', opacity: 0.9, marginTop: 2 }}>
              You have published/mentioned coverage. Re-test AI Visibility questions to see if ChatGPT/Claude cite you more.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowRetestBanner(false)
              document.getElementById('ai-section-test')?.scrollIntoView?.({ behavior: 'smooth' })
            }}
            style={{
              height: 34,
              borderRadius: 8,
              border: 0,
              background: '#16A34A',
              color: '#fff',
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Re-test AI Visibility
          </button>
        </div>
      ) : null}

      {/* Filters */}
      {outlets.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <FontAwesomeIcon icon={faFilter} style={{ color: T.muted, fontSize: 12 }} />
          <select
            value={authorityFilter}
            onChange={(e) => setAuthorityFilter(e.target.value)}
            style={{ height: 32, borderRadius: 8, border: `1px solid ${T.border}`, padding: '0 8px', fontSize: 12 }}
          >
            <option value="all">All AI trust</option>
            <option value="high">High only</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: 32, borderRadius: 8, border: `1px solid ${T.border}`, padding: '0 8px', fontSize: 12 }}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => navigate(`/site/${siteId}/actions`)}
            style={{
              marginLeft: 'auto',
              height: 32,
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              background: '#fff',
              padding: '0 10px',
              fontSize: 12,
              fontWeight: 700,
              color: T.text2,
              cursor: 'pointer',
            }}
          >
            Open Action Plan
          </button>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: 12, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', borderRadius: 8, padding: '8px 10px' }}>
          {error}
        </div>
      ) : null}

      {!outlets.length && !loading && !refreshing && !error ? (
        <div style={{
          marginTop: 14,
          padding: '16px 14px',
          borderRadius: 10,
          border: `1px dashed ${T.border}`,
          background: '#F8FAFC',
          fontSize: 13,
          color: T.muted,
          lineHeight: 1.5,
        }}>
          <strong style={{ color: T.text }}>Start with Discover.</strong>{' '}
          We build a saved media list for <strong style={{ color: T.text }}>{siteName || siteUrl || 'your site'}</strong>,
          prioritized by AI-trust (same idea as enterprise Digital PR / AI PR tools), then you work the pipeline.
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 14, fontSize: 12, color: T.muted }}>Loading media pipeline…</div>
      ) : null}

      {filtered.length > 0 ? (
        <div style={{ marginTop: 14, overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: 10, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                {['Outlet', 'Topic fit', 'AI trust', 'Mention', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: T.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const auth = authorityStyle(o.aiAuthority)
                return (
                  <tr key={o.id || o.name}>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: T.text }}>{o.name}</div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        {[o.country, o.url?.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}
                      </div>
                      {o.why ? (
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4, maxWidth: 280 }}>
                          {o.why}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top', maxWidth: 220 }}>
                      <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.4 }}>{o.topic || '—'}</div>
                      {o.pitch ? (
                        <div style={{ fontSize: 11, color: '#9A3412', marginTop: 6, lineHeight: 1.4 }}>
                          Pitch: {o.pitch}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 800,
                        background: auth.bg,
                        color: auth.color,
                        borderRadius: 99,
                        padding: '3px 8px',
                      }}>
                        {auth.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top', maxWidth: 160 }}>
                      {o.mentionFound ? (
                        <div>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            background: '#DCFCE7',
                            color: '#166534',
                            borderRadius: 99,
                            padding: '3px 8px',
                          }}>
                            Found
                          </span>
                          {o.mentionUrl ? (
                            <a
                              href={o.mentionUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'block', fontSize: 11, color: '#2563EB', marginTop: 6, wordBreak: 'break-all' }}
                            >
                              {o.mentionTitle || 'Open article'}
                            </a>
                          ) : null}
                        </div>
                      ) : o.mentionCheckedAt ? (
                        <span style={{ fontSize: 11, color: T.muted }}>Not found</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>Not checked</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' }}>
                      <select
                        value={o.status || 'discovered'}
                        disabled={savingId === o.id}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        style={{
                          height: 32,
                          borderRadius: 8,
                          border: `1px solid ${T.border}`,
                          padding: '0 8px',
                          fontSize: 12,
                          minWidth: 130,
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {o.status === 'discovered' ? (
                          <button
                            type="button"
                            onClick={() => updateStatus(o.id, 'shortlisted')}
                            style={secondaryBtn}
                          >
                            Shortlist
                          </button>
                        ) : null}
                        <button type="button" onClick={() => openOutreach(o)} style={primaryBtn}>
                          <FontAwesomeIcon icon={faPaperPlane} /> Outreach
                        </button>
                        {o.url ? (
                          <a
                            href={o.url.startsWith('http') ? o.url : `https://${o.url}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ ...secondaryBtn, textDecoration: 'none', textAlign: 'center' }}
                          >
                            Site <FontAwesomeIcon icon={faExternalLink} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}

function Chip({ label, value, tone }) {
  const styles =
    tone === 'green'
      ? { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' }
      : tone === 'orange'
        ? { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' }
        : { bg: '#F8FAFC', color: '#334155', border: '#E2E8F0' }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      fontWeight: 700,
      background: styles.bg,
      color: styles.color,
      border: `1px solid ${styles.border}`,
      borderRadius: 99,
      padding: '4px 10px',
    }}>
      {label}
      <strong style={{ fontSize: 12 }}>{value}</strong>
    </span>
  )
}

const secondaryBtn = {
  fontSize: 11,
  fontWeight: 700,
  color: '#334155',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
}

const primaryBtn = {
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  background: '#EA580C',
  border: 0,
  borderRadius: 8,
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
}
