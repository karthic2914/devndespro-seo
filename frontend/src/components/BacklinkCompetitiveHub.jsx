import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlus,
  faWandMagicSparkles,
  faRotate,
  faXmark,
  faChartColumn,
  faLinkSlash,
  faGlobe,
  faCodeCompare,
} from '@fortawesome/free-solid-svg-icons'
import { BrandFavicon } from './SiteFavicon'
import { Card, MetricCard, OrangeBtn, GhostBtn } from './UI'
import api from '../utils/api'
import toast from '../utils/toast'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'broken', label: 'Broken backlinks' },
  { id: 'referring', label: 'Referring domains' },
  { id: 'gap', label: 'Backlink gap' },
]

function TabBar({ active, onChange, counts = {} }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: 14,
        padding: 4,
        background: '#F8FAFC',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id
        const count = counts[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              border: 0,
              borderRadius: 9,
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: 750,
              cursor: 'pointer',
              background: isActive ? '#0B1F36' : 'transparent',
              color: isActive ? '#fff' : '#475569',
            }}
          >
            {tab.label}
            {count != null ? (
              <span style={{
                marginLeft: 7,
                fontSize: 10,
                fontWeight: 800,
                opacity: 0.85,
                background: isActive ? 'rgba(255,255,255,0.15)' : '#E2E8F0',
                padding: '2px 6px',
                borderRadius: 99,
              }}>
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function BrokenPanel({ backlinks, onFilter }) {
  const broken = useMemo(
    () =>
      backlinks.filter(
        (b) =>
          b.is_broken === true ||
          Number(b.http_status) >= 400 ||
          String(b.verification_status || '').toLowerCase() === 'broken'
      ),
    [backlinks]
  )

  if (!broken.length) {
    return (
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
          <FontAwesomeIcon icon={faLinkSlash} style={{ marginRight: 8, color: '#DC2626' }} />
          No broken backlinks found
        </div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
          Broken backlinks point to dead pages on your site (404). Sync with Discover or re-verify after fixing pages / redirects.
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Broken backlinks</div>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
        Links to your site that hit a broken target URL. Fix the page or 301-redirect to reclaim equity.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {broken.slice(0, 50).map((b) => {
          const domain = b.source_domain || b.name || '—'
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onFilter?.(domain)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1.4fr) 70px 80px',
                gap: 10,
                alignItems: 'center',
                padding: '10px 0',
                border: 0,
                borderBottom: '1px solid #F1F5F9',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <BrandFavicon name={domain} size={16} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {domain}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.url || b.source_url || '—'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {b.target_url || 'your site'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', textAlign: 'center' }}>
                {b.http_status || '404'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                DR {Number(b.provider_rank || b.dr || 0)}
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function ReferringDomainsPanel({ siteId, onFilterDomain }) {
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    api.get(`/sites/${siteId}/backlinks/referring-domains`)
      .then((r) => setDomains(Array.isArray(r.data?.domains) ? r.data.domains : []))
      .catch(() => setDomains([]))
      .finally(() => setLoading(false))
  }, [siteId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return domains
    return domains.filter((d) => d.domain.includes(q))
  }, [domains, search])

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>
            <FontAwesomeIcon icon={faGlobe} style={{ marginRight: 8, color: '#2563EB' }} />
            Referring domains
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
            Unique websites linking to you — quality over raw link count.
          </div>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search domain…"
          style={{ height: 34, borderRadius: 8, border: '1px solid #E2E8F0', padding: '0 12px', minWidth: 180 }}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.6fr) 56px 64px 64px 56px',
        gap: 8,
        fontSize: 10,
        fontWeight: 800,
        color: '#94A3B8',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        <span>Domain</span>
        <span style={{ textAlign: 'center' }}>DR</span>
        <span style={{ textAlign: 'center' }}>Links</span>
        <span style={{ textAlign: 'center' }}>Do</span>
        <span style={{ textAlign: 'center' }}>Live</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#94A3B8', padding: '20px 0' }}>Loading referring domains…</div>
      ) : !filtered.length ? (
        <div style={{ fontSize: 12, color: '#94A3B8', padding: '20px 0' }}>
          No referring domains yet. Run Discover / DataForSEO sync to populate.
        </div>
      ) : (
        filtered.map((d) => (
          <button
            key={d.domain}
            type="button"
            onClick={() => onFilterDomain?.(d.domain)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.6fr) 56px 64px 64px 56px',
              gap: 8,
              width: '100%',
              alignItems: 'center',
              border: 0,
              background: 'transparent',
              padding: '9px 0',
              borderBottom: '1px solid #F1F5F9',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <BrandFavicon name={d.domain} size={16} />
              <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.domain}
              </span>
              {d.broken > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626' }}>{d.broken} broken</span>
              )}
            </div>
            <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 800 }}>{d.rank}</span>
            <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{d.backlinks}</span>
            <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#16A34A' }}>{d.dofollow}</span>
            <span style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#2563EB' }}>{d.live}</span>
          </button>
        ))
      )}
    </Card>
  )
}

