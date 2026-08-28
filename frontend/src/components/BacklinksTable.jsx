import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare, faTriangleExclamation, faSort,
  faSortUp, faSortDown, faFileExport, faTrash, faEllipsisVertical,
  faChevronLeft, faChevronRight, faChevronDown, faChevronUp, faCopy, faBan, faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import toast from '../utils/toast'
import api from '../utils/api'
import ScoreInfoTip from './ScoreInfoTip'
import {
  classifyBacklink,
  getDomainRank,
  getQualityScore,
  QUALITY_META,
  summarizeBacklinkQuality,
} from '../utils/backlinkQuality'

function RowActionsMenu({ backlink, onRemove, isSpam = false }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const href = backlink?.url ? normalizeUrl(backlink.url) : ''
  const host = getHostname(backlink?.url || backlink?.source_domain || backlink?.name)
  const disavowLine = host ? `domain:${host}` : (href || '')

  const placeMenu = () => {
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = isSpam ? 268 : 210
    const menuHeight = menu?.offsetHeight || (isSpam ? 280 : 100)
    const gap = 6
    let left = rect.right - menuWidth
    let top = rect.bottom + gap
    if (left < 8) left = 8
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8
    }
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap)
    }
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    placeMenu()
  }, [open, isSpam, copied])

  useEffect(() => {
    if (!open) {
      setCopied('')
      return
    }
    const onDoc = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const copyText = async (text, key, message) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success(message)
      setTimeout(() => setCopied((cur) => (cur === key ? '' : cur)), 1600)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="bl-row-actions">
      <button
        ref={btnRef}
        type="button"
        className={`bl-menu-trigger${open ? ' bl-menu-trigger--open' : ''}${isSpam ? ' bl-menu-trigger--spam' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isSpam ? 'Spam link actions' : 'Row actions'}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className={`bl-action-menu${isSpam ? ' bl-action-menu--spam' : ''}`}
          role="menu"
          style={{ top: pos.top, left: pos.left, width: isSpam ? 268 : undefined }}
        >
          {isSpam ? (
            <>
              <div className="bl-action-menu__head">
                <span className="bl-action-menu__eyebrow">Remove this spam link</span>
                <span className="bl-action-menu__domain" title={host || href}>
                  {host || 'Unknown domain'}
                </span>
                <span className="bl-action-menu__hint">
                  Lives on their site - not yours. Follow these steps for this URL.
                </span>
              </div>

              <a
                href={href || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`bl-action-menu__item${href ? '' : ' bl-action-menu__item--disabled'}`}
                role="menuitem"
                onClick={(e) => {
                  if (!href) e.preventDefault()
                  else setOpen(false)
                }}
              >
                <span className="bl-action-menu__step">1</span>
                <span className="bl-action-menu__item-body">
                  <span>Open referring page</span>
                  <span className="bl-action-menu__sub">Confirm the link is live</span>
                </span>
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="bl-action-menu__trail" />
              </a>

              <button
                type="button"
                className="bl-action-menu__item"
                role="menuitem"
                onClick={() => copyText(
                  host || href,
                  'domain',
                  host ? `Copied ${host}` : 'Copied URL'
                )}
              >
                <span className="bl-action-menu__step">2</span>
                <span className="bl-action-menu__item-body">
                  <span>{copied === 'domain' ? 'Domain copied' : 'Copy domain to contact them'}</span>
                  <span className="bl-action-menu__sub">Ask them to delete or nofollow</span>
                </span>
                <FontAwesomeIcon icon={faEnvelope} className="bl-action-menu__trail" />
              </button>

              <button
                type="button"
                className="bl-action-menu__item"
                role="menuitem"
                disabled={!disavowLine}
                onClick={() => copyText(
                  disavowLine,
                  'disavow',
                  'Disavow line copied'
                )}
              >
                <span className="bl-action-menu__step">3</span>
                <span className="bl-action-menu__item-body">
                  <span>{copied === 'disavow' ? 'Copied for disavow file' : 'Copy for Google disavow'}</span>
                  <span className="bl-action-menu__sub">{disavowLine || 'No domain available'}</span>
                </span>
                <FontAwesomeIcon icon={faCopy} className="bl-action-menu__trail" />
              </button>

              <a
                href="https://search.google.com/search-console/disavow-links"
                target="_blank"
                rel="noopener noreferrer"
                className="bl-action-menu__item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <span className="bl-action-menu__step">4</span>
                <span className="bl-action-menu__item-body">
                  <span>Open Google Disavow</span>
                  <span className="bl-action-menu__sub">Paste the line if they won’t remove it</span>
                </span>
                <FontAwesomeIcon icon={faBan} className="bl-action-menu__trail" />
              </a>

              <div className="bl-action-menu__sep" role="separator" />
              <button
                type="button"
                className="bl-action-menu__item bl-action-menu__item--danger"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onRemove?.(backlink.id)
                }}
              >
                <FontAwesomeIcon icon={faTrash} />
                <span className="bl-action-menu__item-body">
                  <span>Remove from this list only</span>
                  <span className="bl-action-menu__sub">Does not change your website</span>
                </span>
              </button>
            </>
          ) : (
            <>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bl-action-menu__item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  Open referring page
                </a>
              ) : (
                <span className="bl-action-menu__item bl-action-menu__item--disabled" role="menuitem">
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  Open referring page
                </span>
              )}
              <div className="bl-action-menu__sep" role="separator" />
              <button
                type="button"
                className="bl-action-menu__item bl-action-menu__item--danger"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onRemove?.(backlink.id)
                }}
              >
                <FontAwesomeIcon icon={faTrash} />
                Remove from this list
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

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
  if (!v) return '-'
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
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
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
      title={`${meta.hint}. Score reflects our quality model for this link.`}
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
  siteId = null,
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
  const [disavowStatus, setDisavowStatus] = useState(null)
  const [disavowBusy, setDisavowBusy] = useState(false)
  const [spamGuideOpen, setSpamGuideOpen] = useState(() => {
    try {
      const key = `bl-spam-guide-open:${siteId || 'x'}`
      const raw = localStorage.getItem(key)
      if (raw === '0') return false
      if (raw === '1') return true
    } catch { /* ignore */ }
    return true
  })

  useEffect(() => {
    try {
      localStorage.setItem(`bl-spam-guide-open:${siteId || 'x'}`, spamGuideOpen ? '1' : '0')
    } catch { /* ignore */ }
  }, [spamGuideOpen, siteId])

  useEffect(() => {
    setQualityFilter(QUALITY_VIEWS[qualityView] || 'All')
  }, [qualityView])

  useEffect(() => {
    setTypeFilter(typeLens || 'All')
  }, [typeLens])

  useEffect(() => {
    if (!siteId) return
    api.get(`/sites/${siteId}/backlinks/disavow-status`)
      .then((r) => setDisavowStatus(r.data || null))
      .catch(() => setDisavowStatus(null))
  }, [siteId])

  useEffect(() => {
    if (!searchSeedKey) return
    setSearch(searchSeed || '')
    setTypeFilter('All')
    setStatusFilter('All')
    setQualityFilter('All')
    setPage(1)
  }, [searchSeedKey, searchSeed])

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

  const spamDisavowDomains = useMemo(() => {
    const seen = new Set()
    const domains = []
    for (const b of backlinks) {
      if (classifyBacklink(b) !== 'spam') continue
      const host = getHostname(b.url || b.source_domain || b.name)
      if (!host) continue
      const key = host.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      domains.push(host)
    }
    return domains.sort((a, b) => a.localeCompare(b))
  }, [backlinks])

  const exportSpamDisavow = () => {
    if (!spamDisavowDomains.length) {
      toast.error('No spam domains to export')
      return
    }
    const body = [
      '# Google Disavow file - spam domains from DevnDespro SEO',
      `# Generated ${new Date().toISOString().slice(0, 10)}`,
      `# ${spamDisavowDomains.length} unique domain${spamDisavowDomains.length === 1 ? '' : 's'}`,
      '',
      ...spamDisavowDomains.map((d) => `domain:${d}`),
      '',
    ].join('\n')
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'disavow-spam-domains.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success(
      `Exported ${spamDisavowDomains.length} domain${spamDisavowDomains.length === 1 ? '' : 's'} for Google Disavow`
    )
  }

  const markDisavowUploaded = async () => {
    if (!siteId) return
    setDisavowBusy(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/backlinks/disavow-status`, {
        action: 'submit',
        checkAfterDays: 21,
        domainCount: spamDisavowDomains.length,
        fileName: 'disavow-spam-domains.txt',
      })
      setDisavowStatus(data)
      toast.success('Tracked: Google usually needs ~2–3 weeks. We’ll remind you when to check.')
    } catch {
      toast.error('Could not save disavow tracking')
    }
    setDisavowBusy(false)
  }

  const markDisavowChecked = async () => {
    if (!siteId) return
    setDisavowBusy(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/backlinks/disavow-status`, {
        action: 'checked',
      })
      setDisavowStatus(data)
      toast.success('Marked as checked')
    } catch {
      toast.error('Could not update status')
    }
    setDisavowBusy(false)
  }

  const resetDisavowTracker = async () => {
    if (!siteId) return
    setDisavowBusy(true)
    try {
      const { data } = await api.post(`/sites/${siteId}/backlinks/disavow-status`, {
        action: 'reset',
      })
      setDisavowStatus(data)
      toast.success('Disavow tracker cleared')
    } catch {
      toast.error('Could not clear tracker')
    }
    setDisavowBusy(false)
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
          <button
            type="button"
            className="bl-export-btn"
            onClick={exportCsv}
            title="Download backlinks.csv"
          >
            <FontAwesomeIcon icon={faFileExport} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="bl-export-btn bl-export-btn--disavow"
            onClick={exportSpamDisavow}
            disabled={!spamDisavowDomains.length}
            title={
              spamDisavowDomains.length
                ? `Download disavow-spam-domains.txt (${spamDisavowDomains.length} unique spam domains)`
                : 'No spam domains to export'
            }
          >
            <FontAwesomeIcon icon={faBan} />
            <span>Export disavow .txt</span>
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

      {qualityFilter === 'Spam' && sorted.length > 0 && (
        <div
          className={`bl-spam-guide bl-spam-guide--live${spamGuideOpen ? '' : ' bl-spam-guide--collapsed'}`}
          role="region"
          aria-label="How to disavow spam links"
        >
          <div className="bl-spam-guide__head">
            <FontAwesomeIcon icon={faTriangleExclamation} className="bl-spam-guide__warn" />
            <button
              type="button"
              className="bl-spam-guide__toggle"
              onClick={() => setSpamGuideOpen((v) => !v)}
              aria-expanded={spamGuideOpen}
              aria-controls="bl-spam-guide-panel"
            >
              <span className="bl-spam-guide__title">
                How to remove spam links (Google Disavow)
                {!spamGuideOpen && disavowStatus?.phase === 'waiting' && (
                  <span className="bl-spam-guide__badge">
                    {disavowStatus.daysLeft}d left
                  </span>
                )}
                {!spamGuideOpen && disavowStatus?.phase === 'ready' && (
                  <span className="bl-spam-guide__badge bl-spam-guide__badge--ready">Ready to check</span>
                )}
              </span>
              <span className="bl-spam-guide__chevron" title={spamGuideOpen ? 'Collapse' : 'Expand'}>
                <FontAwesomeIcon icon={spamGuideOpen ? faChevronUp : faChevronDown} />
              </span>
            </button>
          </div>

          {spamGuideOpen && (
            <div className="bl-spam-guide__body" id="bl-spam-guide-panel">
              <p className="bl-spam-guide__intro">
                Removing a row here only clears your tracking list. To tell Google to ignore these links, export the file and upload it in Search Console.
              </p>
              <ol className="bl-spam-guide__steps">
                <li>
                  Click <strong>Select all Spam → Export disavow-ready file</strong> below (downloads <code>disavow-spam-domains.txt</code>).
                </li>
                <li>
                  Open{' '}
                  <a
                    href="https://search.google.com/search-console/disavow-links"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    search.google.com/search-console/disavow-links
                  </a>
                  {' '}and sign in with the Google account that owns the site.
                </li>
                <li>Select your property (e.g. <code>https://www.yoursite.com/</code>).</li>
                <li>Click <strong>Upload disavow list</strong> (or <strong>Replace</strong> if you already have one) and choose the <code>.txt</code> file — not a CSV.</li>
                <li>Confirm. Google may take days or weeks to process; this is normal.</li>
                <li>
                  Then go to <strong>Site Audit</strong> and <strong>re-run</strong> the scan so Domain Rank / Link Score and backlink data refresh in this app.
                </li>
              </ol>
              <p className="bl-spam-guide__note">
                Prefer asking the site owner to remove the link first. Disavow is an advanced last step.
                {' '}You have <strong>{sorted.length}</strong> spam {sorted.length === 1 ? 'link' : 'links'}
                {spamDisavowDomains.length > 0 && (
                  <> · <strong>{spamDisavowDomains.length}</strong> unique {spamDisavowDomains.length === 1 ? 'domain' : 'domains'}</>
                )}.
              </p>
              <div className="bl-spam-guide__actions">
                <button
                  type="button"
                  className="bl-spam-disavow-btn"
                  onClick={exportSpamDisavow}
                  disabled={!spamDisavowDomains.length}
                  title="Download a plain-text file for Google Search Console Disavow"
                >
                  <FontAwesomeIcon icon={faBan} />
                  <span>Select all Spam → Export disavow-ready file</span>
                </button>
                <a
                  className="bl-spam-disavow-link"
                  href="https://search.google.com/search-console/disavow-links"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Google Disavow
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                </a>
              </div>

              <div className={`bl-disavow-track bl-disavow-track--${disavowStatus?.phase || 'none'}`}>
                <div className="bl-disavow-track__label">Track progress in this app</div>
                <p className="bl-disavow-track__msg">
                  Google does not notify us when processing finishes. After you upload the file, mark it here — we wait ~21 days, then tell you to check Search Console and re-run Site Audit.
                </p>
                {disavowStatus?.phase === 'waiting' && (
                  <p className="bl-disavow-track__status">
                    Uploaded {disavowStatus.submittedAt ? new Date(disavowStatus.submittedAt).toLocaleDateString() : ''}
                    {disavowStatus.domainCount > 0 && <> · {disavowStatus.domainCount} domains</>}
                    {' '}· check again in about <strong>{disavowStatus.daysLeft}</strong> day{disavowStatus.daysLeft === 1 ? '' : 's'}
                    {disavowStatus.checkAfterAt && (
                      <> (on {new Date(disavowStatus.checkAfterAt).toLocaleDateString()})</>
                    )}
                  </p>
                )}
                {disavowStatus?.phase === 'ready' && (
                  <p className="bl-disavow-track__status bl-disavow-track__status--ready">
                    Wait period is over. Open Google Disavow to confirm, then re-run Site Audit.
                  </p>
                )}
                {disavowStatus?.phase === 'checked' && (
                  <p className="bl-disavow-track__status">
                    Last checked {disavowStatus.checkedAt ? new Date(disavowStatus.checkedAt).toLocaleDateString() : ''}.
                    {' '}Submit again if you export a new spam list.
                  </p>
                )}
                <div className="bl-spam-guide__actions">
                  {(disavowStatus?.phase === 'none' || !disavowStatus?.phase) && (
                    <button
                      type="button"
                      className="bl-spam-disavow-btn"
                      onClick={markDisavowUploaded}
                      disabled={disavowBusy || !siteId}
                    >
                      I uploaded the .txt to Google — start 21-day timer
                    </button>
                  )}
                  {disavowStatus?.phase === 'waiting' && (
                    <button
                      type="button"
                      className="bl-spam-disavow-link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={resetDisavowTracker}
                      disabled={disavowBusy}
                    >
                      Reset tracker
                    </button>
                  )}
                  {disavowStatus?.phase === 'ready' && (
                    <>
                      {siteId ? (
                        <Link className="bl-spam-disavow-btn" to={`/site/${siteId}/audit`}>
                          Go to Site Audit → re-run
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="bl-spam-disavow-btn"
                        onClick={markDisavowChecked}
                        disabled={disavowBusy}
                      >
                        Mark as checked
                      </button>
                    </>
                  )}
                  {disavowStatus?.phase === 'checked' && (
                    <button
                      type="button"
                      className="bl-spam-disavow-btn"
                      onClick={markDisavowUploaded}
                      disabled={disavowBusy}
                    >
                      Start new disavow timer
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bl-empty">No backlinks match these filters.</div>
      ) : (
        <>
          <div className="bl-table-scroll">
            <table className="bl-table bl-table--compact">
              <thead>
                <tr>
                  <th className="bl-th-domain" onClick={() => toggleSort('name')}>
                    Referring page <SortIcon field="name" sort={sort} />
                  </th>
                  <th onClick={() => toggleSort('anchor')}>
                    Anchor <SortIcon field="anchor" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('domainRank')}>
                    <span className="score-label-with-tip">
                      DR
                      <ScoreInfoTip scoreKey="dr" asSpan />
                    </span>
                    {' '}
                    <SortIcon field="domainRank" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('quality')}>
                    <span className="score-label-with-tip">
                      Quality
                      <ScoreInfoTip scoreKey="quality" asSpan />
                    </span>
                    {' '}
                    <SortIcon field="quality" sort={sort} />
                  </th>
                  <th className="bl-th-center" onClick={() => toggleSort('type')}>
                    Type <SortIcon field="type" sort={sort} />
                  </th>
                  <th className="bl-th-center">Status</th>
                  <th className="bl-th-actions">Actions</th>
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
                  const seen = formatDate(getLastSeen(b) || getFirstSeen(b))

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
                      <td className="bl-td-domain" data-label="Referring page">
                        <div className="bl-domain-name">
                          <span className="bl-domain-name__host">{host || b.name || '-'}</span>
                          {qualityKey === 'spam' && (
                            <span className="bl-spam-badge">
                              <FontAwesomeIcon icon={faTriangleExclamation} />SPAM
                            </span>
                          )}
                        </div>
                        {b.url && (
                          <div className="bl-page-url" title={normalizeUrl(b.url)}>
                            {path || getHostname(b.url)}
                          </div>
                        )}
                        <div className="bl-row-meta">
                          <span className={`bl-source-badge bl-source-badge--${source.cls}`}>
                            {source.label}
                          </span>
                          <span className="bl-row-meta-date">Seen {seen}</span>
                        </div>
                      </td>

                      <td className="bl-td-anchor" data-label="Anchor">
                        <span className="bl-anchor-text">
                          {b.anchor || <em className="bl-no-anchor">No anchor text</em>}
                        </span>
                        {target && (
                          <span className="bl-target-url" title={target}>
                            → {target.length > 42 ? `${target.slice(0, 40)}…` : target}
                          </span>
                        )}
                      </td>

                      <td className="bl-td-center" data-label="DR">
                        <DrBadge dr={getDomainRank(b)} />
                      </td>

                      <td className="bl-td-center" data-label="Quality">
                        <QualityBadge backlink={b} />
                      </td>

                      <td className="bl-td-center" data-label="Type">
                        <TypeBadge type={b.type} />
                      </td>

                      <td className="bl-td-center" data-label="Status">
                        <StatusBadge status={b.status} id={b.id} onChange={onUpdateStatus} />
                      </td>

                      <td className="bl-td-actions" data-label="Actions">
                        <RowActionsMenu
                          backlink={b}
                          onRemove={onRemove}
                          isSpam={qualityKey === 'spam'}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bl-pager">
            <span className="bl-pager-meta">
              {pageStart}-{pageEnd} of {sorted.length}
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
