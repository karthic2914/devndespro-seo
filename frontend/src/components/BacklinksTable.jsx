import { useState, useMemo, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faTriangleExclamation, faSort,
  faSortUp, faSortDown, faFileExport, faXmark,
  faChevronLeft, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'

const PAGE_SIZE = 10

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SPAM_TLDS = new Set([
  'xyz','party','icu','top','click','link','online','site','website','space',
  'agency','club','buzz','win','bid','loan','review','trade','stream',
  'gdn','gq','tk','ml','cf','ga','racing','date','download','accountant',
  'faith','science','work','men','cricket','webcam','ninja','rest','pw',
])

function normalizeUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try { return new URL(w).href } catch { return v }
}

function getHostname(raw) {
  try { return new URL(normalizeUrl(raw)).hostname } catch { return String(raw || '').trim() }
}

function isSpam(b) {
  const tld = getHostname(b.url || b.name || '').split('.').pop().toLowerCase()
  const dr = Number(b.dr || 0)
  return SPAM_TLDS.has(tld) || (dr > 0 && dr < 10 && b.type === 'nofollow')
}

function getDomainRank(b) {
  return Number(b?.provider_rank || b?.dr || 0)
}

function getPageRank(b) {
  return Number(b?.provider_page_rank || 0)
}

function getProviderSpamScore(b) {
  return Number(b?.provider_spam_score || b?.spam_score || 0)
}

function drColor(dr) {
  const n = Number(dr || 0)
  if (n >= 70) return { bg: '#dcfce7', color: '#15803d' }
  if (n >= 40) return { bg: '#fef9c3', color: '#a16207' }
  if (n >= 20) return { bg: '#ffedd5', color: '#c2410c' }
  return { bg: '#fee2e2', color: '#b91c1c' }
}

function TypeBadge({ type }) {
  const t = String(type || 'dofollow').toLowerCase()
  const good = t === 'dofollow'
  return (
    <span className={`bl-type-badge bl-type-badge--${good ? 'do' : 'no'}`}>
      {t.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status, id, onChange }) {
  const map = {
    'Live':    { cls: 'bl-status--live',    dot: '#16a34a' },
    'Pending': { cls: 'bl-status--pending', dot: '#d97706' },
    'Todo':    { cls: 'bl-status--todo',    dot: '#6b7280' },
  }
  const cfg = map[status] || map['Todo']
  return (
    <select value={status} onChange={e => onChange(id, e.target.value)} className={`bl-status-sel ${cfg.cls}`}>
      <option>Todo</option>
      <option>Pending</option>
      <option>Live</option>
    </select>
  )
}

function DrBadge({ dr }) {
  const n = Number(dr || 0)
  const { bg, color } = drColor(n)
  return (
    <span className="bl-dr-badge" style={{ background: bg, color }}>
      {n}
    </span>
  )
}

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <FontAwesomeIcon icon={faSort} className="bl-sort-icon" />
  return <FontAwesomeIcon icon={sort.dir === 'asc' ? faSortUp : faSortDown} className="bl-sort-icon bl-sort-icon--active" />
}