function BacklinkGapPanel({ siteId, onSaved }) {
  const [youDomain, setYouDomain] = useState('')
  const [inputs, setInputs] = useState([''])
  const [savedCompetitors, setSavedCompetitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [result, setResult] = useState(null)

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
      setSavedCompetitors(list)
      if (list.length) {
        setInputs(list.slice(0, 4).map((c) => c.name).concat(list.length < 4 ? [''] : []).slice(0, 4))
      }
    }).finally(() => setLoading(false))
  }, [siteId])

  const normalizeDomain = (raw) => {
    const v = String(raw || '').trim()
    if (!v) return ''
    const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
    return new URL(w).hostname.replace(/^www\./i, '').toLowerCase()
  }

  const setInputAt = (i, value) => {
    setInputs((prev) => prev.map((x, idx) => (idx === i ? value : x)))
  }

  const addSlot = () => {
    if (inputs.length >= 4) return
    setInputs((prev) => [...prev, ''])
  }

  const autoDiscover = async () => {
    setDiscovering(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/competitors/auto-discover`)
      const list = Array.isArray(data?.competitors) ? data.competitors : []
      setSavedCompetitors(list)
      setInputs(list.slice(0, 4).map((c) => c.name).concat(['']).slice(0, Math.max(2, Math.min(4, list.length || 1))))
      toast.success(data?.inserted ? `Found ${data.inserted} competitors` : 'Competitors refreshed')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Auto-discover failed')
    }
    setDiscovering(false)
  }

  const findProspects = async () => {
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
      // Persist typed domains so Keywords gap / Competitors stay in sync
      for (const d of unique) {
        await api.post(`/sites/${siteId}/competitors`, { name: d, url: `https://${d}` }).catch(() => {})
      }
      const { data } = await api.post(`/sites/${siteId}/backlinks/competitor-compare`, {
        domains: unique,
        limit: 25,
      })
      setResult(data)
      if (!data?.linkGap?.length) toast('No link-gap prospects found for these competitors yet')
      else toast.success(`Found ${data.linkGap.length} link-gap prospects`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Backlink gap failed')
    }
    setRunning(false)
  }

  const saveProspect = async (gap) => {
    try {
      await api.post(`/sites/${siteId}/backlink-opportunities`, {
        sourceDomain: gap.domain,
        sourceUrl: `https://${gap.domain}/`,
        strategy: `Links to ${gap.vsCompetitor} but not you`,
        opportunityType: 'competitor-link-gap',
        relevance: 'High',
        estimatedDR: Number(gap.rank || 0),
        evidence: `Backlink gap vs ${gap.vsCompetitor}`,
        status: 'Prospect',
        source: 'backlink-gap',
      })
      toast.success('Saved as opportunity')
      onSaved?.()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not save')
    }
  }

  return (
    <Card>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
          <FontAwesomeIcon icon={faCodeCompare} style={{ marginRight: 8, color: '#EA580C' }} />
          Backlink gap
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 1.45 }}>
          Find websites that link to your competitors but not to you — the best outreach prospects.
        </div>
      </div>

      <div style={{
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 14,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        marginBottom: 14,
      }}>
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
                flex: 1, minWidth: 180, height: 38, borderRadius: 8,
                border: '1px solid #FED7AA', background: '#FFFBEB', padding: '0 12px', fontWeight: 700,
              }}
            />
            <span style={{ fontSize: 11, color: '#94A3B8' }}>Root domain</span>
          </div>

          {inputs.map((val, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#334155', background: '#F1F5F9',
                borderRadius: 6, padding: '4px 8px', minWidth: 44, textAlign: 'center',
              }}>
                C{i + 1}
              </span>
              <input
                value={val}
                onChange={(e) => setInputAt(i, e.target.value)}
                placeholder="Add competitor domain"
                style={{
                  flex: 1, minWidth: 180, height: 38, borderRadius: 8,
                  border: '1px solid #E2E8F0', padding: '0 12px',
                }}
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
              <GhostBtn onClick={addSlot}>+ Add up to {4 - inputs.length} more</GhostBtn>
            )}
            <GhostBtn onClick={autoDiscover} disabled={discovering || loading}>
              <FontAwesomeIcon icon={discovering ? faRotate : faWandMagicSparkles} spin={discovering} style={{ marginRight: 6 }} />
              {discovering ? 'Discovering…' : 'Auto-fill competitors'}
            </GhostBtn>
          </div>
          <OrangeBtn onClick={findProspects} disabled={running || loading}>
            <FontAwesomeIcon icon={running ? faRotate : faChartColumn} spin={running} style={{ marginRight: 6 }} />
            {running ? 'Finding prospects…' : 'Find prospects'}
          </OrangeBtn>
        </div>
      </div>

      {result?.you && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
            Profile comparison
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <div style={{ padding: 12, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#C2410C' }}>You · {result.yourDomain}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{result.you.referringDomains ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>ref. domains · {result.you.backlinks ?? '—'} links</div>
            </div>
            {(result.competitors || []).map((c) => (
              <div key={c.domain} style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0F172A' }}>{c.domain}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{c.referringDomains ?? '—'}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  ref. domains · {c.backlinks ?? '—'} links
                  {c.deltaRefDomains != null ? ` · gap ${c.deltaRefDomains > 0 ? '+' : ''}${c.deltaRefDomains}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(result?.linkGap) && result.linkGap.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
            Prospects ({result.linkGap.length}) — link to competitor, not you
          </div>
          {result.linkGap.map((g) => (
            <div
              key={`${g.domain}-${g.vsCompetitor}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid #F1F5F9',
              }}
            >
              <BrandFavicon name={g.domain} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.domain}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>
                  Links to {g.vsCompetitor} · Rank {g.rank || 0}
                </div>
              </div>
              <OrangeBtn onClick={() => saveProspect(g)} style={{ height: 32, fontSize: 11 }}>
                <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} />
                Save prospect
              </OrangeBtn>
            </div>
          ))}
        </div>
      )}

      {!result && !running && (
        <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
          How it works: we compare referring domains for you vs competitors and return sites that link to them but not you.
          {savedCompetitors.length ? ` ${savedCompetitors.length} saved competitor(s) ready to use.` : ''}
        </div>
      )}
    </Card>
  )
}

