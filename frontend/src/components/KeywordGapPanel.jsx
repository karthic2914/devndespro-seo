import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faWandMagicSparkles,
  faRotate,
  faXmark,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons'
import { Card, OrangeBtn, GhostBtn } from './UI'
import CollapsibleSection from './CollapsibleSection'
import api from '../utils/api'
import toast from '../utils/toast'

const LOCATIONS = [
  { code: 2578, name: 'Norway' },
  { code: 2840, name: 'United States' },
  { code: 2826, name: 'United Kingdom' },
  { code: 2036, name: 'Australia' },
  { code: 2124, name: 'Canada' },
  { code: 2276, name: 'Germany' },
  { code: 2356, name: 'India' },
]

function OppPill({ label }) {
  if (!label) return null
  const map = {
    'Quick Win': { bg: '#dcfce7', color: '#16a34a' },
    'High Value': { bg: '#e0f2fe', color: '#0369a1' },
    'Long Tail': { bg: '#ede9fe', color: '#7c3aed' },
    'High Competition': { bg: '#fef3c7', color: '#b45309' },
    'Low Priority': { bg: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[label] || { bg: '#f9fafb', color: '#374151' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

export default function KeywordGapPanel({ siteId, onAdded }) {
  const [youDomain, setYouDomain] = useState('')
  const [inputs, setInputs] = useState([''])
  const [locationCode, setLocationCode] = useState(2578)
  const [running, setRunning] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [result, setResult] = useState(null)
  const [view, setView] = useState('missing') // missing | shared | unique
  const [addingKey, setAddingKey] = useState(null)

  useEffect(() => {
    if (!siteId) return
    Promise.all([
      api.get(`/sites/${siteId}`).catch(() => ({ data: null })),
      api.get(`/sites/${siteId}/competitors`).catch(() => ({ data: [] })),
    ]).then(([siteRes, compRes]) => {
      const url = siteRes.data?.url || ''
      try {
        setYouDomain(new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, ''))
      } catch {
        setYouDomain(url)
      }
      const list = Array.isArray(compRes.data) ? compRes.data : []
      if (list.length) {
        setInputs(list.slice(0, 4).map((c) => c.name).concat(['']).slice(0, Math.max(2, Math.min(4, list.length))))
      }
    })
  }, [siteId])

  const normalizeDomain = (raw) => {
    const v = String(raw || '').trim()
    if (!v) return ''
    const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(w).hostname.replace(/^www\./i, '').toLowerCase()
  }

  const autoDiscover = async () => {
    setDiscovering(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/competitors/auto-discover`, { prune: true })
      const list = Array.isArray(data?.competitors) ? data.competitors : []
      setInputs(list.slice(0, 4).map((c) => c.name).concat(['']).slice(0, Math.max(2, Math.min(4, list.length || 1))))
      toast.success(data?.inserted || data?.pruned ? 'Same-niche competitors refreshed' : 'Competitors ready')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Auto-discover failed')
    }
    setDiscovering(false)
  }

  const compare = async () => {
    const domains = []
    for (const raw of inputs) {
      try {
        const d = normalizeDomain(raw)
        if (d && d !== youDomain) domains.push(d)
      } catch { /* skip */ }
    }
    const unique = [...new Set(domains)].slice(0, 4)
    if (!unique.length) {
      toast.error('Add at least one competitor domain')
      return
    }

    setRunning(true)
    try {
      for (const d of unique) {
        await api.post(`/sites/${siteId}/competitors`, { name: d, url: `https://${d}` }).catch(() => {})
      }
      const { data } = await api.post(`/sites/${siteId}/keywords/gap`, {
        domains: unique,
        locationCode,
        limit: 100,
      })
      setResult(data)
      setView('missing')
      if (data?.warning) toast(data.warning)
      else toast.success(`Gap ready: ${data?.counts?.missing || 0} missing keywords`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Keyword gap failed')
    }
    setRunning(false)
  }

  const addKeyword = async (row) => {
    setAddingKey(row.keyword)
    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: row.keyword,
        volume: row.volume || 0,
        difficulty: row.difficulty || 'Medium',
        position: row.yourPosition || null,
        intent: row.intent || null,
        source: 'competitor_gap',
      })
      toast.success(`Tracked “${row.keyword}”`)
      onAdded?.()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not add keyword')
    }
    setAddingKey(null)
  }

  const rows =
    view === 'shared' ? (result?.shared || [])
      : view === 'unique' ? (result?.uniqueToYou || [])
        : (result?.missing || [])

  const filledCompetitors = useMemo(
    () => inputs.map((v) => String(v || '').trim()).filter(Boolean).length,
    [inputs]
  )

  return (
    <Card style={{ marginBottom: 16 }}>
      <CollapsibleSection
        title="Keyword gap"
        subtitle="Find keywords competitors rank for that you don’t - content and SEO opportunities."
        icon={<FontAwesomeIcon icon={faChartLine} style={{ color: '#EA580C' }} />}
        defaultOpen
      >
        <div style={{
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 14,
          background: '#F8FAFC',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            Competitors setup
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.4 }}>
            {filledCompetitors
              ? `${filledCompetitors} competitor(s) ready - pick market, then Compare.`
              : 'Add competitors (or Auto-fill), pick market, then Compare to see gap keywords.'}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#EA580C', background: '#FFF7ED',
                borderRadius: 6, padding: '4px 8px', minWidth: 44, textAlign: 'center',
              }}>You</span>
              <input
                value={youDomain}
                readOnly
                style={{
                  flex: 1, minWidth: 160, height: 36, borderRadius: 8,
                  border: '1px solid #FED7AA', background: '#FFFBEB', padding: '0 12px', fontWeight: 700,
                }}
              />
              <select
                value={locationCode}
                onChange={(e) => setLocationCode(Number(e.target.value))}
                style={{ height: 36, borderRadius: 8, border: '1px solid #E2E8F0', padding: '0 10px' }}
              >
                {LOCATIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>

            {inputs.map((val, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#334155', background: '#E2E8F0',
                  borderRadius: 6, padding: '4px 8px', minWidth: 44, textAlign: 'center',
                }}>
                  C{i + 1}
                </span>
                <input
                  value={val}
                  onChange={(e) => setInputs((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
                  placeholder="Add competitor domain"
                  style={{ flex: 1, minWidth: 160, height: 36, borderRadius: 8, border: '1px solid #E2E8F0', padding: '0 12px' }}
                />
                {inputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setInputs((p) => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 0, color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {inputs.length < 4 && (
                <GhostBtn onClick={() => setInputs((p) => [...p, ''])}>+ Add up to {4 - inputs.length} more</GhostBtn>
              )}
              <GhostBtn onClick={autoDiscover} disabled={discovering}>
                <FontAwesomeIcon icon={discovering ? faRotate : faWandMagicSparkles} spin={discovering} style={{ marginRight: 6 }} />
                Auto-fill competitors
              </GhostBtn>
            </div>
            <OrangeBtn onClick={compare} disabled={running}>
              <FontAwesomeIcon icon={running ? faRotate : faChartLine} spin={running} style={{ marginRight: 6 }} />
              {running ? 'Comparing…' : 'Compare'}
            </OrangeBtn>
          </div>
        </div>

        {result && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
              Gap results
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
              Missing = competitors rank, you don’t. Track the best ones.
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {[
                { id: 'missing', label: 'Missing', count: result.counts?.missing },
                { id: 'shared', label: 'Shared', count: result.counts?.shared },
                { id: 'unique', label: 'Unique to you', count: result.counts?.uniqueToYou },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  style={{
                    border: 0,
                    borderRadius: 8,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: 'pointer',
                    background: view === t.id ? '#0B1F36' : '#F1F5F9',
                    color: view === t.id ? '#fff' : '#475569',
                  }}
                >
                  {t.label}
                  <span style={{ marginLeft: 6, opacity: 0.85 }}>{t.count ?? 0}</span>
                </button>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.6fr) 70px 70px 90px 110px 100px',
              gap: 8,
              fontSize: 10,
              fontWeight: 800,
              color: '#94A3B8',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              <span>Keyword</span>
              <span style={{ textAlign: 'right' }}>Volume</span>
              <span style={{ textAlign: 'right' }}>You</span>
              <span style={{ textAlign: 'right' }}>Best comp.</span>
              <span>Opportunity</span>
              <span />
            </div>

            {!rows.length ? (
              <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 0' }}>No keywords in this view.</div>
            ) : (
              rows.slice(0, 60).map((row) => (
                <div
                  key={row.keyword}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.6fr) 70px 70px 90px 110px 100px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '9px 0',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.keyword}
                    </div>
                    {row.bestCompetitor && view !== 'unique' && (
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>via {row.bestCompetitor}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{row.volume || 0}</div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: row.yourPosition ? '#0F172A' : '#94A3B8' }}>
                    {row.yourPosition ?? '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700 }}>
                    {row.bestCompetitorPosition ?? '—'}
                  </div>
                  <div><OppPill label={row.opportunity} /></div>
                  <div style={{ textAlign: 'right' }}>
                    {view !== 'unique' && (
                      <button
                        type="button"
                        disabled={addingKey === row.keyword}
                        onClick={() => addKeyword(row)}
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
                        <FontAwesomeIcon icon={faPlus} style={{ marginRight: 4 }} />
                        Track
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CollapsibleSection>
    </Card>
  )
}