function sourceConfig(source) {
  const value = String(source || 'manual').toLowerCase()
  if (value === 'dataforseo') return { cls: 'dataforseo', label: 'DataForSEO' }
  if (value === 'crawled') return { cls: 'crawled', label: 'Crawled' }
  if (value === 'csv') return { cls: 'csv', label: 'Imported' }
  if (value === 'domain') return { cls: 'domain', label: 'Domain' }
  return { cls: 'manual', label: 'Manual' }
}

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function BacklinksTable({
  backlinks,
  loading,
  onUpdateStatus,
  onRemove,
  searchSeed = '',
  searchSeedKey = 0,
}) {
  const [typeFilter, setTypeFilter] = useState('All')   // All | Dofollow | Nofollow
  const [statusFilter, setStatusFilter] = useState('All')
  const [spamFilter, setSpamFilter] = useState('All')   // All | Clean | Spam
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ field: 'domainRank', dir: 'desc' })
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!searchSeedKey) return
    setSearch(searchSeed || '')
    setTypeFilter('All')
    setStatusFilter('All')
    setSpamFilter('All')
    setPage(1)
  }, [searchSeedKey, searchSeed])

  const toggleSort = (field) => {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'desc' })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return backlinks.filter(b => {
      if (typeFilter !== 'All' && (b.type || 'dofollow').toLowerCase() !== typeFilter.toLowerCase()) return false
      if (statusFilter !== 'All' && b.status !== statusFilter) return false
      if (spamFilter === 'Spam' && !isSpam(b)) return false
      if (spamFilter === 'Clean' && isSpam(b)) return false
      if (q) {
        const hay = `${b.name || ''} ${b.url || ''} ${b.source_domain || ''} ${b.anchor || ''} ${b.target_url || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [backlinks, typeFilter, statusFilter, spamFilter, search])

  const sorted = useMemo(() => {
    const { field, dir } = sort
    return [...filtered].sort((a, b) => {
      let av = a[field], bv = b[field]
      if (field === 'dr' || field === 'domainRank') {
        av = Number(getDomainRank(a) || 0)
        bv = Number(getDomainRank(b) || 0)
      } else {
        av = String(av || '').toLowerCase()
        bv = String(bv || '').toLowerCase()
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sort])

  useEffect(() => {
    setPage(1)
  }, [typeFilter, statusFilter, spamFilter, search, sort])

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

  const exportCsv = () => {
    const headers = ['Domain', 'URL', 'Anchor', 'Type', 'Domain Rank', 'Page Rank', 'Provider Spam', 'Status', 'Source']
    const rows = sorted.map(b => [
      b.name,
b.url,
b.anchor,
b.type,
getDomainRank(b),
getPageRank(b),
getProviderSpamScore(b),
b.status,
sourceConfig(b.source).label,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ||'').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'backlinks.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const dofollow = backlinks.filter(b => (b.type || 'dofollow') === 'dofollow').length
  const nofollow = backlinks.filter(b => b.type === 'nofollow').length
  const spam = backlinks.filter(b => isSpam(b)).length

  if (loading) return <div className="bl-empty">Loadingâ€¦</div>

  return (
    <div className="bl-wrap">

      {/* â”€â”€ Tab-style type filter â”€â”€ */}
      <div className="bl-topbar">
        <div className="bl-tabs">
          {['All', 'Dofollow', 'Nofollow'].map(t => (
            <button key={t} className={`bl-tab${typeFilter === t ? ' bl-tab--active' : ''}`} onClick={() => setTypeFilter(t)}>
              {t}
              <span className="bl-tab-count">{t === 'All' ? backlinks.length : t === 'Dofollow' ? dofollow : nofollow}</span>
            </button>
          ))}
          <span className="bl-tab-sep" />
          {['All', 'Clean', 'Spam'].map(t => (
            <button key={t} className={`bl-tab bl-tab--spam${spamFilter === t ? ' bl-tab--active' : ''}${t === 'Spam' ? ' bl-tab--red' : ''}`} onClick={() => setSpamFilter(t)}>
              {t === 'Spam' && <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />}{t}
              {t === 'Spam' && <span className="bl-tab-count bl-tab-count--red">{spam}</span>}
            </button>
          ))}
        </div>

        <div className="bl-toolbar">
          <input className="bl-search" placeholder="Search domain, anchor, URLâ€¦" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="bl-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All statuses</option>
            <option>Todo</option><option>Pending</option><option>Live</option>
          </select>
          <button className="bl-export-btn" onClick={exportCsv} title="Export CSV">
            <FontAwesomeIcon icon={faFileExport} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Result count */}
      <div className="bl-count-row">
        <span className="bl-count">All backlinks {sorted.length}</span>
        {(search || typeFilter !== 'All' || statusFilter !== 'All' || spamFilter !== 'All') && (
          <button className="bl-clear" onClick={() => { setSearch(''); setTypeFilter('All'); setStatusFilter('All'); setSpamFilter('All') }}>
            Clear filters
          </button>
        )}
      </div>

      {sorted.length === 0
        ? <div className="bl-empty">No backlinks match your filters.</div>
        : (
          <>
          <div className="bl-table-scroll">
            <table className="bl-table">
              <thead>
                <tr>
                  <th className="bl-th-domain" onClick={() => toggleSort('name')}>
                    Referring page <SortIcon field="name" sort={sort} />
                  </th>
                  <th onClick={() => toggleSort('anchor')}>
                    Anchor &amp; target <SortIcon field="anchor" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('type')}>
                    Type <SortIcon field="type" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('domainRank')}>
                    Domain Rank <SortIcon field="domainRank" sort={sort} />
                  </th>
                  <th className="bl-th-center">Page Rank</th>
                  <th className="bl-th-center">Spam</th>
                  <th className="bl-th-center">Status</th>
                  <th className="bl-th-center">Source</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(b => {
                  const spam = isSpam(b)
                  const source = sourceConfig(b.source)
                  return (
                    <tr key={b.id} className={spam ? 'bl-row-spam' : ''}>

                      {/* Referring page */}
                      <td className="bl-td-domain">
                        <div className="bl-domain-name">
                          {b.name}
                          {spam && (
                            <span className="bl-spam-badge">
                              <FontAwesomeIcon icon={faTriangleExclamation} />SPAM
                            </span>
                          )}
                        </div>
                        {b.url && (
                          <a href={normalizeUrl(b.url)} target="_blank" rel="noopener noreferrer" className="bl-page-url">
                            {getHostname(b.url)}
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                          </a>
                        )}
                      </td>

                      {/* Anchor + target */}
                      <td className="bl-td-anchor">
                        <span className="bl-anchor-text">{b.anchor || <em className="bl-no-anchor">No anchor text</em>}</span>
                        {b.target_url && (
                          <span className="bl-target-url">
                            {normalizeUrl(b.target_url).replace(/^https?:\/\//, '').slice(0, 55)}
                            {normalizeUrl(b.target_url).length > 60 ? '…' : ''}
                          </span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="bl-td-center">
                        <TypeBadge type={b.type} />
                      </td>

                      {/* Domain Rank */}
                      <td className="bl-td-center">
                        <DrBadge dr={getDomainRank(b)} />
                      </td>

                      {/* Page Rank */}
                      <td className="bl-td-center">
                        {getPageRank(b)}
                      </td>

                      {/* Provider Spam */}
                      <td className="bl-td-center">
                        <span
                          style={{
                            fontWeight: 800,
                            color:
                              getProviderSpamScore(b) >= 50
                                ? '#DC2626'
                                : getProviderSpamScore(b) >= 30
                                ? '#D97706'
                                : '#16A34A'
                          }}
                        >
                          {getProviderSpamScore(b)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="bl-td-center">
                        <StatusBadge status={b.status} id={b.id} onChange={onUpdateStatus} />
                      </td>

                      {/* Source */}
                      <td className="bl-td-center">
                        <span className={`bl-source-badge bl-source-badge--${source.cls}`}>
                          {source.label}
                        </span>
                      </td>

                      {/* Remove */}
                      <td className="bl-td-action">
                        <button className="bl-remove-btn" onClick={() => onRemove(b.id)} aria-label="Remove">
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bl-pagination">
            <span className="bl-pagination-meta">
              Showing {pageStart} to {pageEnd} of {sorted.length} backlinks
            </span>
            <div className="bl-pagination-controls">
              <button
                type="button"
                className="bl-page-btn"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              {pageNumbers.map(n => (
                <button
                  key={n}
                  type="button"
                  className={`bl-page-btn${n === safePage ? ' bl-page-btn--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="bl-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
              <span className="bl-page-size">{PAGE_SIZE} / page</span>
            </div>
          </div>
          </>
        )}
    </div>
  )
}




