import { useState, useMemo, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faTriangleExclamation, faSort,
  faSortUp, faSortDown, faFileExport, faEllipsisVertical,
  faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import {
  classifyBacklink,
  getDomainRank,
  getQualityScore,
  QUALITY_META,
  summarizeBacklinkQuality,
} from '../utils/backlinkQuality'

const PAGE_SIZE = 5

function normalizeUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try { return new URL(w).href } catch { return v }
}

function getHostname(raw) {
  try { return new URL(normalizeUrl(raw)).hostname.replace(/^www\./i, '') }
  catch { return String(raw || '').trim().replace(/^www\./i, '') }
}

function getPathDisplay(raw) {
  try {
    const u = new URL(normalizeUrl(raw))
    const path = `${u.pathname || '/'}${u.search || ''}`
    if (!path || path === '/') return '/'
    return path.length > 42 ? `${path.slice(0, 40)}…` : path
  } catch {
    return ''
  }
}

function getTraffic(b) {
  const n = Number(
    b?.page_traffic ||
    b?.traffic ||
    b?.provider_traffic ||
    b?.verification_evidence?.pageTraffic ||
    b?.verification_evidence?.traffic ||
    0
  )
  return Number.isFinite(n) ? n : 0
}

function formatTraffic(n) {
  const v = Number(n || 0)
  if (!v) return '—'
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(Math.round(v))
}

function getFirstSeen(b) {
  return b.provider_first_seen || b.first_seen || b.created_at || null
}

function getLastSeen(b) {
  return b.provider_last_seen || b.last_seen || b.verified_at || b.last_checked || null
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isNewBacklink(b) {
  const first = getFirstSeen(b)
  if (!first) return false
  const age = Date.now() - new Date(first).getTime()
  return age >= 0 && age <= 30 * 24 * 60 * 60 * 1000
}

function isLostBacklink(b) {
  return (
    b.is_lost === true ||
    String(b.status || '').toLowerCase() === 'lost' ||
    String(b.verification_status || '').toLowerCase() === 'lost'
  )
}

function TypeBadge({ type }) {
  const t = String(type || 'dofollow').toLowerCase()
  const good = t === 'dofollow'
  return (
    <span className={`bl-type-badge bl-type-badge--${good ? 'do' : 'no'}`}>
      {good ? 'Dofollow' : 'Nofollow'}
    </span>
  )
}

function StatusBadge({ status, id, onChange }) {
  const map = {
    Live: { cls: 'bl-status--live' },
    Pending: { cls: 'bl-status--pending' },
    Todo: { cls: 'bl-status--todo' },
  }
  const cfg = map[status] || map.Todo
  return (
    <select
      value={status}
      onChange={e => onChange(id, e.target.value)}
      className={`bl-status-sel ${cfg.cls}`}
    >
      <option>Todo</option>
      <option>Pending</option>
      <option>Live</option>
    </select>
  )
}

function DrBadge({ dr }) {
  const n = Number(dr || 0)
  let bg = '#fee2e2'
  let color = '#b91c1c'
  if (n >= 70) { bg = '#dcfce7'; color = '#15803d' }
  else if (n >= 40) { bg = '#fef9c3'; color = '#a16207' }
  else if (n >= 20) { bg = '#ffedd5'; color = '#c2410c' }
  return (
    <span className="bl-dr-badge" style={{ background: bg, color }}>
      {n}
    </span>
  )
}

function QualityBadge({ backlink }) {
  const key = classifyBacklink(backlink)
  const meta = QUALITY_META[key]
  const score = getQualityScore(backlink)
  return (
    <span
      className="bl-quality-badge"
      title={meta.hint}
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
      <span className="bl-quality-score">{score}</span>
    </span>
  )
}

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <FontAwesomeIcon icon={faSort} className="bl-sort-icon" />
  return <FontAwesomeIcon icon={sort.dir === 'asc' ? faSortUp : faSortDown} className="bl-sort-icon bl-sort-icon--active" />
}

function sourceConfig(source, isAdmin) {
  const value = String(source || 'manual').toLowerCase()
  if (value === 'dataforseo') {
    return isAdmin
      ? { cls: 'dataforseo', label: 'DataForSEO' }
      : { cls: 'detected', label: 'Detected' }
  }
  if (value === 'crawled') return { cls: 'crawled', label: 'Crawled' }
  if (value === 'csv') return { cls: 'csv', label: 'Imported' }
  if (value === 'domain') return { cls: 'domain', label: 'Domain' }
  return { cls: 'manual', label: 'Manual' }
}

