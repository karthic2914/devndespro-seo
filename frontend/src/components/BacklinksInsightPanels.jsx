import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { BrandFavicon } from './SiteFavicon'
import api from '../utils/api'
import { useAuth } from '../hooks/useAuth'

function domainOf(b) {
  const raw = b.source_domain || b.name || b.url || ''
  try {
    if (String(raw).includes('://') || String(raw).includes('.')) {
      const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname
      return host.replace(/^www\./i, '').toLowerCase()
    }
  } catch { /* ignore */ }
  return String(raw || '').replace(/^www\./i, '').toLowerCase() || 'unknown'
}

function monthKey(date) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

function buildGrowth(backlinks, months = 12) {
  const now = new Date()
  const keys = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const events = backlinks.map(b => {
    const t = b.first_seen || b.created_at || b.verified_at || b.last_seen
    return { key: monthKey(t), domain: domainOf(b) }
  }).filter(e => e.key)

  return keys.map(key => {
    const upTo = events.filter(e => e.key <= key)
    const domains = new Set(upTo.map(e => e.domain))
    return {
      key,
      label: monthLabel(key),
      backlinks: upTo.length,
      referringDomains: domains.size,
    }
  })
}

function topReferringDomains(backlinks, limit = 5) {
  const map = new Map()
  for (const b of backlinks) {
    const domain = domainOf(b)
    if (!domain || domain === 'unknown') continue
    const entry = map.get(domain) || {
      domain,
      backlinks: 0,
      dofollow: 0,
      dr: 0,
    }
    entry.backlinks += 1
    if (String(b.type || 'dofollow').toLowerCase() === 'dofollow') entry.dofollow += 1
    entry.dr = Math.max(entry.dr, Number(b.provider_rank || b.dr || 0))
    map.set(domain, entry)
  }
  return [...map.values()]
    .sort((a, b) => b.backlinks - a.backlinks || b.dr - a.dr)
    .slice(0, limit)
}

function topAnchors(backlinks, limit = 5) {
  const map = new Map()
  for (const b of backlinks) {
    const anchor = String(b.anchor || '').trim() || '(no anchor)'
    const domain = domainOf(b)
    const entry = map.get(anchor.toLowerCase()) || {
      anchor,
      backlinks: 0,
      domains: new Set(),
    }
    entry.backlinks += 1
    entry.domains.add(domain)
    map.set(anchor.toLowerCase(), entry)
  }
  return [...map.values()]
    .map(e => ({
      anchor: e.anchor,
      backlinks: e.backlinks,
      domains: e.domains.size,
    }))
    .sort((a, b) => b.backlinks - a.backlinks || b.domains - a.domains)
    .slice(0, limit)
}

function PanelHeader({ title, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{title}</div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: 0,
            background: 'transparent',
            color: '#EA580C',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {actionLabel || 'View all →'}
        </button>
      )}
    </div>
  )
}

function DrPill({ dr }) {
  const n = Number(dr || 0)
  const color = n >= 70 ? '#15803d' : n >= 40 ? '#a16207' : n >= 20 ? '#c2410c' : '#b91c1c'
  const bg = n >= 70 ? '#dcfce7' : n >= 40 ? '#fef9c3' : n >= 20 ? '#ffedd5' : '#fee2e2'
  return (
    <span style={{
      display: 'inline-flex',
      minWidth: 28,
      justifyContent: 'center',
      padding: '2px 6px',
      borderRadius: 999,
      background: bg,
      color,
      fontSize: 10,
      fontWeight: 800,
    }}>
      {n}
    </span>
  )
}

