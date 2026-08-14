import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faWandMagicSparkles, faRotate, faXmark, faChartColumn } from '@fortawesome/free-solid-svg-icons'
import { BrandFavicon } from './SiteFavicon'
import api from '../utils/api'
import toast from '../utils/toast'

const panelStyle = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: '14px 16px',
}

function Metric({ label, value }) {
  return (
    <div style={{ minWidth: 72 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'DM Mono, monospace' }}>
        {value == null ? '—' : value}
      </div>
    </div>
  )
}

export default function BacklinksCompetitorPanel({ siteId, onSaveOpportunity }) {
  const [competitors, setCompetitors] = useState([])
  const [domainInput, setDomainInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [comparing, setComparing] = useState(false)
  const [compare, setCompare] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadCompetitors = async () => {
    try {
      const { data } = await api.get(`/sites/${siteId}/competitors`)
      setCompetitors(Array.isArray(data) ? data : [])
    } catch {
      setCompetitors([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!siteId) return
    loadCompetitors()
  }, [siteId])

  const normalizeDomain = (raw) => {
    const v = String(raw || '').trim()
    if (!v) return ''
    const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(w).hostname.replace(/^www\./i, '').toLowerCase()
  }

  const addCompetitor = async () => {
    let domain = ''
    try {
      domain = normalizeDomain(domainInput)
    } catch {
      toast.error('Enter a valid domain (e.g. competitor.com)')
      return
    }
    if (!domain) {
      toast.error('Enter a competitor domain')
      return
    }
    setAdding(true)
    try {
      await api.post(`/sites/${siteId}/competitors`, { name: domain, url: `https://${domain}` })
      setDomainInput('')
      toast.success(`Added ${domain}`)
      await loadCompetitors()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to add competitor')
    }
    setAdding(false)
  }

  const removeCompetitor = async (id) => {
    try {
      await api.delete(`/sites/${siteId}/competitors/${id}`)
      setCompetitors((p) => p.filter((c) => c.id !== id))
      toast.success('Competitor removed')
    } catch {
      toast.error('Failed to remove')
    }
  }

  const autoDiscover = async () => {
    setDiscovering(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/competitors/auto-discover`)
      const inserted = Number(data?.inserted || 0)
      setCompetitors(Array.isArray(data?.competitors) ? data.competitors : [])
      const src = data?.source ? ` via ${data.source}` : ''
      if (inserted > 0) toast.success(`Found ${inserted} competitor${inserted === 1 ? '' : 's'}${src}`)
      else toast('No new competitors this time - try typing one manually')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Auto-discover failed')
    }
    setDiscovering(false)
  }

  const runCompare = async () => {
    if (!competitors.length) {
      toast.error('Add or discover competitors first')
      return
    }
    setComparing(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/backlinks/competitor-compare`, {
        domains: competitors.slice(0, 4).map((c) => c.name),
      })
      setCompare(data)
      if (Array.isArray(data?.competitors)) {
        // refresh list in case DR was updated from live rank
        await loadCompetitors()
      }
      if (data?.warnings?.length) {
        toast(data.warnings[0])
      } else {
        toast.success('Competitor backlink data refreshed')
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Compare failed')
    }
    setComparing(false)
  }

  const saveGapAsOpportunity = async (gap) => {
    if (!onSaveOpportunity) return
    await onSaveOpportunity({
      site: gap.domain,
      siteUrl: `https://${gap.domain}/`,
      type: 'competitor-link-gap',
      strategy: `Links to ${gap.vsCompetitor} but not you`,
      relevance: 'High',
      estimatedDR: Number(gap.rank || 0),
      evidence: `Link gap vs ${gap.vsCompetitor}`,
    })
  }

  return (
    <div style={{ ...panelStyle, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Backlink competitors</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            Type a domain, or auto-discover from backlink overlap, rankings, and your site crawl.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={autoDiscover}
            disabled={discovering}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #FED7AA',
              background: '#FFF7ED',
              color: '#C2410C',
              fontWeight: 700,
              fontSize: 12,
              cursor: discovering ? 'wait' : 'pointer',
            }}
          >
            <FontAwesomeIcon icon={discovering ? faRotate : faWandMagicSparkles} spin={discovering} style={{ marginRight: 6 }} />
            {discovering ? 'Discovering…' : 'Auto-Discover'}
          </button>
          <button
            type="button"
            onClick={runCompare}
            disabled={comparing || !competitors.length}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #0E2A47',
              background: '#0B1F36',
              color: '#34D399',
              fontWeight: 700,
              fontSize: 12,
              cursor: comparing || !competitors.length ? 'not-allowed' : 'pointer',
              opacity: comparing || !competitors.length ? 0.6 : 1,
            }}
          >
            <FontAwesomeIcon icon={comparing ? faRotate : faChartColumn} spin={comparing} style={{ marginRight: 6 }} />
            {comparing ? 'Loading live data…' : 'Refresh live data'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
          placeholder="competitor.com"
          style={{
            flex: 1,
            minWidth: 180,
            height: 36,
            borderRadius: 8,
            border: '1px solid #E2E8F0',
            padding: '0 12px',
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={addCompetitor}
          disabled={adding}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 8,
            border: 0,
            background: '#EA580C',
            color: '#fff',
            fontWeight: 700,
            fontSize: 12,
            cursor: adding ? 'wait' : 'pointer',
          }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading competitors…</div>
      ) : !competitors.length ? (
        <div style={{ fontSize: 12, color: '#94A3B8', padding: '8px 0 4px' }}>
          No competitors yet. Type a domain or run Auto-Discover.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 12 }}>
          {competitors.map((c) => (
            <div
              key={c.id || c.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <BrandFavicon name={c.name} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{c.name}</div>
                {c.notes ? (
                  <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.notes}
                  </div>
                ) : null}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                DR {Number(c.dr || 0)}
              </div>
              <button
                type="button"
                onClick={() => removeCompetitor(c.id)}
                style={{ background: 'none', border: 0, color: '#94A3B8', cursor: 'pointer', fontSize: 14 }}
                title="Remove"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          ))}
        </div>
      )}

      {compare?.you && (
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
            Live comparison
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 12px', background: '#FFF7ED', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#C2410C', minWidth: 100 }}>You · {compare.yourDomain}</div>
              <Metric label="Rank" value={compare.you.rank} />
              <Metric label="Backlinks" value={compare.you.backlinks} />
              <Metric label="Ref. domains" value={compare.you.referringDomains} />
            </div>
            {(compare.competitors || []).map((c) => (
              <div
                key={c.domain}
                style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', minWidth: 100 }}>{c.domain}</div>
                <Metric label="Rank" value={c.rank} />
                <Metric label="Backlinks" value={c.backlinks} />
                <Metric label="Ref. domains" value={c.referringDomains} />
                {c.deltaRefDomains != null && (
                  <Metric
                    label="Ref gap"
                    value={c.deltaRefDomains > 0 ? `+${c.deltaRefDomains}` : c.deltaRefDomains}
                  />
                )}
              </div>
            ))}
          </div>

          {Array.isArray(compare.linkGap) && compare.linkGap.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
                Link gap (link to competitor, not you)
              </div>
              {compare.linkGap.slice(0, 8).map((g) => (
                <div
                  key={g.domain}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <BrandFavicon name={g.domain} size={14} />
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{g.domain}</div>
                  <span style={{ fontSize: 11, color: '#64748B' }}>Rank {g.rank || 0}</span>
                  {onSaveOpportunity && (
                    <button
                      type="button"
                      onClick={() => saveGapAsOpportunity(g)}
                      style={{
                        border: '1px solid #FED7AA',
                        background: '#FFF7ED',
                        color: '#C2410C',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Save prospect
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