const QUALITY_VIEWS = {
  all: 'All',
  good: 'Good',
  ok: 'OK',
  risk: 'Risk',
  spam: 'Spam',
}

export default function BacklinksTable({
  backlinks,
  loading,
  onUpdateStatus,
  onRemove,
  searchSeed = '',
  searchSeedKey = 0,
  qualityView = 'all',
  typeLens = 'All',
  onQualityViewChange,
}) {
  const { user } = useAuth()
  const isAdmin = Number(user?.id) === 1
  const [typeFilter, setTypeFilter] = useState(typeLens || 'All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [qualityFilter, setQualityFilter] = useState(
    QUALITY_VIEWS[qualityView] || 'All'
  )
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ field: 'quality', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    setQualityFilter(QUALITY_VIEWS[qualityView] || 'All')
  }, [qualityView])

  useEffect(() => {
    setTypeFilter(typeLens || 'All')
  }, [typeLens])

  useEffect(() => {
    if (!searchSeedKey) return
    setSearch(searchSeed || '')
    setTypeFilter('All')
    setStatusFilter('All')
    setQualityFilter('All')
    setPage(1)
  }, [searchSeedKey, searchSeed])

  useEffect(() => {
    const close = () => setOpenMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const toggleSort = (field) => {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'desc' })
  }

  const setQuality = (key) => {
    setQualityFilter(key)
    if (typeof onQualityViewChange === 'function') {
      const view =
        key === 'Good' ? 'good'
          : key === 'OK' ? 'ok'
            : key === 'Risk' ? 'risk'
              : key === 'Spam' ? 'spam'
                : 'all'
      onQualityViewChange(view)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return backlinks.filter(b => {
      if (typeFilter === 'Dofollow' || typeFilter === 'Nofollow') {
        if ((b.type || 'dofollow').toLowerCase() !== typeFilter.toLowerCase()) return false
      }
      if (typeFilter === 'New' && !isNewBacklink(b)) return false
      if (typeFilter === 'Lost' && !isLostBacklink(b)) return false
      if (typeFilter === 'Broken') {
        const broken =
          b.is_broken === true ||
          Number(b.http_status) >= 400 ||
          String(b.verification_status || '').toLowerCase() === 'broken'
        if (!broken) return false
      }
      if (statusFilter !== 'All' && b.status !== statusFilter) return false

      const bucket = classifyBacklink(b)
      if (qualityFilter === 'Good' && bucket !== 'good') return false
      if (qualityFilter === 'OK' && bucket !== 'ok') return false
      if (qualityFilter === 'Risk' && bucket !== 'risk') return false
      if (qualityFilter === 'Spam' && bucket !== 'spam') return false

      if (q) {
        const hay = `${b.name || ''} ${b.url || ''} ${b.source_domain || ''} ${b.anchor || ''} ${b.target_url || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [backlinks, typeFilter, statusFilter, qualityFilter, search])

  const sorted = useMemo(() => {
    const { field, dir } = sort
    return [...filtered].sort((a, b) => {
      let av
      let bv
      if (field === 'dr' || field === 'domainRank') {
        av = getDomainRank(a)
        bv = getDomainRank(b)
      } else if (field === 'quality') {
        av = getQualityScore(a)
        bv = getQualityScore(b)
      } else if (field === 'traffic') {
        av = getTraffic(a)
        bv = getTraffic(b)
      } else if (field === 'firstSeen') {
        av = new Date(getFirstSeen(a) || 0).getTime()
        bv = new Date(getFirstSeen(b) || 0).getTime()
      } else if (field === 'lastSeen') {
        av = new Date(getLastSeen(a) || 0).getTime()
        bv = new Date(getLastSeen(b) || 0).getTime()
      } else if (field === 'type') {
        av = String(a.type || 'dofollow').toLowerCase()
        bv = String(b.type || 'dofollow').toLowerCase()
      } else {
        av = String(a[field] || '').toLowerCase()
        bv = String(b[field] || '').toLowerCase()
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sort])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, qualityFilter, search, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(safePage * PAGE_SIZE, sorted.length)
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const pageNumbers = useMemo(() => {
    const maxButtons = 5
    if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const start = Math.max(1, Math.min(safePage - 2, totalPages - maxButtons + 1))
    return Array.from({ length: maxButtons }, (_, i) => start + i)
  }, [totalPages, safePage])

  const qualitySummary = useMemo(
    () => summarizeBacklinkQuality(backlinks),
    [backlinks]
  )

  const exportCsv = () => {
    const headers = [
      'Referring Page', 'URL', 'Anchor', 'Target', 'DR', 'Quality', 'Quality Label',
      'Traffic', 'Type', 'First Seen', 'Last Seen', 'Status', 'Source',
    ]
    const rows = sorted.map(b => [
      getHostname(b.url || b.source_domain || b.name),
      b.url || '',
      b.anchor || '',
      b.target_url || '',
      getDomainRank(b),
      getQualityScore(b),
      QUALITY_META[classifyBacklink(b)].label,
      getTraffic(b),
      b.type || 'dofollow',
      getFirstSeen(b) || '',
      getLastSeen(b) || '',
      b.status || '',
      b.source || 'manual',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'backlinks.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const dofollow = backlinks.filter(b => (b.type || 'dofollow') === 'dofollow').length
  const nofollow = backlinks.filter(b => b.type === 'nofollow').length
  const newCount = backlinks.filter(isNewBacklink).length
  const lostCount = backlinks.filter(isLostBacklink).length
  const brokenCount = backlinks.filter(b =>
    b.is_broken === true ||
    Number(b.http_status) >= 400 ||
    String(b.verification_status || '').toLowerCase() === 'broken'
  ).length

  if (loading) return <div className="bl-empty">Loading…</div>

  return (
    <div className="bl-wrap">
      <div className="bl-topbar">
        <div className="bl-tabs">
          {[
            { key: 'All', label: 'All', count: qualitySummary.total },
            { key: 'Good', label: 'Good', count: qualitySummary.good, tone: 'good' },
            { key: 'OK', label: 'OK', count: qualitySummary.ok, tone: 'ok' },
            { key: 'Risk', label: 'Risk', count: qualitySummary.risk, tone: 'risk' },
            { key: 'Spam', label: 'Spam', count: qualitySummary.spam, tone: 'spam' },
          ].map(t => (
            <button
              key={t.key}
              className={`bl-tab${qualityFilter === t.key ? ' bl-tab--active' : ''}${t.tone === 'spam' ? ' bl-tab--red' : ''}${t.tone === 'good' ? ' bl-tab--good' : ''}${t.tone === 'risk' ? ' bl-tab--risk' : ''}`}
              onClick={() => setQuality(t.key)}
            >
              {t.key === 'Spam' && (
                <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />
              )}
              {t.label}
              <span className={`bl-tab-count${t.tone === 'spam' ? ' bl-tab-count--red' : ''}`}>
                {t.count}
              </span>
            </button>
          ))}
          <span className="bl-tab-sep" />
          {[
            { key: 'Dofollow', label: 'Dofollow', count: dofollow },
            { key: 'Nofollow', label: 'Nofollow', count: nofollow },
            { key: 'New', label: 'New', count: newCount },
            { key: 'Lost', label: 'Lost', count: lostCount },
            { key: 'Broken', label: 'Broken', count: brokenCount },
          ].map(t => (
            <button
              key={t.key}
              className={`bl-tab${typeFilter === t.key ? ' bl-tab--active' : ''}`}
              onClick={() => setTypeFilter(prev => (prev === t.key ? 'All' : t.key))}
            >
              {t.label}
              <span className="bl-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="bl-toolbar">
          <input
            className="bl-search"
            placeholder="Search by domain, anchor, URL…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="bl-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="All">All statuses</option>
            <option>Todo</option>
            <option>Pending</option>
            <option>Live</option>
          </select>
          <button className="bl-export-btn" onClick={exportCsv} title="Export CSV">
            <FontAwesomeIcon icon={faFileExport} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bl-count-row">
        <span className="bl-count">
          {qualityFilter === 'All' ? 'All backlinks' : `${qualityFilter} backlinks`}{' '}
          {sorted.length}
        </span>
        {(search || typeFilter !== 'All' || statusFilter !== 'All' || qualityFilter !== 'All') && (
          <button
            className="bl-clear"
            onClick={() => {
              setSearch('')
              setTypeFilter('All')
              setStatusFilter('All')
              setQuality('All')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="bl-empty">No backlinks match these filters.</div>
      ) : (
        <>
          <div className="bl-table-scroll">
            <table className="bl-table bl-table--industry">
              <thead>
                <tr>
                  <th className="bl-th-domain" onClick={() => toggleSort('name')}>
                    Referring page <SortIcon field="name" sort={sort} />
                  </th>
                  <th onClick={() => toggleSort('anchor')}>
                    Anchor &amp; target URL <SortIcon field="anchor" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('domainRank')}>
                    DR <SortIcon field="domainRank" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('quality')}>
                    Quality <SortIcon field="quality" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('traffic')}>
                    Traffic <SortIcon field="traffic" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('type')}>
                    Type <SortIcon field="type" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('firstSeen')}>
                    First seen <SortIcon field="firstSeen" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('lastSeen')}>
                    Last seen <SortIcon field="lastSeen" sort={sort} />
                  </th>
                  <th className="bl-th-center">Status</th>
                  <th className="bl-th-center">Source</th>
                  <th className="bl-th-center" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(b => {
                  const qualityKey = classifyBacklink(b)
                  const source = sourceConfig(b.source, isAdmin)
                  const host = getHostname(b.url || b.source_domain || b.name)
                  const path = getPathDisplay(b.url)
                  const target = b.target_url
                    ? normalizeUrl(b.target_url).replace(/^https?:\/\//, '')
                    : ''

                  return (
                    <tr
                      key={b.id}
                      className={
                        qualityKey === 'spam'
                          ? 'bl-row-spam'
                          : qualityKey === 'risk'
                            ? 'bl-row-risk'
                            : qualityKey === 'good'
                              ? 'bl-row-good'
                              : ''
                      }
                    >
                      <td className="bl-td-domain">
                        <div className="bl-domain-name">
                          {host || b.name || '—'}
                          {qualityKey === 'spam' && (
                            <span className="bl-spam-badge">
                              <FontAwesomeIcon icon={faTriangleExclamation} />SPAM
                            </span>
                          )}
                        </div>
                        {b.url && (
                          <a
                            href={normalizeUrl(b.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bl-page-url"
                          >
                            {path || getHostname(b.url)}
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                          </a>
                        )}
                      </td>

                      <td className="bl-td-anchor">
                        <span className="bl-anchor-text">
                          {b.anchor || <em className="bl-no-anchor">No anchor text</em>}
                        </span>
                        {target && (
                          <span className="bl-target-url" title={target}>
                            {target.length > 55 ? `${target.slice(0, 53)}…` : target}
                          </span>
                        )}
                      </td>

                      <td className="bl-td-center">
                        <DrBadge dr={getDomainRank(b)} />
                      </td>

                      <td className="bl-td-center">
                        <QualityBadge backlink={b} />
                      </td>

                      <td className="bl-td-center bl-td-traffic">
                        {formatTraffic(getTraffic(b))}
                      </td>

                      <td className="bl-td-center">
                        <TypeBadge type={b.type} />
                      </td>

                      <td className="bl-td-center bl-td-date">
                        {formatDate(getFirstSeen(b))}
                      </td>

                      <td className="bl-td-center bl-td-date">
                        {formatDate(getLastSeen(b))}
                      </td>

                      <td className="bl-td-center">
                        <StatusBadge status={b.status} id={b.id} onChange={onUpdateStatus} />
                      </td>

                      <td className="bl-td-center">
                        <span className={`bl-source-badge bl-source-badge--${source.cls}`}>
                          {source.label}
                        </span>
                      </td>

                      <td className="bl-td-center bl-td-actions">
                        <div className="bl-row-menu">
                          <button
                            type="button"
                            className="bl-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(prev => (prev === b.id ? null : b.id))
                            }}
                          >
                            <FontAwesomeIcon icon={faEllipsisVertical} />
                          </button>
                          {openMenuId === b.id && (
                            <div className="bl-menu-pop" onClick={(e) => e.stopPropagation()}>
                              {b.url && (
                                <a
                                  href={normalizeUrl(b.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bl-menu-item"
                                >
                                  Open referring page
                                </a>
                              )}
                              <button
                                type="button"
                                className="bl-menu-item bl-menu-item--danger"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  onRemove(b.id)
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bl-pager">
            <span className="bl-pager-meta">
              {pageStart}–{pageEnd} of {sorted.length}
            </span>
            <div className="bl-pager-btns">
              <button
                type="button"
                className="bl-pager-btn"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`bl-pager-btn${n === safePage ? ' bl-pager-btn--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="bl-pager-btn"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