export default function BacklinksInsightPanels({
  siteId,
  backlinks = [],
  onFilterDomain,
  onFilterAnchor,
}) {
  const { user } = useAuth()
  const isAdmin = Number(user?.id) === 1
  const [rangeMonths, setRangeMonths] = useState(12)
  const [domainLimit, setDomainLimit] = useState(5)
  const [anchorLimit, setAnchorLimit] = useState(5)
  const [growthLive, setGrowthLive] = useState(null)
  const [growthLoading, setGrowthLoading] = useState(false)
  const [growthMeta, setGrowthMeta] = useState({ source: 'tracked' })

  const localGrowth = useMemo(
    () => buildGrowth(backlinks, rangeMonths),
    [backlinks, rangeMonths]
  )

  useEffect(() => {
    if (!siteId) {
      setGrowthLive(null)
      setGrowthMeta({ source: 'tracked' })
      return undefined
    }

    let cancelled = false
    setGrowthLoading(true)

    api
      .get(`/sites/${siteId}/backlinks/growth`, { params: { months: rangeMonths } })
      .then(({ data }) => {
        if (cancelled) return
        const series = Array.isArray(data?.series) ? data.series : []
        setGrowthLive(series.length ? series : null)
        setGrowthMeta({
          source: data?.source || 'tracked',
          cached: !!data?.cached,
          warning: data?.warning || null,
          cost: data?.cost || 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setGrowthLive(null)
        setGrowthMeta({ source: 'tracked' })
      })
      .finally(() => {
        if (!cancelled) setGrowthLoading(false)
      })

    return () => { cancelled = true }
  }, [siteId, rangeMonths])

  const growth = growthLive?.length ? growthLive : localGrowth
  const domains = useMemo(
    () => topReferringDomains(backlinks, domainLimit),
    [backlinks, domainLimit]
  )
  const anchors = useMemo(
    () => topAnchors(backlinks, anchorLimit),
    [backlinks, anchorLimit]
  )

  const panelStyle = {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 12,
    padding: 14,
    minWidth: 0,
    boxSizing: 'border-box',
  }

  const sourceLabel =
    growthMeta.source === 'dataforseo' ? 'Live' : 'From your links'

  const refreshGrowth = () => {
    if (!siteId || !isAdmin || growthLoading) return
    setGrowthLoading(true)
    api
      .get(`/sites/${siteId}/backlinks/growth`, {
        params: { months: rangeMonths, refresh: 1 },
      })
      .then(({ data }) => {
        const series = Array.isArray(data?.series) ? data.series : []
        setGrowthLive(series.length ? series : null)
        setGrowthMeta({
          source: data?.source || 'tracked',
          cached: !!data?.cached,
          warning: data?.warning || null,
          cost: data?.cost || 0,
        })
      })
      .catch(() => {
        setGrowthLive(null)
        setGrowthMeta({ source: 'tracked' })
      })
      .finally(() => setGrowthLoading(false))
  }

  return (
    <div
      className="bl-insight-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)',
        gap: 12,
        marginBottom: 14,
      }}
    >
      <div className="bl-insight-panel bl-insight-panel--growth" style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Backlink growth</div>
            {isAdmin && (
              <span
                title={growthMeta.warning || undefined}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: growthMeta.source === 'dataforseo' ? '#15803d' : '#64748B',
                  background: growthMeta.source === 'dataforseo' ? '#dcfce7' : '#F1F5F9',
                  borderRadius: 999,
                  padding: '2px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {growthLoading ? 'Loading…' : sourceLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={rangeMonths}
              onChange={e => setRangeMonths(Number(e.target.value))}
              style={{
                height: 30,
                border: '1px solid #E5E7EB',
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 650,
                color: '#475569',
                background: '#fff',
                padding: '0 8px',
              }}
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
            {isAdmin && siteId && (
              <button
                type="button"
                onClick={refreshGrowth}
                disabled={growthLoading}
                title="Refresh live growth data"
                style={{
                  height: 30,
                  border: '1px solid #E5E7EB',
                  borderRadius: 7,
                  background: '#fff',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 10px',
                  cursor: growthLoading ? 'wait' : 'pointer',
                }}
              >
                Refresh
              </button>
            )}
          </div>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          {growthLoading && !growth?.length ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94A3B8', fontSize: 12 }}>
              Loading growth…
            </div>
          ) : growth.every(p => p.backlinks === 0) ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94A3B8', fontSize: 12 }}>
              No dated backlink history yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="backlinks" name="Backlinks" stroke="#7C3AED" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="referringDomains" name="Referring domains" stroke="#2563EB" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div id="bl-source-sites" className="bl-insight-panel bl-insight-panel--sources" style={{ ...panelStyle, scrollMarginTop: 88 }}>
        <PanelHeader
          title="Source sites"
          actionLabel={domainLimit <= 5 ? 'View all →' : 'Show less'}
          onAction={() => setDomainLimit(v => (v <= 5 ? 15 : 5))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 40px 48px 54px', gap: 6, fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>
          <span>Domain</span>
          <span style={{ textAlign: 'center' }}>DR</span>
          <span style={{ textAlign: 'center' }}>Links</span>
          <span style={{ textAlign: 'center' }}>Do</span>
        </div>
        {!domains.length ? (
          <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 0' }}>No referring domains yet.</div>
        ) : domains.map(d => (
          <button
            key={d.domain}
            type="button"
            onClick={() => onFilterDomain?.(d.domain)}
            title="Filter table by this domain"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.4fr) 40px 48px 54px',
              gap: 6,
              alignItems: 'center',
              width: '100%',
              border: 0,
              background: 'transparent',
              padding: '7px 0',
              borderBottom: '1px solid #F3F4F6',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <BrandFavicon name={d.domain} size={16} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.domain}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><DrPill dr={d.dr} /></div>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#334155' }}>{d.backlinks}</span>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#16A34A' }}>{d.dofollow}</span>
          </button>
        ))}
      </div>

      <div id="bl-link-phrases" className="bl-insight-panel bl-insight-panel--phrases" style={{ ...panelStyle, scrollMarginTop: 88 }}>
        <PanelHeader
          title="Link phrases"
          actionLabel={anchorLimit <= 5 ? 'View all →' : 'Show less'}
          onAction={() => setAnchorLimit(v => (v <= 5 ? 15 : 5))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) 54px 54px', gap: 6, fontSize: 10, fontWeight: 700, color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>
          <span>Phrase</span>
          <span style={{ textAlign: 'center' }}>Links</span>
          <span style={{ textAlign: 'center' }}>Domains</span>
        </div>
        {!anchors.length ? (
          <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 0' }}>No anchors yet.</div>
        ) : anchors.map(a => (
          <button
            key={a.anchor}
            type="button"
            onClick={() => onFilterAnchor?.(a.anchor === '(no anchor)' ? '' : a.anchor)}
            title="Filter table by this anchor"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.6fr) 54px 54px',
              gap: 6,
              alignItems: 'center',
              width: '100%',
              border: 0,
              background: 'transparent',
              padding: '7px 0',
              borderBottom: '1px solid #F3F4F6',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.anchor}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#334155' }}>{a.backlinks}</span>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#64748B' }}>{a.domains}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
