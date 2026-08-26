import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from '../utils/toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock, faBullseye, faPenToSquare, faLink,
  faPlus, faTag, faGlobe, faHourglassHalf, faXmark, faLightbulb,
  faCheck, faArrowRight, faEnvelope, faMagnifyingGlass,
  faChevronUp, faChevronDown, faTrash, faSliders,
  faList, faTableCellsLarge, faEllipsisVertical, faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../hooks/useAuth'
import { Button, Badge, Modal, Input, T } from '../components/UI'
import AppSidebar from '../components/AppSidebar'
import UsageBar from '../components/UsageBar'
import SiteFavicon from '../components/SiteFavicon'
import api, { API_BASE } from "../utils/api"

const BENCHMARKS = [
  { label: 'Avg. Time to Rank',    value: '3-6 mo', sub: 'new domain',      color: T.orange, icon: faClock },
  { label: 'Target Domain Rating', value: '20+',    sub: 'to compete',       color: T.blue,   icon: faBullseye },
  { label: 'Min. Blog Length',     value: '1,500+', sub: 'words per post',   color: T.green,  icon: faPenToSquare },
  { label: 'Dofollow Backlinks',   value: '10-30',  sub: 'to start ranking', color: T.purple, icon: faLink },
]

function cleanDiscoveryText(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/[^\w\s"'.,:;#/+%-]+/g, ' | ')
    .replace(/(?:\s*\|\s*)+/g, ' | ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function SiteAvatar({ name, url }) {
  return <SiteFavicon name={name} url={url} size={48} radius={8} />
}

export default function Sites() {
  const [sites, setSites] = useState(() => {
    try {
      const cachedSites = sessionStorage.getItem('devndespro_projects_cache')
      const parsedSites = cachedSites ? JSON.parse(cachedSites) : []
      return Array.isArray(parsedSites) ? parsedSites : []
    }
    catch {
      return []
    }
  })
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', contactEmail: '', notifyAdmin: true })
  const [findingEmail, setFindingEmail] = useState(false)
  const [addMode, setAddMode] = useState('choose')
  const [gscConnected, setGscConnected] = useState(false)
  const [gscProperties, setGscProperties] = useState([])
  const [gscLoadingProps, setGscLoadingProps] = useState(false)
  const [gscConnecting, setGscConnecting] = useState(false)
  const [selectedProps, setSelectedProps] = useState([])
  const [importing, setImporting] = useState(false)
  const [discoverSite, setDiscoverSite] = useState(null)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState('')
  const [discoverData, setDiscoverData] = useState(null)
  const [discoverAdding, setDiscoverAdding] = useState(new Set())
  const [discoverAdded, setDiscoverAdded] = useState(new Set())
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [errors, setErrors] = useState({})
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState({ open: false, site: null, bulk: false })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [showAeoBanner, setShowAeoBanner] = useState(() => localStorage.getItem('aeo_banner_dismissed') !== '1')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [visibleCount, setVisibleCount] = useState(5)
  const [pendingProjects, setPendingProjects] = useState([])
  const [mobileFilter, setMobileFilter] = useState('all')
  const [mobileView, setMobileView] = useState('list')
  const [showMobileTop, setShowMobileTop] = useState(false)
  const [mobileActionSite, setMobileActionSite] = useState(null)

  const safeSites = Array.isArray(sites) ? sites : []
  const token = localStorage.getItem('seo_token')
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  // DEVNDESPRO_PROJECTS_RELIABLE_LOAD
  const load = async ({ background = false } = {}) => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)

    if (!background) setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/sites`, {
        headers: authHeaders,
        signal: controller.signal,
        cache: 'no-store',
      })

      if (res.status === 401) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      if (!res.ok) {
        throw new Error(`Projects request failed with ${res.status}`)
      }

      const data = await res.json()
      const nextSites = Array.isArray(data) ? data : []

      setSites(nextSites)
      sessionStorage.setItem(
        'devndespro_projects_cache',
        JSON.stringify(nextSites)
      )

      // Summary must never block the project list or its loading state.
      fetch(`${API_BASE}/sites/summary`, {
        headers: authHeaders,
        cache: 'no-store',
      })
        .then(summaryResponse => summaryResponse.ok ? summaryResponse.json() : null)
        .then(summaryData => {
          if (summaryData) setSummary(summaryData)
        })
        .catch(() => {})
    }
    catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Projects loading failed:', error)
      }

      // Preserve cached/current projects instead of replacing them with zero.
      setSites(currentSites => Array.isArray(currentSites) ? currentSites : [])
    }
    finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const hasCachedProjects = (() => {
      try {
        const cached = JSON.parse(
          sessionStorage.getItem('devndespro_projects_cache') || '[]'
        )
        return Array.isArray(cached) && cached.length > 0
      }
      catch {
        return false
      }
    })()

    if (hasCachedProjects) setLoading(false)

    Promise.resolve()
      .then(() => active && load({ background: hasCachedProjects }))
      .catch(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (user?.id === 1) {
      fetch(`${API_BASE}/sites/pending/all`, { headers: authHeaders })
        .then(r => r.ok ? r.json() : [])
        .then(setPendingProjects)
        .catch(() => {})
    }
  }, [user])

  const approveProject = async (id) => {
    try {
      await fetch(`${API_BASE}/sites/${id}/approve`, { method: 'PATCH', headers: authHeaders })
      toast.success('Project approved')
      setPendingProjects(p => p.filter(s => s.id !== id))
      load()
    } catch { toast.error('Failed to approve project') }
  }

  const filteredSites = safeSites
    .filter(s => {
      const q = search.toLowerCase()
      return s.name?.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'created_at') { av = new Date(av); bv = new Date(bv) }
      else { av = Number(av ?? 0); bv = Number(bv ?? 0) }
      return sortDir === 'asc' ? av - bv : bv - av
    })

  // DEVNDESPRO_MOBILE_TOP_VISIBILITY
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)')
    if (!mobileQuery.matches) return undefined

    const candidates = [
      window,
      document.querySelector('.app-main'),
      document.querySelector('.page-content'),
      document.querySelector('.projects-mobile-view'),
    ].filter(Boolean)

    const updateTopVisibility = event => {
      const target = event?.currentTarget || window
      const scrollTop = target === window
        ? (document.scrollingElement || document.documentElement).scrollTop
        : target.scrollTop

      setShowMobileTop(scrollTop > 420)
    }

    candidates.forEach(candidate => {
      candidate.addEventListener('scroll', updateTopVisibility, { passive: true })
    })

    updateTopVisibility()

    return () => {
      candidates.forEach(candidate => {
        candidate.removeEventListener('scroll', updateTopVisibility)
      })
    }
  }, [])
  const mobileHealthValues = safeSites
    .map(site => Number(site.health))
    .filter(Number.isFinite)

  const mobileAverageHealth = mobileHealthValues.length
    ? Math.round(
        mobileHealthValues.reduce((sum, value) => sum + value, 0) /
        mobileHealthValues.length
      )
    : 0

  const mobileAttentionCount = safeSites.filter(site => {
    const score = Number(site.health)
    return Number.isFinite(score) && score < 60
  }).length

  const mobileHealthyCount = safeSites.filter(
    site => Number(site.health) >= 80
  ).length

  const mobileKeywordCount = safeSites.reduce(
    (sum, site) => sum + (Number(site.keyword_count) || 0),
    0
  )

  // DEVNDESPRO_MOBILE_PROJECTS_FILTER_FIX_V3
  const mobileFilteredSites = safeSites
    .filter(site => {
      const query = search.trim().toLowerCase()

      if (!query) return true

      const name = String(site?.name || '').toLowerCase()
      const url = String(site?.url || '').toLowerCase()
      const domain = String(site?.domain || '').toLowerCase()

      return (
        name.includes(query) ||
        url.includes(query) ||
        domain.includes(query)
      )
    })
    .filter(site => {
      const score = Number(site.health)

      if (mobileFilter === 'attention') {
        return Number.isFinite(score) && score < 60
      }

      if (mobileFilter === 'healthy') {
        return Number.isFinite(score) && score >= 80
      }

      return true
    })
    .sort((a, b) => {
      const dateA = new Date(
        a?.updated_at || a?.created_at || 0
      ).getTime()

      const dateB = new Date(
        b?.updated_at || b?.created_at || 0
      ).getTime()

      const valueA = Number.isFinite(dateA) ? dateA : 0
      const valueB = Number.isFinite(dateB) ? dateB : 0

      return sortDir === 'asc'
        ? valueA - valueB
        : valueB - valueA
    })

  useEffect(() => {
    setVisibleCount(5)
  }, [search, mobileFilter])

  // DEVNDESPRO_MOBILE_PROJECTS_AUTO_LOAD
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)')
    if (!mobileQuery.matches) return undefined

    const candidates = [
      window,
      document.querySelector('.app-main'),
      document.querySelector('.page-content'),
      document.querySelector('.projects-mobile-view'),
    ].filter(Boolean)

    const revealNextProjects = event => {
      const target = event?.currentTarget || window
      let scrollTop
      let clientHeight
      let scrollHeight

      if (target === window) {
        const scrollingElement = document.scrollingElement || document.documentElement
        scrollTop = scrollingElement.scrollTop
        clientHeight = window.innerHeight
        scrollHeight = scrollingElement.scrollHeight
      }
      else {
        scrollTop = target.scrollTop
        clientHeight = target.clientHeight
        scrollHeight = target.scrollHeight
      }

      if (scrollTop + clientHeight >= scrollHeight - 220) {
        setVisibleCount(current => Math.min(current + 5, mobileFilteredSites.length))
      }
    }

    candidates.forEach(candidate => {
      candidate.addEventListener('scroll', revealNextProjects, { passive: true })
    })

    return () => {
      candidates.forEach(candidate => {
        candidate.removeEventListener('scroll', revealNextProjects)
      })
    }
  }, [mobileFilteredSites.length])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Project name is required'
    if (!form.url.trim()) e.url = 'Website URL is required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const checkGscAndLoadProperties = async () => {
    setGscLoadingProps(true)
    try {
      const res = await fetch(`${API_BASE}/sites/gsc-properties`, { headers: authHeaders })
      const data = await res.json()
      setGscConnected(!!data.connected)
      setGscProperties(Array.isArray(data.properties) ? data.properties : [])
    } catch {
      setGscConnected(false)
      setGscProperties([])
    }
    setGscLoadingProps(false)
  }

  const connectGsc = async () => {
    setGscConnecting(true)
    try {
      const res = await fetch(`${API_BASE}/auth/gsc`, { headers: authHeaders })
      const data = await res.json()
      const popup = window.open(data.url, 'gsc_connect', 'width=520,height=640')
      const onMessage = (e) => {
        if (e.data === 'gsc_connected') {
          window.removeEventListener('message', onMessage)
          popup?.close()
          checkGscAndLoadProperties()
          setGscConnecting(false)
        }
      }
      window.addEventListener('message', onMessage)
    } catch {
      toast.error('Failed to start GSC connection')
      setGscConnecting(false)
    }
  }

  const toggleSelectedProp = (url) => {
    setSelectedProps(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url])
  }

  const resetDiscoverState = () => {
    setDiscoverSite(null)
    setDiscoverLoading(false)
    setDiscoverError('')
    setDiscoverData(null)
    setDiscoverAdding(new Set())
    setDiscoverAdded(new Set())
  }

  const startKeywordDiscovery = async (site) => {
    if (!site?.id) return
    setDiscoverSite(site)
    setAddMode('discover')
    setShowAdd(true)
    setDiscoverLoading(true)
    setDiscoverError('')
    setDiscoverData(null)
    setDiscoverAdded(new Set())
    try {
      const { data } = await api.post(`/sites/${site.id}/keywords/auto-discover`)
      setDiscoverData(data)
      const imported = data?.meta?.importedCount || 0
      if (imported > 0) {
        toast.success(`Tracked ${imported} already-ranking keyword${imported === 1 ? '' : 's'}`)
      }
    } catch (e) {
      setDiscoverError(e.response?.data?.error || 'Keyword discovery failed')
      toast.error(e.response?.data?.error || 'Keyword discovery failed')
    }
    setDiscoverLoading(false)
  }

  const addDiscoverKeyword = async (item) => {
    if (!discoverSite?.id || !item?.keyword) return
    const key = item.keyword.toLowerCase().trim()
    if (discoverAdded.has(key)) return
    setDiscoverAdding((prev) => new Set([...prev, key]))
    try {
      await api.post(`/sites/${discoverSite.id}/keywords`, {
        keyword: item.keyword,
        volume: item.volume || 0,
        difficulty: item.difficulty || 'Medium',
        position: null,
      })
      setDiscoverAdded((prev) => new Set([...prev, key]))
      toast.success(`Added: ${item.keyword}`)
    } catch (e) {
      const msg = e.response?.data?.error || ''
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
        setDiscoverAdded((prev) => new Set([...prev, key]))
        toast('Already tracked')
      } else {
        toast.error(msg || 'Failed to add keyword')
      }
    }
    setDiscoverAdding((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const finishDiscovery = (goToKeywords = false) => {
    const siteId = discoverSite?.id
    resetDiscoverState()
    setShowAdd(false)
    setAddMode('choose')
    setSelectedProps([])
    setForm({ name: '', url: '', contactEmail: '', notifyAdmin: true })
    load()
    if (goToKeywords && siteId) navigate(`/site/${siteId}/keywords`)
  }

  const importSelected = async () => {
    if (selectedProps.length === 0) return
    setImporting(true)
    let successCount = 0
    let firstSite = null
    for (const propUrl of selectedProps) {
      const displayUrl = propUrl.startsWith('sc-domain:')
        ? propUrl.replace('sc-domain:', '')
        : propUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
      try {
        const res = await fetch(`${API_BASE}/sites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ name: displayUrl, url: displayUrl, notifyAdmin: true }),
        })
        if (res.ok) {
          successCount++
          const created = await res.json().catch(() => null)
          if (created?.id && !firstSite) firstSite = created
          else if (created?.id) {
            // Background discover for additional imports
            api.post(`/sites/${created.id}/keywords/auto-discover`).catch(() => {})
          }
        }
      } catch { /* continue with remaining */ }
    }
    setImporting(false)
    setSelectedProps([])
    toast.success(`Imported ${successCount} of ${selectedProps.length} project${selectedProps.length === 1 ? '' : 's'}`)
    load()
    if (firstSite) {
      api.post(`/sites/${firstSite.id}/keywords/auto-discover`).catch(() => {})
    } else {
      setShowAdd(false)
      setAddMode('choose')
    }
  }

  const add = async () => {
    if (!validate()) return
    setAdding(true)
    try {
      const res = await fetch(`${API_BASE}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(form),
      })
      if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const err = new Error(e.error || 'Failed to add site. Try again.')
        err.locked = e.locked
        throw err
      }
      const newSite = await res.json().catch(() => null)
      setForm({ name: '', url: '', contactEmail: '', notifyAdmin: true })
      toast.success('Project added successfully')
      load()

      if (newSite?.id && (user?.is_paid || user?.id === 1)) {
        fetch(`${API_BASE}/sites/${newSite.id}/backlinks/crawl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({}),
        })
          .then(r => r.json())
          .then(data => {
            const count = data?.saved ?? 0
            toast.success(`Found ${count} backlink${count === 1 ? '' : 's'} for ${newSite.name}`)
          })
          .catch(() => {})
      }

      if (newSite?.id) {
        api.post(`/sites/${newSite.id}/keywords/auto-discover`).catch(() => {})
      }

      setShowAdd(false)
      setAddMode('choose')
      resetDiscoverState()
    } catch (e) {
      const msg = e?.message || 'Failed to add site. Try again.'
      setErrors({ url: msg })
      toast.error(msg, e?.locked ? { icon: 'u{1F512}', duration: 5000 } : undefined)
    }
    setAdding(false)
  }

  const remove = async (id) => {
    const res = await fetch(`${API_BASE}/sites/${id}`, { method: 'DELETE', headers: authHeaders })
    if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
    toast.success('Project deleted')
    load()
  }

  const toggleSelectMode = () => {
    setSelectMode(v => !v)
    setSelectedIds([])
  }

  const toggleSelected = (id) => {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSites.length) setSelectedIds([])
    else setSelectedIds(filteredSites.map(s => s.id))
  }

  const bulkRemove = async () => {
    let successCount = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`${API_BASE}/sites/${id}`, { method: 'DELETE', headers: authHeaders })
        if (res.status === 401) { logout(); navigate('/login', { replace: true }); return }
        if (res.ok) successCount++
      } catch { /* continue with remaining */ }
    }
    toast.success(`Deleted ${successCount} of ${selectedIds.length} project${selectedIds.length === 1 ? '' : 's'}`)
    setSelectedIds([])
    setSelectMode(false)
    load()
  }

  const getDomain = (url) => {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname }
    catch { return url }
  }

  const enter = (site) => {
    localStorage.setItem('activeSite', JSON.stringify(site))
    navigate(`/site/${site.id}`)
  }

  const SORT_COLS = [
    { key: 'health',         label: 'Health' },
    { key: 'authority_score', label: 'Authority' },
    { key: 'ai_snippet_score',      label: 'AI Snippet Score' },
    { key: 'keyword_count',  label: 'Keywords' },
    { key: 'backlink_count', label: 'Backlinks' },
    { key: 'created_at',     label: 'Added' },
  ]

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-main">
        <UsageBar />
        <div className="topbar">
          <span className="topbar__title">Projects</span>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />New Project
          </Button>
        </div>

        <Modal
          open={showAdd}
          onClose={() => {
            if (addMode === 'discover') {
              finishDiscovery(false)
              return
            }
            setShowAdd(false)
            setErrors({})
            setAddMode('choose')
            setSelectedProps([])
            resetDiscoverState()
          }}
          title={
            addMode === 'gsc'
              ? 'Import from Google Search Console'
              : addMode === 'discover'
                ? 'Keyword discovery'
                : 'Add new project'
          }
          subtitle={
            addMode === 'gsc'
              ? 'Select verified domains to import'
              : addMode === 'discover'
                ? `Finding ranking keywords for ${discoverSite?.name || 'your project'}`
                : addMode === 'manual'
                  ? 'Start tracking SEO metrics for any website'
                  : 'Start tracking SEO metrics for any website'
          }
          width={addMode === 'discover' ? 720 : 480}
          footer={
            addMode === 'choose' ? null : addMode === 'gsc' ? (
              <>
                <Button variant="secondary" onClick={() => setAddMode('choose')}>Back</Button>
                <Button variant="primary" loading={importing} disabled={selectedProps.length === 0} onClick={importSelected}>
                  Import{selectedProps.length > 0 ? ` (${selectedProps.length})` : ''} <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                </Button>
              </>
            ) : addMode === 'discover' ? (
              <>
                <Button variant="secondary" onClick={() => finishDiscovery(false)} disabled={discoverLoading}>
                  Done
                </Button>
                <Button variant="primary" onClick={() => finishDiscovery(true)} disabled={discoverLoading || !discoverSite?.id}>
                  Go to Keywords <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setAddMode('choose')}>Back</Button>
                <Button variant="primary" loading={adding} onClick={add}>
                  Add Project <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 6 }} />
                </Button>
              </>
            )
          }
        >
          {addMode === 'choose' && (
            <div className="add-project-choice-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div
                onClick={() => { setAddMode('gsc'); checkGscAndLoadProperties() }}
                style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'box-shadow 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)' }}
                onMouseOut={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}><FontAwesomeIcon icon={faGlobe} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Import from GSC</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Automatic ownership verification. Import multiple projects at once.</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#EA6A3B' }}>Choose this &rarr;</div>
              </div>
              <div
                onClick={() => setAddMode('manual')}
                style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, cursor: 'pointer', transition: 'box-shadow 0.2s ease' }}
                onMouseOver={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)' }}
                onMouseOut={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ fontSize: 20, marginBottom: 8 }}><FontAwesomeIcon icon={faTag} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Add manually</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Add one project at a time. Fully configure during creation.</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#EA6A3B' }}>Choose this &rarr;</div>
              </div>
            </div>
          )}

          {addMode === 'gsc' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {gscLoadingProps ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading your GSC properties...</div>
              ) : !gscConnected ? (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Connect Google Search Console to import your verified domains.</div>
                  <Button variant="primary" loading={gscConnecting} onClick={connectGsc}>Connect Google Search Console</Button>
                </div>
              ) : gscProperties.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>All caught up</div>
                  <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 4 }}>
                    Every domain verified in this Google Search Console account is already added as a project here.
                  </div>
                  <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
                    To add a new one, verify it in <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" style={{ color: '#EA6A3B', fontWeight: 600 }}>Google Search Console</a> first, or use <strong>Add manually</strong> instead.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                  {gscProperties.map(p => (
                    <label key={p.propertyUrl} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedProps.includes(p.propertyUrl)} onChange={() => toggleSelectedProp(p.propertyUrl)} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{p.displayUrl}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {addMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Project name" placeholder="e.g. devndespro" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} error={errors.name} icon={<FontAwesomeIcon icon={faTag} />} />
              <Input label="Website URL" placeholder="e.g. devndespro.com" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} error={errors.url} icon={<FontAwesomeIcon icon={faGlobe} />} hint="Adding a domain not verified in GSC is fine - some features work better once it is verified." />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input label="Client contact email" placeholder="e.g. client@example.com" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} icon={<FontAwesomeIcon icon={faEnvelope} />} hint="Saved to Cold Email tracker automatically." style={{ flex: 1 }} />
                {user?.id === 1 && (
                  <Button variant="secondary" size="sm" loading={findingEmail} style={{ minWidth: 120 }}
                    onClick={async () => {
                      if (!form.url) return toast.error('Enter a website URL first')
                      setFindingEmail(true)
                      try {
                        const r = await api.post('/extract/extract-email', { url: form.url.startsWith('http') ? form.url : `https://${form.url}` })
                        if (Array.isArray(r.data?.emails) && r.data.emails.length > 0) {
                          setForm(p => ({ ...p, contactEmail: r.data.emails[0] }))
                          toast.success('Email found and filled!')
                        } else { toast.error('No email found on homepage') }
                      } catch { toast.error('Failed to extract email') }
                      setFindingEmail(false)
                    }}>
                    Find email from site
                  </Button>
                )}
              </div>
              <label style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input type="checkbox" checked={form.notifyAdmin} onChange={e => setForm(p => ({ ...p, notifyAdmin: e.target.checked }))} style={{ marginRight: 6 }} />
                Notify admin by email when this project is added
              </label>
            </div>
          )}

          {addMode === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {discoverLoading && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                    Finding keywords you already rank for...
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    Checking GSC + DataForSEO ranked keywords, then suggesting opportunities.
                  </div>
                </div>
              )}

              {!discoverLoading && discoverError && (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13 }}>
                  {discoverError}
                  <div style={{ marginTop: 10 }}>
                    <Button variant="secondary" size="sm" onClick={() => startKeywordDiscovery(discoverSite)}>Retry discovery</Button>
                  </div>
                </div>
              )}

              {!discoverLoading && discoverData && (
                <>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    Locale: {discoverData.meta?.locale?.locationName || 'United States'}
                    {discoverData.meta?.importedCount != null && (
                      <> ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Auto-tracked {discoverData.meta.importedCount} ranking keyword{(discoverData.meta.importedCount === 1) ? '' : 's'}</>
                    )}
                  </div>

                  {[
                    {
                      key: 'already',
                      title: 'Already ranking',
                      hint: 'Auto-tracked from GSC / DataForSEO ranked keywords',
                      items: discoverData.alreadyRanking || [],
                      mode: 'tracked',
                    },
                    {
                      key: 'good',
                      title: 'Good to have',
                      hint: 'Related opportunities worth targeting next',
                      items: discoverData.goodToHave || [],
                      mode: 'add',
                    },
                    {
                      key: 'how',
                      title: 'How to get them',
                      hint: 'Questions and long-tails with a clear content action',
                      items: discoverData.howToGetThem || [],
                      mode: 'how',
                    },
                  ].map((bucket) => (
                    <div key={bucket.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 12px', background: '#F9FAFB', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                            {bucket.title}
                            <span style={{ marginLeft: 8, color: '#EA6A3B' }}>{bucket.items.length}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{bucket.hint}</div>
                        </div>
                      </div>
                      {bucket.items.length === 0 ? (
                        <div style={{ padding: '14px 12px', fontSize: 12, color: '#9CA3AF' }}>No keywords in this bucket yet.</div>
                      ) : (
                        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                          {bucket.items.slice(0, 20).map((item, idx) => {
                            const key = String(item.keyword || '').toLowerCase().trim()
                            const isAdded = discoverAdded.has(key) || item.tracked
                            const isAdding = discoverAdding.has(key)
                            return (
                              <div
                                key={`${bucket.key}-${key}-${idx}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  padding: '10px 12px',
                                  borderBottom: idx < Math.min(bucket.items.length, 20) - 1 ? '1px solid #F3F4F6' : 'none',
                                  background: isAdded ? '#F0FDF4' : '#fff',
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.keyword}</div>
                                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                                    {item.position ? `#${item.position}` : 'No pos'}
                                    {' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '}Vol {Number(item.volume || 0).toLocaleString()}
                                    {' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· '}{item.difficulty || 'Medium'}
                                    {item.opportunity ? ` ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${item.opportunity}` : ''}
                                    {item.source ? ` ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${item.source}` : ''}
                                  </div>
                                  {bucket.mode === 'how' && item.how && (
                                    <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{cleanDiscoveryText(item.how)}</div>
                                  )}
                                  {bucket.mode === 'add' && item.why && (
                                    <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{cleanDiscoveryText(item.why)}</div>
                                  )}
                                </div>
                                {bucket.mode === 'tracked' ? (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>
                                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />
                                    Tracked
                                  </span>
                                ) : isAdded ? (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>
                                    <FontAwesomeIcon icon={faCheck} style={{ marginRight: 4 }} />
                                    Added
                                  </span>
                                ) : (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={isAdding}
                                    onClick={() => addDiscoverKeyword(item)}
                                  >
                                    {isAdding ? 'Adding...' : '+ Add'}
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </Modal>

        <Modal
          open={confirmDelete.open}
          onClose={() => setConfirmDelete({ open: false, site: null, bulk: false })}
          title={confirmDelete.bulk ? `Delete ${selectedIds.length} Projects?` : 'Delete Project?'}
          width={380}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete({ open: false, site: null, bulk: false })}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                if (confirmDelete.bulk) await bulkRemove()
                else if (confirmDelete.site) await remove(confirmDelete.site.id)
                setConfirmDelete({ open: false, site: null, bulk: false })
              }}>Delete</Button>
            </>
          }
        >
          {confirmDelete.bulk ? (
            <>
              <div style={{ fontSize: 15, color: '#b91c1c', marginBottom: 8, fontWeight: 600 }}>
                Are you sure you want to delete {selectedIds.length} project{selectedIds.length === 1 ? '' : 's'}?
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                This will permanently remove all selected projects and their data. This action cannot be undone.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, color: '#b91c1c', marginBottom: 8, fontWeight: 600 }}>
                Are you sure you want to delete <span style={{ color: '#111' }}>{confirmDelete.site?.name}</span>?
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                This will permanently remove the project and all its data. This action cannot be undone.
              </div>
            </>
          )}
        </Modal>

        {/* DEVNDESPRO MOBILE PROJECTS START */}
        <main className="projects-mobile-view">
          {/* DEVNDESPRO MOBILE PROJECTS STICKY SEARCH */}
          <div className={`pm-sticky-search ${showMobileTop ? 'is-visible' : ''}`}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              type="search"
              aria-label="Search projects"
              placeholder="Search projects..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            {search ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            ) : (
              <span className="pm-sticky-filter" aria-hidden="true">
                <FontAwesomeIcon icon={faSliders} />
              </span>
            )}
          </div>
          <section className="pm-heading">
            <div>
              <div className="pm-title-row">
                <h1>Projects</h1>
                <span>{safeSites.length}</span>
              </div>
              <p>{mobileFilteredSites.length} of {safeSites.length} sites</p>
            </div>
            <button className="pm-add" type="button" aria-label="Add project" onClick={() => setShowAdd(true)}>
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </section>

          <section className="pm-kpis">
            {[
              ['TOTAL PROJECTS', safeSites.length, 'all your websites', 'purple', faGlobe],
              ['AVERAGE SITE HEALTH', mobileAverageHealth, 'across scored projects', 'green', faBullseye],
              ['NEEDING ATTENTION', mobileAttentionCount, 'health score below 60', 'orange', faPenToSquare],
              ['TRACKED KEYWORDS', mobileKeywordCount, 'across all projects', 'blue', faLink],
            ].map(([label, value, sub, tone, icon]) => (
              <article key={label} className={`pm-kpi pm-kpi--${tone}`}>
                <span className="pm-kpi-icon"><FontAwesomeIcon icon={icon} /></span>
                <div>
                  <span className="pm-kpi-label">{label}</span>
                  <strong>{value}</strong>
                  <small>{sub}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="pm-controls">
            <div className="pm-search">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input type="search" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
              {search ? (
                <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              ) : <FontAwesomeIcon icon={faSliders} />}
            </div>

            <div className="pm-tabs">
              <button type="button" className={mobileFilter === 'all' ? 'is-active' : ''} onClick={() => setMobileFilter('all')}>All ({safeSites.length})</button>
              <button type="button" className={mobileFilter === 'attention' ? 'is-active' : ''} onClick={() => setMobileFilter('attention')}><i className="pm-dot pm-dot--orange" />Attention ({mobileAttentionCount})</button>
              <button type="button" className={mobileFilter === 'healthy' ? 'is-active' : ''} onClick={() => setMobileFilter('healthy')}><i className="pm-dot pm-dot--green" />Healthy ({mobileHealthyCount})</button>
            </div>

            <div className="pm-sort-row">
              <div className="pm-sort">
                <span>Sort by:</span>
                <button type="button" onClick={() => toggleSort('created_at')}>Recently Updated <FontAwesomeIcon icon={sortDir === 'asc' ? faChevronUp : faChevronDown} /></button>
              </div>
              <div className="pm-view-toggle">
                <button type="button" aria-label="List view" className={mobileView === 'list' ? 'is-active' : ''} onClick={() => setMobileView('list')}><FontAwesomeIcon icon={faList} /></button>
                <button type="button" aria-label="Grid view" className={mobileView === 'grid' ? 'is-active' : ''} onClick={() => setMobileView('grid')}><FontAwesomeIcon icon={faTableCellsLarge} /></button>
              </div>
            </div>
          </section>

          <section className={`pm-list pm-list--${mobileView}`}>
            {loading ? (
              <div className="pm-empty"><FontAwesomeIcon icon={faHourglassHalf} />Loading projects...</div>
            ) : mobileFilteredSites.length === 0 ? (
              <div className="pm-empty">{search ? `No projects matching "${search}"` : 'No projects found'}</div>
            ) : mobileFilteredSites.slice(0, visibleCount).map(site => {
              const score = Number(site.health)
              const healthTone = !Number.isFinite(score) ? 'neutral' : score >= 80 ? 'good' : score >= 60 ? 'fair' : 'low'
              const healthLabel = healthTone === 'good' ? 'Good' : healthTone === 'fair' ? 'Fair' : healthTone === 'low' ? 'Low' : 'Not scored'
              const date = site.updated_at || site.created_at
              const dateLabel = date
                ? `Updated ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}`
                : 'Recently updated'

              return (
                <article key={site.id} className="pm-project" role="button" tabIndex={0} onClick={() => enter(site)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && enter(site)}>
                  <div className="pm-project-main">
                    <SiteFavicon name={site.name || '?'} url={site.url} size={42} radius={9} />
                    <div className="pm-project-copy">
                      <strong>{site.name}</strong>
                      <span>{dateLabel}{' \u00B7 '}{Number(site.keyword_count || 0).toLocaleString()} keywords</span>
                    </div>
                  </div>
                  <div className={`pm-health pm-health--${healthTone}`}>
                    <strong>Health {Number.isFinite(score) ? score : '-'}</strong>
                    <span><i />{healthLabel}</span>
                  </div>
                  <button type="button" className="pm-more" aria-label={`More actions for ${site.name}`} onClick={e => {
                    e.stopPropagation()
                    setMobileActionSite(site)
                    if (navigator.vibrate) navigator.vibrate(10)
                  }}><FontAwesomeIcon icon={faEllipsisVertical} /></button>
                  <span className="pm-chevron" aria-hidden="true"><FontAwesomeIcon icon={faChevronRight} /></span>
                </article>
              )
            })}
          </section>
          {!loading && mobileFilteredSites.length > 0 && (
            <section className="pm-load-more pm-reference-footer">
              <div className="pm-load-summary">
                <div className="pm-loader" aria-hidden="true" />
                <div className="pm-load-copy">
                  <strong>
                    Showing 1{'\u2013'}{Math.min(visibleCount, mobileFilteredSites.length)} of {mobileFilteredSites.length} projects
                  </strong>
                  <span>
                    {visibleCount < mobileFilteredSites.length ? 'Scroll to load more' : 'All projects shown'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`pm-go-top ${showMobileTop ? 'is-visible' : ''}`}
                aria-label="Go to top"
                title="Go to top"
                onClick={() => {
                  const candidates = [
                    document.scrollingElement,
                    document.querySelector('.app-main'),
                    document.querySelector('.page-content'),
                    document.querySelector('.projects-mobile-view'),
                  ].filter(Boolean)

                  candidates.forEach(container => {
                    if (typeof container.scrollTo === 'function') {
                      container.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                    else {
                      container.scrollTop = 0
                    }
                  })

                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <FontAwesomeIcon icon={faChevronUp} />
              </button>
            </section>
          )}
        {/* DEVNDESPRO MOBILE PROJECT ACTION SHEET */}
          {mobileActionSite && (
            <div
              className="pm-sheet-backdrop"
              role="presentation"
              onClick={() => setMobileActionSite(null)}
            >
              <section
                className="pm-action-sheet"
                role="dialog"
                aria-modal="true"
                aria-label={`Actions for ${mobileActionSite.name}`}
                onClick={event => event.stopPropagation()}
              >
                <div className="pm-sheet-handle" aria-hidden="true" />
                <div className="pm-sheet-heading">
                  <SiteFavicon
                    name={mobileActionSite.name || '?'}
                    url={mobileActionSite.url}
                    size={44}
                    radius={10}
                  />
                  <div>
                    <strong>{mobileActionSite.name}</strong>
                    <span>{mobileActionSite.url}</span>
                  </div>
                </div>

                <div className="pm-sheet-actions">
                  <button type="button" onClick={() => {
                    const selectedSite = mobileActionSite
                    setMobileActionSite(null)
                    if (navigator.vibrate) navigator.vibrate(8)
                    enter(selectedSite)
                  }}>
                    <span>Open project</span>
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>

                  <button type="button" onClick={() => {
                    const selectedSite = mobileActionSite
                    setMobileActionSite(null)
                    if (navigator.vibrate) navigator.vibrate(8)
                    navigate(`/site/${selectedSite.id}/keywords`)
                  }}>
                    <span>View keywords</span>
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>

                  {user?.id === 1 && (
                    <button type="button" className="is-danger" onClick={() => {
                      const selectedSite = mobileActionSite
                      setMobileActionSite(null)
                      setConfirmDelete({ open: true, site: selectedSite, bulk: false })
                    }}>
                      <span>Delete project</span>
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  )}
                </div>

                <button type="button" className="pm-sheet-cancel" onClick={() => setMobileActionSite(null)}>
                  Cancel
                </button>
              </section>
            </div>
          )}
        </main>
        {/* DEVNDESPRO MOBILE PROJECTS END */}

        <div className="page-content projects-desktop-view">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>Projects</h1>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 8px 0' }}>
                {loading ? '' : `Total projects: ${safeSites.length}`}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                {loading ? 'Loading...' : `${filteredSites.length} of ${safeSites.length} site${safeSites.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {user?.id === 1 && pendingProjects.length > 0 && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12,
              padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Pending Approval ({pendingProjects.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingProjects.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#fff', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{p.url} &middot; submitted by {p.owner_name || p.owner_email}</div>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => approveProject(p.id)}>Approve</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAeoBanner && (
            <div style={{
              background: 'linear-gradient(135deg, #1e1b2e 0%, #2d1f4e 100%)',
              borderRadius: 12, padding: '14px 18px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap', boxShadow: '0 2px 12px rgba(99,60,180,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>&#10024;</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>New: AI Snippet Audits are now live!</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>See how AI-ready your content is for ChatGPT, Perplexity & Google AI Overviews - re-run any site audit to get your AI Snippet score.</div>
                </div>
              </div>
              <button onClick={() => { setShowAeoBanner(false); localStorage.setItem('aeo_banner_dismissed', '1') }} style={{
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 6, padding: '4px 10px', color: '#fff', fontSize: 12,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>Dismiss</button>
            </div>
          )}

          <div className="grid-4col mb-24 projects-modern-kpi-grid">
            {[
              {
                label: 'TOTAL PROJECTS',
                value: sites?.length || 0,
                sub: 'all your websites',
                color: '#6D4AFF',
                icon: BENCHMARKS?.[0]?.icon,
              },
              {
                label: 'AVERAGE SITE HEALTH',
                value: (() => {
                  const values = (sites || [])
                    .map(site => Number(site.health))
                    .filter(Number.isFinite)
                  return values.length
                    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
                    : 0
                })(),
                sub: 'across scored projects',
                color: '#16A34A',
                icon: BENCHMARKS?.[1]?.icon,
              },
              {
                label: 'NEEDING ATTENTION',
                value: (sites || []).filter(site => {
                  const score = Number(site.health)
                  return Number.isFinite(score) && score < 60
                }).length,
                sub: 'health score below 60',
                color: '#F97316',
                icon: BENCHMARKS?.[2]?.icon,
              },
              {
                label: 'TRACKED KEYWORDS',
                value: (sites || []).reduce(
                  (sum, site) => sum + (Number(site.keyword_count) || 0),
                  0
                ),
                sub: 'across all projects',
                color: '#2563EB',
                icon: BENCHMARKS?.[3]?.icon,
              },
            ].map(b => (
              <div key={b.label} className="bench-card projects-modern-kpi-card" style={{ borderTop: `3px solid ${b.color}` }}>
                <div className="bench-card__header">
                  <span className="bench-card__icon" style={{ color: b.color }}><FontAwesomeIcon icon={b.icon} /></span>
                  <span className="bench-card__title">{b.label}</span>
                </div>
                <div className="bench-card__value" style={{ color: b.color }}>{b.value}</div>
                <div className="bench-card__sub">{b.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid-sidebar-layout projects-modern-layout">
            <div className="projects-table projects-modern-panel">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
              }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <FontAwesomeIcon icon={faMagnifyingGlass} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--muted)', fontSize: 12, pointerEvents: 'none',
                  }} />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', paddingLeft: 30, paddingRight: 40, height: 34,
                      border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
                      fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {search && (
                    <button onClick={() => setSearch('')} style={{
                      position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 2,
                    }}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      onClick={() => setShowSortDropdown(v => !v)}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: showSortDropdown ? 'var(--accent)' : 'none',
                        border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer',
                        color: showSortDropdown ? '#fff' : 'var(--muted)', fontSize: 12, padding: '3px 7px', lineHeight: 1,
                      }}
                      title="Sort by"
                    >
                      <FontAwesomeIcon icon={faSliders} />
                    </button>
                    {showSortDropdown && (
                      <div style={{
                        position: 'absolute', right: 0, top: 36, zIndex: 100,
                        background: '#fff', border: '1px solid var(--border)', borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 180, padding: 6,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sort by</div>
                        {SORT_COLS.map(col => (
                          <button key={col.key} onClick={() => { toggleSort(col.key); setShowSortDropdown(false) }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none',
                            background: sortCol === col.key ? '#FFF4EE' : 'none',
                            color: sortCol === col.key ? 'var(--accent)' : 'var(--text)',
                            fontWeight: sortCol === col.key ? 700 : 400,
                            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          }}>
                            {col.label}
                            {sortCol === col.key && <FontAwesomeIcon icon={sortDir === 'asc' ? faChevronUp : faChevronDown} style={{ fontSize: 10 }} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
              </div>
            </div>
            {user?.id === 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                {selectMode ? (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={filteredSites.length > 0 && selectedIds.length === filteredSites.length}
                        onChange={toggleSelectAll}
                      />
                      Select all ({selectedIds.length} selected)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="danger" size="sm" disabled={selectedIds.length === 0}
                        onClick={() => setConfirmDelete({ open: true, site: null, bulk: true })}>
                        <FontAwesomeIcon icon={faTrash} style={{ marginRight: 6 }} />Delete Selected ({selectedIds.length})
                      </Button>
                      <Button variant="secondary" size="sm" onClick={toggleSelectMode}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={toggleSelectMode}>Select projects</Button>
                )}
              </div>
            )}
              <div style={{ padding: '4px 4px 12px', maxHeight: 640, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}><FontAwesomeIcon icon={faHourglassHalf} /></div>
                    Loading projects...
                  </div>
                ) : filteredSites.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
                    <div style={{ marginBottom: 16 }}>{search ? `No projects matching "${search}"` : 'No projects yet'}</div>
                    <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>
                      <FontAwesomeIcon icon={faPlus} style={{ marginRight: 8 }} />Add Your First Project
                    </Button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                      {filteredSites.slice(0, visibleCount).map((site, idx) => (
                        <div
                          key={site.id}
                          onClick={() => selectMode ? toggleSelected(site.id) : enter(site)}
                        className="fade-in"
                          style={{
                            background: '#fff', border: selectMode && selectedIds.includes(site.id) ? '2px solid var(--accent, #EA6A3B)' : '1px solid var(--dark4)', borderRadius: 12, animationDelay: `ms`, animationFillMode: 'both',
                            padding: '14px', cursor: 'pointer', transition: 'box-shadow 0.25s ease, transform 0.25s ease', position: 'relative',
                          }}
                          onMouseOver={e => { e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-4px)' }}
                          onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                          {selectMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(site.id)}
                              onChange={() => toggleSelected(site.id)}
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', top: 10, right: 10, width: 16, height: 16, cursor: 'pointer' }}
                            />
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                              <SiteAvatar name={site.name || '?'} url={site.url} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {site.name}
                                {site.status === 'pending' && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: '#FEF3C7', color: '#92400E', whiteSpace: 'nowrap' }}>PENDING</span>
                                )}
                              </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                  {new Date(site.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                </div>
                              </div>
                            </div>
                            {user?.id === 1 && !selectMode && (
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmDelete({ open: true, site, bulk: false }) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 14, color: '#9CA3AF', flexShrink: 0 }}
                                title="Delete project"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Health</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: site.health >= 80 ? '#16A34A' : site.health >= 55 ? '#D97706' : site.health != null ? '#DC2626' : '#9CA3AF' }}>{site.health ?? '-'}</div>
                            </div>
                            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>Authority</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: site.authority_score >= 50 ? '#16A34A' : site.authority_score >= 25 ? '#D97706' : site.authority_score ? '#DC2626' : '#9CA3AF' }}>{site.authority_score ?? '-'}</div>
                            </div>
                            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>AI Snippet</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: site.ai_snippet_score >= 80 ? '#16A34A' : site.ai_snippet_score >= 55 ? '#D97706' : site.ai_snippet_score ? '#DC2626' : '#9CA3AF' }}>{site.ai_snippet_score ?? '-'}</div>
                            </div>
                            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: '#9CA3AF' }}>AEO</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: site.aeo_score >= 80 ? '#16A34A' : site.aeo_score >= 55 ? '#D97706' : site.aeo_score ? '#DC2626' : '#9CA3AF' }}>{site.aeo_score ?? '-'}</div>
                            </div>
                          </div>
                          <div className="projects-card-footer">
                            <div className="projects-card-mini-meta">
                              <span>KW {site.keyword_count ?? 0}</span>
                              <span>BL {site.backlink_count ?? 0}</span>
                            </div>
                            <button
                              type="button"
                              className="projects-card-open"
                              onClick={(e) => {
                                e.stopPropagation()
                                enter(site)
                              }}
                            >
                              Open <span aria-hidden="true">&rarr;</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {visibleCount < filteredSites.length && (
                      <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
                        <Button variant="secondary" size="sm" onClick={() => setVisibleCount(v => v + 20)}>
                          Load more ({filteredSites.length - visibleCount} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="right-rail projects-modern-rail">
              <div className="da-goal-card">
                <div className="da-goal-card__label">
                  <FontAwesomeIcon icon={faBullseye} />AI Visibility Goal
                </div>
                <div className="da-goal-card__nums">
                  <span className="da-goal-card__num">{Math.round(summary?.avg_ai_snippet ?? 0)}</span>
                  <span className="da-goal-card__arrow"><FontAwesomeIcon icon={faArrowRight} /></span>
                  <span className="da-goal-card__num">70</span>
                </div>
                <div className="da-goal-card__bar">
                  <div className="da-goal-card__fill" style={{ width: `${Math.min(((summary?.max_dr ?? 0) / 20) * 100, 100)}%` }} />
                </div>
                <p className="da-goal-card__tip">
                  {(summary?.avg_ai_snippet ?? 0) >= 70 ? 'Goal reached! Target AI Snippet score 90+ next.'
                    : (summary?.avg_ai_snippet ?? 0) >= 50 ? 'Good progress - fix remaining AI snippet issues to hit 70+.'
                    : 'Run site audits and fix AI snippet issues to improve visibility in ChatGPT and AI search.'}
                </p>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Setup Checklist</div>
                  {summary && <Badge variant="orange">{summary.checklist.filter(c => c.done).length}/{summary.checklist.length}</Badge>}
                </div>
                <div className="checklist-progress">
                  <div className="checklist-progress__fill" style={{ width: summary ? `${(summary.checklist.filter(c => c.done).length / summary.checklist.length) * 100}%` : '0%' }} />
                </div>
                {(summary?.checklist ?? []).map((item, i) => (
                  <div key={i} className={`checklist-item checklist-item--${item.done ? 'done' : 'todo'}`}>
                    <div className={`checklist-check checklist-check--${item.done ? 'done' : 'todo'}`}>
                      {item.done && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="quick-wins-title">
                  <FontAwesomeIcon icon={faLightbulb} />SEO Action Queue
                </div>
                {(summary?.actions ?? []).map((tip, idx) => (
                  <div key={tip.title} className="quick-win-row">
                    <div className="quick-win-row__rank">{idx + 1}</div>
                    <div className="quick-win-row__content">
                      <div className="quick-win-row__top">
                        <div className="quick-win-row__title">{tip.title}</div>
                        <span className={`quick-win-row__impact quick-win-row__impact--${tip.impact.toLowerCase()}`}>{tip.impact}</span>
                      </div>
                      <div className="quick-win-row__desc">{tip.desc}</div>
                      <div className="quick-win-row__meta">ETA: {tip.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}