export default function BacklinkCompetitiveHub({
  siteId,
  backlinks = [],
  backlinkSummary = null,
  activeTab,
  onTabChange,
  onFilterDomain,
  overviewContent,
  onReload,
}) {
  const brokenCount = useMemo(
    () =>
      backlinks.filter(
        (b) =>
          b.is_broken === true ||
          Number(b.http_status) >= 400 ||
          String(b.verification_status || '').toLowerCase() === 'broken'
      ).length,
    [backlinks]
  )

  const tab = activeTab || 'overview'

  return (
    <div>
      <TabBar
        active={tab}
        onChange={onTabChange}
        counts={{
          broken: brokenCount || backlinkSummary?.broken || 0,
          referring: backlinkSummary?.referringDomains || undefined,
        }}
      />

      {tab === 'overview' && (
        <>
          {backlinkSummary && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}>
              <MetricCard label="Live backlinks" value={backlinkSummary.totalBacklinks || 0} />
              <MetricCard label="Referring domains" value={backlinkSummary.referringDomains || 0} accent="var(--blue)" />
              <MetricCard label="Broken" value={backlinkSummary.broken || brokenCount || 0} accent="var(--red)" />
              <MetricCard label="Lost" value={backlinkSummary.lost || 0} accent="var(--amber)" />
              <MetricCard label="New 30d" value={backlinkSummary.new30d || 0} accent="var(--purple)" />
              <MetricCard label="Opportunities" value={backlinkSummary.opportunities || 0} accent="var(--orange)" />
            </div>
          )}
          {overviewContent}
        </>
      )}

      {tab === 'broken' && (
        <BrokenPanel
          backlinks={backlinks}
          onFilter={(domain) => {
            onTabChange?.('overview')
            onFilterDomain?.(domain)
          }}
        />
      )}

      {tab === 'referring' && (
        <ReferringDomainsPanel
          siteId={siteId}
          onFilterDomain={(domain) => {
            onTabChange?.('overview')
            onFilterDomain?.(domain)
          }}
        />
      )}

      {tab === 'gap' && (
        <BacklinkGapPanel siteId={siteId} onSaved={onReload} />
      )}
    </div>
  )
}
