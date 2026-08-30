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
import CollapsibleSection from './CollapsibleSection'
import api from '../utils/api'
import toast from '../utils/toast'
import { summarizeBacklinkQuality } from '../utils/backlinkQuality'

const TABS = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Overview' },
  { id: 'broken', label: 'Broken backlinks', mobileLabel: 'Broken' },
  { id: 'referring', label: 'Referring domains', mobileLabel: 'Domains' },
  { id: 'gap', label: 'Backlink gap', mobileLabel: 'Gap' },
]

function TabBar({ active, onChange, counts = {} }) {
  return (
    <div className="bl-hub-tabs" role="tablist" aria-label="Backlink views">
      {TABS.map((tab) => {
        const isActive = active === tab.id
        const count = counts[tab.id]

        return (
          <button
            className={`bl-hub-tab${isActive ? ' bl-hub-tab--active' : ''}`}
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
          >
            <span className="bl-hub-tab__desktop">{tab.label}</span>
            <span className="bl-hub-tab__mobile">{tab.mobileLabel}</span>
            {count != null ? <span className="bl-hub-tab__count">{count}</span> : null}
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
      <CollapsibleSection
        title="Broken backlinks"
        subtitle="Links to your site that hit a broken target URL. Fix the page or 301-redirect to reclaim equity."
        icon={<FontAwesomeIcon icon={faLinkSlash} style={{ color: '#DC2626' }} />}
        defaultOpen
        right={<span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{broken.length}</span>}
      >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {broken.slice(0, 50).map((b) => {
          const domain = b.source_domain || b.name || '-'
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
                    {b.url || b.source_url || '-'}
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
      </CollapsibleSection>
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
      <CollapsibleSection
        title="Referring domains"
        subtitle="Unique websites linking to you - quality over raw link count."
        icon={<FontAwesomeIcon icon={faGlobe} style={{ color: '#2563EB' }} />}
        defaultOpen
        right={
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain…"
            onClick={(e) => e.stopPropagation()}
            style={{ height: 34, borderRadius: 8, border: '1px solid #E2E8F0', padding: '0 12px', minWidth: 160 }}
          />
        }
      >
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
      </CollapsibleSection>
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
  const [profilePage, setProfilePage] = useState(1)
  const [prospectPage, setProspectPage] = useState(1)

  const PROFILE_PAGE_SIZE = 2
  const PROSPECT_PAGE_SIZE = 10

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
      const { data } = await api.post(`/sites/${siteId}/competitors/auto-discover`, { prune: true })
      const list = Array.isArray(data?.competitors) ? data.competitors : []
      setSavedCompetitors(list)
      const names = list.map((c) => String(c?.name || '').trim()).filter(Boolean)
      if (!names.length) {
        toast.error(data?.error || 'No competitors returned. Add a Business description on Competitors, or type a domain in C1.')
        if (data?.tip) toast(data.tip)
        return
      }
      const filled = names.slice(0, 4)
      if (filled.length < 4) filled.push('')
      setInputs(filled)
      const parts = []
      if (data?.pruned) parts.push(`removed ${data.pruned} off-niche`)
      if (data?.inserted) parts.push(`added ${data.inserted}`)
      if (data?.updated) parts.push(`updated ${data.updated}`)
      toast.success(parts.length ? `Competitors refreshed (${parts.join(', ')})` : `Loaded ${names.length} competitor${names.length === 1 ? '' : 's'}`)
      if (data?.tip) toast(data.tip)
    } catch (e) {
      const msg = e?.response?.data?.error || 'Auto-discover failed'
      toast.error(msg)
      if (e?.response?.data?.tip) toast(e.response.data.tip)
      // Still try to show whatever is already saved
      try {
        const r = await api.get(`/sites/${siteId}/competitors`)
        const list = Array.isArray(r.data) ? r.data : []
        setSavedCompetitors(list)
        const names = list.map((c) => String(c?.name || '').trim()).filter(Boolean)
        if (names.length) {
          const filled = names.slice(0, 4)
          if (filled.length < 4) filled.push('')
          setInputs(filled.slice(0, 4))
        }
      } catch { /* ignore */ }
    } finally {
      setDiscovering(false)
    }
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
      setProfilePage(1)
      setProspectPage(1)
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
      <CollapsibleSection
        title="Backlink gap"
        subtitle="Find websites that link to your competitors but not to you - the best outreach prospects. Use same-niche agencies only."
        icon={<FontAwesomeIcon icon={faCodeCompare} style={{ color: '#EA580C' }} />}
        defaultOpen
      >
        <div style={{
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 14,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
            Competitors setup
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.4 }}>
            Your domain + up to 4 same-niche competitors. Then Find prospects.
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
                  flex: 1, minWidth: 180, height: 38, borderRadius: 8,
                  border: '1px solid #FED7AA', background: '#FFFBEB', padding: '0 12px', fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Root domain</span>
            </div>

            {inputs.map((val, i) => {
              const meta = savedCompetitors.find(
                (c) => String(c.name || '').toLowerCase() === String(val || '').toLowerCase()
              )
              return (
                <div key={i} style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: 10,
                  background: '#fff',
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: '#334155', background: '#F1F5F9',
                      borderRadius: 6, padding: '4px 8px', minWidth: 44, textAlign: 'center',
                    }}>
                      C{i + 1}
                    </span>
                    <input
                      value={val}
                      onChange={(e) => setInputAt(i, e.target.value)}
                      placeholder="Add competitor domain (same niche)"
                      style={{
                        flex: 1, minWidth: 180, height: 38, borderRadius: 8,
                        border: '1px solid #E2E8F0', padding: '0 12px',
                      }}
                    />
                    {meta?.dr != null && Number(meta.dr) > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: '#0F172A',
                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                        borderRadius: 6, padding: '4px 8px',
                      }}>
                        DR {meta.dr}
                      </span>
                    )}
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
                  {(meta?.industry || meta?.summary || meta?.location || meta?.notes) && (
                    <div style={{ marginTop: 8, paddingLeft: 54 }}>
                      {meta.industry && (
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', marginBottom: 2 }}>
                          {meta.industry}
                          {meta.location ? ` · ${meta.location}` : ''}
                        </div>
                      )}
                      {(meta.summary || meta.notes) && (
                        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                          {meta.summary || meta.notes}
                        </div>
                      )}
                      {meta.title && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{meta.title}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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

        {result?.you && (() => {
          const comps = result.competitors || []
          const profilePages = Math.max(1, Math.ceil(comps.length / PROFILE_PAGE_SIZE))
          const page = Math.min(profilePage, profilePages)
          const slice = comps.slice((page - 1) * PROFILE_PAGE_SIZE, page * PROFILE_PAGE_SIZE)
          return (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>Profile comparison</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>Referring domains, links, and rank vs competitors.</div>
                </div>
                {comps.length > PROFILE_PAGE_SIZE && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setProfilePage((p) => Math.max(1, p - 1))}
                      style={{
                        border: '1px solid #E2E8F0', background: '#fff', borderRadius: 6,
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        opacity: page <= 1 ? 0.5 : 1,
                      }}
                    >
                      Prev
                    </button>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>
                      {page} / {profilePages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= profilePages}
                      onClick={() => setProfilePage((p) => Math.min(profilePages, p + 1))}
                      style={{
                        border: '1px solid #E2E8F0', background: '#fff', borderRadius: 6,
                        padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: page >= profilePages ? 'not-allowed' : 'pointer',
                        opacity: page >= profilePages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                <div style={{ padding: 12, borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#C2410C' }}>You · {result.yourDomain}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{result.you.referringDomains ?? '-'}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    ref. domains · {result.you.backlinks ?? '-'} links · rank {result.you.rank ?? '-'}
                  </div>
                </div>
                {slice.map((c) => {
                  const saved = savedCompetitors.find(
                    (s) => String(s.name || '').toLowerCase() === String(c.domain || '').toLowerCase()
                  )
                  const industry = c.industry || saved?.industry || ''
                  const summary = c.summary || saved?.summary || c.notes || saved?.notes || ''
                  const location = c.location || saved?.location || ''
                  const title = c.title || saved?.title || ''
                  return (
                    <div key={c.domain} style={{ padding: 12, borderRadius: 10, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>{c.domain}</div>
                      {(industry || location) && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', marginTop: 3 }}>
                          {[industry, location].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {summary && (
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, lineHeight: 1.35 }}>
                          {String(summary).slice(0, 120)}{String(summary).length > 120 ? '…' : ''}
                        </div>
                      )}
                      {title && title !== summary && (
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{String(title).slice(0, 80)}</div>
                      )}
                      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{c.referringDomains ?? '-'}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        ref. domains · {c.backlinks ?? '-'} links · rank {c.rank ?? c.savedDr ?? '-'}
                        {c.deltaRefDomains != null ? ` · gap ${c.deltaRefDomains > 0 ? '+' : ''}${c.deltaRefDomains}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {Array.isArray(result?.linkGap) && result.linkGap.length > 0 && (() => {
          const gaps = result.linkGap
          const prospectPages = Math.max(1, Math.ceil(gaps.length / PROSPECT_PAGE_SIZE))
          const page = Math.min(prospectPage, prospectPages)
          const slice = gaps.slice((page - 1) * PROSPECT_PAGE_SIZE, page * PROSPECT_PAGE_SIZE)
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                    Prospects ({gaps.length})
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Sites that link to a competitor, not you.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setProspectPage((p) => Math.max(1, p - 1))}
                    style={{
                      border: '1px solid #E2E8F0', background: '#fff', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: page <= 1 ? 'not-allowed' : 'pointer',
                      opacity: page <= 1 ? 0.5 : 1,
                    }}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700 }}>
                    {page} / {prospectPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= prospectPages}
                    onClick={() => setProspectPage((p) => Math.min(prospectPages, p + 1))}
                    style={{
                      border: '1px solid #E2E8F0', background: '#fff', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: page >= prospectPages ? 'not-allowed' : 'pointer',
                      opacity: page >= prospectPages ? 0.5 : 1,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
              {slice.map((g) => (
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
          )
        })()}

        {!result && !running && (
          <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
            Follow the steps above: add competitors → Find prospects → save outreach targets.
            {savedCompetitors.length ? ` ${savedCompetitors.length} saved competitor(s) ready to use.` : ''}
          </div>
        )}
      </CollapsibleSection>
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

  const qualitySummary = useMemo(
    () => summarizeBacklinkQuality(backlinks),
    [backlinks]
  )

  const localLive = useMemo(
    () => backlinks.filter((link) =>
      link.is_live === true ||
      String(link.status || '').toLowerCase() === 'live'
    ).length,
    [backlinks]
  )

  const localDomains = useMemo(() => {
    const domains = backlinks
      .map((link) => {
        const raw = link.source_domain || link.name || link.url || ''
        try {
          const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
          return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
        } catch {
          return String(raw).trim().toLowerCase()
        }
      })
      .filter(Boolean)

    return new Set(domains).size
  }, [backlinks])

  const summary = {
    live: Number(backlinkSummary?.totalBacklinks ?? localLive),
    domains: Number(backlinkSummary?.referringDomains ?? localDomains),
    new30d: Number(backlinkSummary?.new30d ?? 0),
    attention: qualitySummary.risk + qualitySummary.spam,
  }

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
          <div className="bl-primary-summary">
            <MetricCard label="Live backlinks" value={summary.live} scoreKey="liveBacklinks" />
            <MetricCard label="Referring domains" value={summary.domains} accent="var(--blue)" scoreKey="referringDomainsCount" />
            <MetricCard label="New 30d" value={summary.new30d} accent="var(--purple)" scoreKey="newBacklinks30d" />
            <MetricCard label="Needs attention" value={summary.attention} accent="var(--red)" scoreKey="spam" />
          </div>
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
