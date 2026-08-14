  import { useState, useEffect, useMemo } from 'react'
  import { useParams } from 'react-router-dom'
  import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
  import {
    faPlus, faXmark, faArrowsRotate, faWandMagicSparkles,
    faMagnifyingGlass, faChartLine, faBolt, faCircleCheck, faTrash,
  } from '@fortawesome/free-solid-svg-icons'
  import { Card, SectionLabel, Badge, OrangeBtn, PageHeader, EmptyState, T } from '../components/UI'
  import KeywordGapPanel from '../components/KeywordGapPanel'
  import api from '../utils/api'
  import toast from '../utils/toast'
  import {
    resolveRankMovement,
    formatRankMovementDisplay,
    formatRankPositionLabel,
  } from '../utils/rankMovement'

  const ENGINES = [
    { value: 'google', label: 'Google' },
    { value: 'bing', label: 'Bing' },
    { value: 'duckduckgo', label: 'DuckDuckGo' },
  ]

  const RESEARCH_LOCATIONS = [
    { code: 2578, name: 'Norway', language: 'English' },
    { code: 2840, name: 'United States', language: 'English' },
    { code: 2826, name: 'United Kingdom', language: 'English' },
    { code: 2036, name: 'Australia', language: 'English' },
    { code: 2124, name: 'Canada', language: 'English' },
    { code: 2276, name: 'Germany', language: 'German' },
    { code: 2356, name: 'India', language: 'English' },
  ]

  const RESEARCH_TABS = [
    { id: 'matching', label: 'Matching terms' },
    { id: 'related', label: 'Related' },
    { id: 'questions', label: 'Questions' },
  ]

  function DifficultyBar({ score }) {
    const color = score < 33 ? T.green : score < 66 ? T.amber : T.red
    const label = score < 33 ? 'Easy' : score < 66 ? 'Medium' : 'Hard'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 4, background: T.surface2, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.max(0, score || 0))}%`, height: '100%', background: color, borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 48 }}>{label} {score ?? 0}</span>
      </div>
    )
  }

  function TrendSparkline({ values }) {
    const pts = Array.isArray(values) ? values.filter((v) => Number.isFinite(Number(v))) : []
    if (pts.length < 2) {
      return <span style={{ fontSize: 11, color: T.muted }}>-</span>
    }
    const w = 56
    const h = 18
    const max = Math.max(...pts, 1)
    const min = Math.min(...pts, 0)
    const range = Math.max(max - min, 1)
    const d = pts
      .map((v, i) => {
        const x = (i / (pts.length - 1)) * w
        const y = h - ((Number(v) - min) / range) * (h - 2) - 1
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    const up = pts[pts.length - 1] >= pts[0]
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
        <path d={d} fill="none" stroke={up ? T.green : T.red} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  function IntentBadge({ intent }) {
    if (!intent) return <span style={{ fontSize: 11, color: T.muted }}>-</span>
    const key = String(intent).toLowerCase()
    const styles = {
      informational: { color: '#0369a1', bg: '#e0f2fe' },
      commercial: { color: '#b45309', bg: '#fef3c7' },
      transactional: { color: '#16a34a', bg: '#dcfce7' },
      navigational: { color: '#7c3aed', bg: '#ede9fe' },
    }
    const s = styles[key] || { color: '#374151', bg: '#f3f4f6' }
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
        background: s.bg, color: s.color, whiteSpace: 'nowrap', textTransform: 'capitalize',
      }}>
        {intent}
      </span>
    )
  }

  function getOpportunityTag(volume, difficultyRaw) {
    let diffScore
    if (typeof difficultyRaw === 'number') {
      diffScore = difficultyRaw
    } else {
      const d = String(difficultyRaw || '').toLowerCase()
      diffScore = d === 'easy' ? 20 : d === 'medium' ? 50 : d === 'hard' ? 80 : 50
    }
    const vol = volume || 0
    if (vol >= 500 && diffScore < 40) return { label: 'Quick Win', color: '#16a34a', bg: '#dcfce7', score: 90 }
    if (vol >= 1000 && diffScore < 66) return { label: 'High Value', color: '#0369a1', bg: '#e0f2fe', score: 80 }
    if (vol < 200 && diffScore < 40) return { label: 'Long Tail', color: '#7c3aed', bg: '#ede9fe', score: 70 }
    if (vol >= 500 && diffScore >= 66) return { label: 'High Competition', color: '#b45309', bg: '#fef3c7', score: 40 }
    if (vol < 100 && diffScore >= 50) return { label: 'Low Priority', color: '#6b7280', bg: '#f3f4f6', score: 20 }
    return { label: 'Standard', color: '#374151', bg: '#f9fafb', score: 50 }
  }

  function OpportunityTag({ volume, difficulty }) {
    const tag = getOpportunityTag(volume, difficulty)
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
        background: tag.bg, color: tag.color, whiteSpace: 'nowrap', letterSpacing: '0.02em',
      }}>
        {tag.label}
      </span>
    )
  }

  function opportunityScore(s) {
    return getOpportunityTag(s.volume, s.difficultyScore ?? s.difficulty).score
  }

  function cleanDiscoveryText(value) {
    if (typeof value !== 'string') return value
    return value
      .replace(/[^\w\s"'.,:;#/+%-]+/g, ' | ')
      .replace(/(?:\s*\|\s*)+/g, ' | ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  export default function Keywords() {
    const { siteId } = useParams()
    const [keywords, setKeywords] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({ keyword: '', volume: '', difficulty: 'Easy' })
    const [adding, setAdding] = useState(false)
    const [engine, setEngine] = useState('google')
    const [checking, setChecking] = useState(false)
    const [scanRunning, setScanRunning] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiSuggestions, setAiSuggestions] = useState([])
    const [aiSource, setAiSource] = useState('')
    const [page1Data, setPage1Data] = useState(null)
    const [page1Map, setPage1Map] = useState({})
    const [scanReport, setScanReport] = useState(null)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [deleting, setDeleting] = useState(false)

    const [dfsQuery, setDfsQuery] = useState('')
    const [dfsLoading, setDfsLoading] = useState(false)
    const [dfsMatching, setDfsMatching] = useState([])
    const [dfsRelated, setDfsRelated] = useState([])
    const [dfsQuestions, setDfsQuestions] = useState([])
    const [dfsMeta, setDfsMeta] = useState(null)
    const [researchTab, setResearchTab] = useState('matching')
    const [researchLocation, setResearchLocation] = useState(2578)
    const [researchLanguage, setResearchLanguage] = useState('English')
    const [researchSort, setResearchSort] = useState('volume')
    const [minVolume, setMinVolume] = useState(0)
    const [researchFilter, setResearchFilter] = useState('')
    const [addedKeywords, setAddedKeywords] = useState(new Set())
    const [addingKeywords, setAddingKeywords] = useState(new Set())
    const [bulkAdding, setBulkAdding] = useState(false)
    const [importingProjectKeywords, setImportingProjectKeywords] = useState(false)
    const [discovery, setDiscovery] = useState(null)
    const [discoveryOpen, setDiscoveryOpen] = useState(false)
    const [discoverRunning, setDiscoverRunning] = useState(false)
    const [trackedSearch, setTrackedSearch] = useState('')
    const [trackedTier, setTrackedTier] = useState('all')
    const [trackedShowAll, setTrackedShowAll] = useState(false)

    const applyResearchPayload = (data, queryFallback = '') => {
      const matching = data.matching || data.suggestions || []
      const related = data.related || []
      const questions = data.questions || []
      setDfsMatching(matching)
      setDfsRelated(related)
      setDfsQuestions(questions)
      setDfsMeta(data.meta || null)
      if (data.meta?.locationCode) setResearchLocation(data.meta.locationCode)
      if (data.meta?.languageName) setResearchLanguage(data.meta.languageName)
      if (queryFallback || data.meta?.query) setDfsQuery(queryFallback || data.meta.query || '')
      if (!matching.length && related.length) setResearchTab('related')
      else if (!matching.length && !related.length && questions.length) setResearchTab('questions')
      else setResearchTab('matching')
    }

    const load = () =>
      api.get(`/sites/${siteId}/keywords`).then(r => {
        const kws = r.data || []
        setKeywords(kws)
        setAddedKeywords(prev => {
          const next = new Set(prev)
          kws.forEach(k => next.add(k.keyword.toLowerCase().trim()))
          return next
        })
      }).finally(() => setLoading(false))

    useEffect(() => {
      load()
      api.get(`/sites/${siteId}/keywords/last-search`).then(r => {
        const hasResults =
          (r.data.matching || r.data.suggestions || []).length ||
          (r.data.related || []).length ||
          (r.data.questions || []).length
        if (hasResults) applyResearchPayload(r.data, r.data.query || '')
      }).catch(() => {})
      api.get(`/sites/${siteId}/keywords/auto-discover`).then(r => {
        const data = r.data
        const hasDiscovery =
          (data?.alreadyRanking || []).length ||
          (data?.goodToHave || []).length ||
          (data?.howToGetThem || []).length
        if (hasDiscovery) {
          setDiscovery(data)
          setDiscoveryOpen(true)
        }
      }).catch(() => {})
    }, [siteId])

    const runAutoDiscover = async () => {
      console.log('[Keywords] Rediscover starting', { siteId })
      setDiscoverRunning(true)
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/auto-discover`)
        console.log('[Keywords] Rediscover finished', {
          siteId,
          importedCount: data?.meta?.importedCount || 0,
          alreadyRanking: (data?.alreadyRanking || []).length,
          goodToHave: (data?.goodToHave || []).length,
          howToGetThem: (data?.howToGetThem || []).length,
          sourcesUsed: data?.meta?.sourcesUsed || [],
        })
        setDiscovery(data)
        setDiscoveryOpen(true)
        const imported = data?.meta?.importedCount || 0
        toast.success(
          imported > 0
            ? `Discovery complete Ã¢â‚¬â€ tracked ${imported} ranking keyword${imported === 1 ? '' : 's'}`
            : 'Discovery complete'
        )
        load()
      } catch (e) {
        console.error('[Keywords] Rediscover failed', e.response?.data || e.message)
        toast.error(e.response?.data?.error || 'Keyword discovery failed')
      }
      setDiscoverRunning(false)
    }

    const addDiscoveryKeyword = async (item) => {
      const key = String(item.keyword || '').toLowerCase().trim()
      if (!key || addedKeywords.has(key)) return
      setAddingKeywords(prev => new Set([...prev, key]))
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: item.keyword,
          volume: item.volume || 0,
          difficulty: item.difficulty || 'Medium',
          position: null,
        })
        setAddedKeywords(prev => new Set([...prev, key]))
        toast.success(`Added: ${item.keyword}`)
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
          setAddedKeywords(prev => new Set([...prev, key]))
          toast('Already tracked')
        } else {
          toast.error(msg || 'Failed to add keyword')
        }
      }
      setAddingKeywords(prev => { const n = new Set(prev); n.delete(key); return n })
    }

    const searchDataForSEO = async () => {
      if (!dfsQuery.trim()) return
      setDfsLoading(true)
      setDfsMatching([])
      setDfsRelated([])
      setDfsQuestions([])
      setDfsMeta(null)
      try {
        const loc = RESEARCH_LOCATIONS.find((l) => l.code === Number(researchLocation))
        const { data } = await api.post(`/sites/${siteId}/keywords/dataforseo-suggest`, {
          keyword: dfsQuery.trim(),
          locationCode: Number(researchLocation) || 2840,
          languageName: researchLanguage || loc?.language || 'English',
          limit: 50,
        })
        applyResearchPayload(data, dfsQuery.trim())
        const total =
          (data.matching || data.suggestions || []).length +
          (data.related || []).length +
          (data.questions || []).length
        if (!total) toast.error('No keyword ideas found for this seed')
      } catch (e) {
        toast.error(e.response?.data?.error || 'DataForSEO search failed')
      }
      setDfsLoading(false)
    }

    const researchLists = { matching: dfsMatching, related: dfsRelated, questions: dfsQuestions }

    const visibleResearch = useMemo(() => {
      const list = researchLists[researchTab] || []
      const q = researchFilter.trim().toLowerCase()
      let rows = list.filter((s) => (s.volume || 0) >= Number(minVolume || 0))
      if (q) rows = rows.filter((s) => String(s.keyword || '').toLowerCase().includes(q))
      const sorted = [...rows]
      sorted.sort((a, b) => {
        if (researchSort === 'difficulty') return (a.difficultyScore || 0) - (b.difficultyScore || 0)
        if (researchSort === 'cpc') return (b.cpc || 0) - (a.cpc || 0)
        if (researchSort === 'opportunity') return opportunityScore(b) - opportunityScore(a)
        if (researchSort === 'alpha') return String(a.keyword).localeCompare(String(b.keyword))
        return (b.volume || 0) - (a.volume || 0)
      })
      return sorted
    }, [dfsMatching, dfsRelated, dfsQuestions, researchTab, researchSort, minVolume, researchFilter])

    const researchTotals = useMemo(() => {
      const vol = visibleResearch.reduce((sum, s) => sum + (s.volume || 0), 0)
      const kdVals = visibleResearch.map((s) => s.difficultyScore || 0)
      const avgKd = kdVals.length ? Math.round(kdVals.reduce((a, b) => a + b, 0) / kdVals.length) : 0
      return { count: visibleResearch.length, volume: vol, avgKd }
    }, [visibleResearch])

    const addDfsSuggestion = async (s, { silent = false } = {}) => {
      const key = s.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) return false
      setAddingKeywords(prev => new Set([...prev, key]))
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: s.keyword, volume: s.volume || 0,
          difficulty: s.difficulty || 'Medium', position: null,
        })
        setAddedKeywords(prev => new Set([...prev, key]))
        if (!silent) toast.success(`Added: ${s.keyword}`)
        if (!silent) load()
        return true
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          setAddedKeywords(prev => new Set([...prev, key]))
          if (!silent) toast('Already tracked', { icon: '\u2139\uFE0F' })
          return false
        }
        if (!silent) toast.error(msg || 'Failed to add keyword')
        return false
      } finally {
        setAddingKeywords(prev => { const n = new Set(prev); n.delete(key); return n })
      }
    }

    const addAllVisibleResearch = async () => {
      const pending = visibleResearch.filter((s) => !addedKeywords.has(s.keyword.toLowerCase().trim()))
      if (!pending.length) {
        toast('All visible keywords are already tracked', { icon: '\u2139\uFE0F' })
        return
      }
      setBulkAdding(true)
      let added = 0
      for (const s of pending.slice(0, 25)) {
        const ok = await addDfsSuggestion(s, { silent: true })
        if (ok) added += 1
      }
      setBulkAdding(false)
      if (added > 0) {
        toast.success(`Added ${added} keyword${added === 1 ? '' : 's'} to tracking`)
        load()
      } else {
        toast('No new keywords were added', { icon: '\u2139\uFE0F' })
      }
    }

    const enrichKeywords = async () => {
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/enrich`)
        if (data.enriched > 0) {
          toast.success(`Enriched ${data.enriched} keywords with real volume data`)
          load()
        } else {
          toast(data.message || 'All keywords already have volume data')
        }
      } catch {
        toast.error('Enrichment failed')
      }
    }

    const importFromProject = async () => {
      setImportingProjectKeywords(true)
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/import-from-gsc`, { limit: 30 })
        if ((data?.imported || 0) > 0) {
          toast.success(`Imported ${data.imported} keywords from project GSC data`)
          load()
        } else {
          toast('No new keywords found in project GSC data', { icon: '\u2139\uFE0F' })
        }
      } catch (e) {
        toast.error(e.response?.data?.error || 'Project keyword import failed')
      }
      setImportingProjectKeywords(false)
    }

    const refreshFirstPage = async () => {
      if (!keywords.length) return
      setChecking(true)
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/first-page-status`, { engine, limit: 50 })
        setPage1Data(data)
        const map = {}
        ;(data.details || []).forEach(d => { map[d.id] = d })
        setPage1Map(map)
      } catch {}
      setChecking(false)
    }

    const runWeeklyScanReport = async () => {
      if (!keywords.length) return
      console.log('[Keywords] Weekly scan starting', {
        siteId,
        engine,
        keywordCount: keywords.length,
        limit: 50,
      })
      setScanRunning(true)
      toast('Ranking scan started. This may take a little time.')
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/scan-weekly-now`, { engines: [engine], limit: 50 })
        console.log('[Keywords] Weekly scan finished', {
          siteId,
          engine,
          checked: data?.checked ?? data?.report?.checked,
          alertsCreated: data?.alertsCreated ?? data?.report?.alertsCreated,
          transitions: (data?.report?.transitions || []).length,
          inFirstPage: data?.report?.engines || data?.engines,
        })
        setScanReport(data)
        await load()
      } catch (e) {
        console.error('[Keywords] Weekly scan failed', e.response?.data || e.message)
        setScanReport(null)
      }
      setScanRunning(false)
    }

    const generateAiSuggestions = async () => {
      setAiLoading(true)
      try {
        const { data } = await api.post(`/sites/${siteId}/keywords/ai-suggest`, { limit: 12 })
        setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setAiSource(data.source || 'ai')
      } catch {
        setAiSuggestions([])
        toast.error('Could not generate keyword ideas')
      }
      setAiLoading(false)
    }

    const addAiSuggestion = async (s) => {
      const key = s.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) return
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: s.keyword, volume: s.estimatedVolume || 0,
          difficulty: s.difficulty || 'Medium', position: null,
        })
        setAddedKeywords(prev => new Set([...prev, key]))
        setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
        toast.success(`Added: ${s.keyword}`)
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          setAddedKeywords(prev => new Set([...prev, key]))
          setAiSuggestions(prev => prev.filter(x => x.keyword !== s.keyword))
          toast('Already tracked', { icon: '\u2139\uFE0F' })
        } else {
          toast.error('Failed to add keyword')
        }
      }
    }

    useEffect(() => { setPage1Data(null); setPage1Map({}) }, [engine])

    const add = async () => {
      if (!form.keyword.trim()) return
      const key = form.keyword.toLowerCase().trim()
      if (addedKeywords.has(key)) { toast('Already tracked', { icon: '\u2139\uFE0F' }); return }
      setAdding(true)
      try {
        await api.post(`/sites/${siteId}/keywords`, {
          keyword: form.keyword.trim(), volume: parseInt(form.volume) || 0,
          difficulty: form.difficulty, position: null,
        })
        setForm({ keyword: '', volume: '', difficulty: 'Easy' })
      toast.success('Keyword added successfully')
        load()
      } catch (e) {
        const msg = e.response?.data?.error || ''
        if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already')) {
          toast('Already tracked', { icon: '\u2139\uFE0F' })
        } else {
          toast.error('Failed to add keyword')
        }
      }
      setAdding(false)
    }

    const updatePos = async (id, position) => {
      try { await api.put(`/sites/${siteId}/keywords/${id}`, { position: parseInt(position) || null }) } catch {}
    }

    const confirmDelete = (k) => setDeleteConfirm(k)

    const remove = async () => {
      if (!deleteConfirm) return
      setDeleting(true)
      try {
        await api.delete(`/sites/${siteId}/keywords/${deleteConfirm.id}`)
        setAddedKeywords(prev => {
          const next = new Set(prev)
          next.delete(deleteConfirm.keyword.toLowerCase().trim())
          return next
        })
        toast.success(`Removed: ${deleteConfirm.keyword}`)
        load()
      } catch {
        toast.error('Failed to remove keyword')
      }
      setDeleting(false)
      setDeleteConfirm(null)
    }

    const selectedEngine = ENGINES.find(e => e.value === engine)?.label || 'Google'

    const getPersistedRank = (keyword) => {
      const state = keyword?.rank_state?.[engine] || {}
      const live = page1Map[keyword.id]
      const merged = {
        ...state,
        ...(live?.position != null ? { position: live.position } : {}),
        ...(live?.localPosition != null ? { local_position: live.localPosition } : {}),
        ...(live?.visibility ? { visibility: live.visibility } : {}),
        ...(live?.inFirstPage != null ? { in_first_page: live.inFirstPage } : {}),
        ...(live ? { checked_at: state.checked_at || new Date().toISOString() } : {}),
      }
      const movement = resolveRankMovement(merged)
      return {
        position: movement.position,
        organicPosition: movement.organicPosition,
        localPosition: movement.localPosition,
        previousPosition: movement.previousPosition,
        change: movement.change,
        status: movement.status,
        visibility: movement.visibility,
        inFirstPage: movement.inFirstPage,
        source: movement.source,
        checkedAt: movement.checkedAt,
        checked: movement.checked,
      }
    }

    const getMovementDisplay = (rank) =>
      formatRankMovementDisplay(rank, { muted: T.muted, green: T.green, red: T.red, orange: T.orange })

    const trackedCoverage = keywords.reduce(
      (acc, k) => {
        const rank = getPersistedRank(k)
        if (rank.checked) acc.checked += 1
        if (rank.inFirstPage) acc.page1 += 1
        if (rank.localPosition) acc.local += 1
        return acc
      },
      { checked: 0, page1: 0, local: 0 }
    )

    const firstPageCount = page1Data?.inFirstPageCount ?? trackedCoverage.page1
    const checkedCount = page1Data?.checked ?? trackedCoverage.checked
    const notCheckedCount = Math.max(keywords.length - checkedCount, 0)

    const TRACKED_PAGE_SIZE = 15
    const trackedTierCounts = keywords.reduce((acc, k) => {
      const tier = getOpportunityTag(k.volume, k.difficulty).label
      acc[tier] = (acc[tier] || 0) + 1
      return acc
    }, {})
    const visibleTrackedAll = keywords.filter((k) => {
      if (trackedTier !== 'all' && getOpportunityTag(k.volume, k.difficulty).label !== trackedTier) return false
      if (trackedSearch.trim() && !k.keyword.toLowerCase().includes(trackedSearch.trim().toLowerCase())) return false
      return true
    })
    const visibleTrackedKeywords = trackedShowAll ? visibleTrackedAll : visibleTrackedAll.slice(0, TRACKED_PAGE_SIZE)

    return (
      <div className="fade-in">
        {/* Fixed header */}
        <div style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', margin: 0 }}>Keywords</h1>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Track your target keyword positions</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={runAutoDiscover} disabled={discoverRunning} style={{
              background: T.orangeDim, border: `1px solid ${T.orange}33`, borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, color: T.orange,
              cursor: discoverRunning ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: discoverRunning ? 0.75 : 1,
            }}>
              <FontAwesomeIcon icon={discoverRunning ? faArrowsRotate : faMagnifyingGlass} spin={discoverRunning} />
              {discoverRunning ? 'Discovering...' : 'Rediscover keywords'}
            </button>
            <button onClick={importFromProject} disabled={importingProjectKeywords} style={{
              background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, color: T.text2,
              cursor: importingProjectKeywords ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              opacity: importingProjectKeywords ? 0.75 : 1,
            }}>
              <FontAwesomeIcon icon={faBolt} />
              {importingProjectKeywords ? 'Importing...' : 'Import from Project'}
            </button>
            <button onClick={enrichKeywords} style={{
              background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 600, color: T.text2,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <FontAwesomeIcon icon={faChartLine} />Enrich Volume Data
            </button>
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <KeywordGapPanel siteId={siteId} onAdded={load} />

          {discovery && (
            <Card padding="1.25rem">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: discoveryOpen ? 12 : 0 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontAwesomeIcon icon={faBolt} style={{ color: T.orange }} />
                    <strong style={{ fontSize: 14, color: T.text }}>Project keyword discovery</strong>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                    Google visibility {(discovery.alreadyRanking || []).length}
                    {' · '}Good to have {(discovery.goodToHave || []).length}
                    {' · '}How to get them {(discovery.howToGetThem || []).length}
                    {discovery.meta?.locale?.locationName ? ` · ${discovery.meta.locale.locationName}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setDiscoveryOpen((v) => !v)}
                  style={{
                    background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8,
                    padding: '7px 12px', fontSize: 12, fontWeight: 600, color: T.text2, cursor: 'pointer',
                  }}
                >
                  {discoveryOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {discoveryOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  {[
                    { title: 'Google visibility', items: discovery.alreadyRanking || [], mode: 'tracked' },
                    { title: 'Good to have', items: discovery.goodToHave || [], mode: 'add' },
                    { title: 'How to get them', items: discovery.howToGetThem || [], mode: 'how' },
                  ].map((bucket) => (
                    <div key={bucket.title} style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 10px', background: T.surface2, borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 800, color: T.text }}>
                        {bucket.title}
                        <span style={{ marginLeft: 6, color: T.orange }}>{bucket.items.length}</span>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {bucket.items.length === 0 ? (
                          <div style={{ padding: 12, fontSize: 12, color: T.muted }}>No items</div>
                        ) : bucket.items.slice(0, 12).map((item, idx) => {
                          const key = String(item.keyword || '').toLowerCase().trim()
                          const isAdded = addedKeywords.has(key) || item.tracked
                          const isAdding = addingKeywords.has(key)
                          return (
                            <div key={`${bucket.title}-${key}-${idx}`} style={{
                              padding: '9px 10px',
                              borderBottom: idx < Math.min(bucket.items.length, 12) - 1 ? `1px solid ${T.border}` : 'none',
                              background: isAdded ? '#F0FDF4' : '#fff',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{item.keyword}</div>
                                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                                    {item.position
  ? item.source === 'dfs_ranked'
    ? `Organic #${item.position}`
    : item.source === 'gsc+dfs'
      ? `GSC avg #${item.position} · Live verified`
      : item.source === 'gsc'
        ? `GSC avg #${item.position}`
        : `#${item.position}`
  : '-'}
                                    {' · '}Vol {Number(item.volume || 0).toLocaleString()}
                                    {' · '}{item.difficulty || 'Medium'}
                                  </div>
                                  {bucket.mode === 'how' && item.how && (
                                    <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>{cleanDiscoveryText(item.how)}</div>
                                  )}
                                  {bucket.mode === 'add' && item.why && (
                                    <div style={{ fontSize: 10, color: T.text2, marginTop: 3 }}>{cleanDiscoveryText(item.why)}</div>
                                  )}
                                </div>
                                {bucket.mode === 'tracked' || isAdded ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, color: T.green }}>Tracked</span>
                                ) : (
                                  <button
                                    onClick={() => addDiscoveryKeyword(item)}
                                    disabled={isAdding}
                                    style={{
                                      background: T.orangeDim, color: T.orange, border: 'none', borderRadius: 6,
                                      padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    }}
                                  >
                                    {isAdding ? '...' : '+ Add'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* DataForSEO Keyword Research Panel */}
          <Card padding="1.25rem">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FontAwesomeIcon icon={faMagnifyingGlass} style={{ color: T.orange }} />
                <strong style={{ fontSize: 14, color: T.text }}>Keyword Research</strong>
                <span style={{ fontSize: 11, background: T.orangeDim, color: T.orange, padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>DataForSEO</span>
              </div>
              {dfsMeta?.locationName && (
                <span style={{ fontSize: 11, color: T.muted }}>
                  {dfsMeta.locationName} · {dfsMeta.languageName || researchLanguage}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                placeholder="Seed keyword (e.g. web design norway)"
                value={dfsQuery}
                onChange={e => setDfsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchDataForSEO()}
                style={{ flex: 2, minWidth: 220 }}
              />
              <select
                value={researchLocation}
                onChange={(e) => {
                  const code = Number(e.target.value)
                  setResearchLocation(code)
                  const loc = RESEARCH_LOCATIONS.find((l) => l.code === code)
                  if (loc) setResearchLanguage(loc.language)
                }}
                style={{ width: 160, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff', color: T.text2 }}
              >
                {RESEARCH_LOCATIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <select
                value={researchLanguage}
                onChange={(e) => setResearchLanguage(e.target.value)}
                style={{ width: 130, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, background: '#fff', color: T.text2 }}
              >
                <option value="English">English</option>
                <option value="Norwegian">Norwegian</option>
                <option value="German">German</option>
              </select>
              <OrangeBtn onClick={searchDataForSEO} disabled={dfsLoading || !dfsQuery.trim()}>
                {dfsLoading
                  ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Searching...</>
                  : <><FontAwesomeIcon icon={faMagnifyingGlass} style={{ marginRight: 6 }} />Search</>
                }
              </OrangeBtn>
            </div>

            {(dfsMatching.length > 0 || dfsRelated.length > 0 || dfsQuestions.length > 0) && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 4, background: T.surface2, padding: 3, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    {RESEARCH_TABS.map((tab) => {
                      const count = (researchLists[tab.id] || []).length
                      const active = researchTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setResearchTab(tab.id)}
                          style={{
                            border: 'none',
                            background: active ? '#fff' : 'transparent',
                            color: active ? T.text : T.muted,
                            boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                          <span style={{ marginLeft: 6, color: active ? T.orange : T.muted }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      placeholder="Filter keywords"
                      value={researchFilter}
                      onChange={(e) => setResearchFilter(e.target.value)}
                      style={{ width: 150, fontSize: 12 }}
                    />
                    <select
                      value={researchSort}
                      onChange={(e) => setResearchSort(e.target.value)}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, background: '#fff', color: T.text2 }}
                    >
                      <option value="volume">Sort: Volume</option>
                      <option value="difficulty">Sort: KD (easy first)</option>
                      <option value="opportunity">Sort: Opportunity</option>
                      <option value="cpc">Sort: CPC</option>
                      <option value="alpha">Sort: A-Z</option>
                    </select>
                    <select
                      value={minVolume}
                      onChange={(e) => setMinVolume(Number(e.target.value))}
                      style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, background: '#fff', color: T.text2 }}
                    >
                      <option value={0}>Min vol: Any</option>
                      <option value={10}>Min vol: 10+</option>
                      <option value={50}>Min vol: 50+</option>
                      <option value={100}>Min vol: 100+</option>
                      <option value={500}>Min vol: 500+</option>
                    </select>
                    <OrangeBtn onClick={addAllVisibleResearch} disabled={bulkAdding || !visibleResearch.length}>
                      {bulkAdding
                        ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Adding...</>
                        : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add top 25</>
                      }
                    </OrangeBtn>
                  </div>
                </div>

                <div style={{
                  display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10, padding: '8px 12px',
                  background: T.surface2, borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 12, color: T.text2,
                }}>
                  <span>Showing <strong>{researchTotals.count}</strong></span>
                  <span>Total volume <strong>{researchTotals.volume.toLocaleString()}</strong></span>
                  <span>Avg KD <strong>{researchTotals.avgKd}</strong></span>
                </div>

                <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'auto' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(160px,1.4fr) 90px 100px 70px 56px 150px 70px 60px 90px',
                    gap: 8,
                    padding: '8px 12px',
                    background: T.surface2,
                    borderBottom: `1px solid ${T.border}`,
                    minWidth: 900,
                  }}>
                    {['Keyword', 'Intent', 'Opportunity', 'Volume', 'Trend', 'Difficulty', 'CPC', 'Comp.', ''].map((h) => (
                      <div key={h || 'action'} style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                    ))}
                  </div>

                  {visibleResearch.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: T.muted, fontSize: 13 }}>
                      No keywords match this tab/filter. Try another tab or lower the min volume.
                    </div>
                  ) : visibleResearch.map((s, i) => {
                    const key = s.keyword.toLowerCase().trim()
                    const isAdded = addedKeywords.has(key)
                    const isAdding = addingKeywords.has(key)
                    return (
                      <div key={`${researchTab}-${s.keyword}-${i}`} style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(160px,1.4fr) 90px 100px 70px 56px 150px 70px 60px 90px',
                        gap: 8,
                        padding: '10px 12px',
                        alignItems: 'center',
                        borderBottom: i < visibleResearch.length - 1 ? '1px solid #F3F4F6' : 'none',
                        background: isAdded ? '#F0FDF4' : '#fff',
                        minWidth: 900,
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{s.keyword}</div>
                          {s.parentTopic && (
                            <div style={{ fontSize: 10, color: T.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Parent: {s.parentTopic}
                            </div>
                          )}
                        </div>
                        <div><IntentBadge intent={s.intent} /></div>
                        <div><OpportunityTag volume={s.volume} difficulty={s.difficultyScore || s.difficulty} /></div>
                        <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: T.text2, fontWeight: 700 }}>
                          {s.volume?.toLocaleString() || '-'}
                        </div>
                        <TrendSparkline values={s.trend} />
                        <DifficultyBar score={s.difficultyScore || 0} />
                        <div style={{ fontSize: 12, color: T.text2 }}>${Number(s.cpc || 0).toFixed(2)}</div>
                        <div style={{ fontSize: 12, color: T.text2 }}>
                          {s.competition ? `${(s.competition * 100).toFixed(0)}%` : '-'}
                        </div>
                        <div>
                          {isAdded ? (
                            <span style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FontAwesomeIcon icon={faCircleCheck} />Added
                            </span>
                          ) : (
                            <button onClick={() => addDfsSuggestion(s)} disabled={isAdding || bulkAdding} style={{
                              background: isAdding ? T.surface2 : T.orangeDim, color: isAdding ? T.muted : T.orange,
                              border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12,
                              fontWeight: 700, cursor: isAdding ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4, opacity: isAdding ? 0.6 : 1,
                            }}>
                              {isAdding ? <><FontAwesomeIcon icon={faArrowsRotate} spin />Adding...</> : <><FontAwesomeIcon icon={faPlus} />Add</>}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* Manual add + AI suggestions */}
          <Card padding="1.25rem">
            <SectionLabel>Add keyword manually</SectionLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input placeholder="Keyword" value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} style={{ flex: 2, minWidth: 200 }} />
              <input placeholder="Vol/mo" value={form.volume} onChange={e => setForm(p => ({ ...p, volume: e.target.value }))} style={{ width: 90 }} type="number" />
              <select value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))} style={{ width: 110 }}>
                <option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
              <OrangeBtn onClick={add} disabled={adding}>
                {adding ? 'Adding...' : <><FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add</>}
              </OrangeBtn>
              <OrangeBtn onClick={generateAiSuggestions} disabled={aiLoading}>
                {aiLoading
                  ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Thinking...</>
                  : <><FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 6 }} />AI suggestions</>
                }
              </OrangeBtn>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: T.muted, lineHeight: 1.45 }}>
              AI Suggestions are creative ideas from Claude (estimated volume) Ã¢â‚¬â€ not live ranking data.
              Use <strong style={{ fontWeight: 700 }}>Rediscover keywords</strong> for real GSC / DataForSEO inventory.
            </div>

            {aiSuggestions.length > 0 && (
              <div style={{ marginTop: 12, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', background: T.surface2, fontSize: 11, color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${T.border}` }}>
                  AI Keyword Ideas
                  <span style={{ marginLeft: 8, fontWeight: 500, textTransform: 'none', color: T.muted }}>
                    ({aiSource === 'fallback' ? 'smart fallback' : aiSource === 'cache' ? 'saved AI cache' : 'Claude AI · estimated volume'})
                  </span>
                </div>
                {aiSuggestions.slice(0, 8).map((s, idx) => {
                  const key = s.keyword.toLowerCase().trim()
                  const isAdded = addedKeywords.has(key)
                  return (
                    <div key={`${s.keyword}-${idx}`} style={{
                      padding: '9px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: idx < Math.min(aiSuggestions.length, 8) - 1 ? `1px solid ${T.border}` : 'none', gap: 8,
                      background: isAdded ? '#F0FDF4' : '#fff',
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {s.keyword}
                          <OpportunityTag volume={s.estimatedVolume} difficulty={s.difficulty} />
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>
                          {s.intent || 'Informational'} · {s.difficulty || 'Medium'} · Vol ~{s.estimatedVolume || 0}
                          {s.why ? ` · ${s.why}` : ''}
                        </div>
                      </div>
                      {isAdded ? (
                        <span style={{ fontSize: 11, color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                          <FontAwesomeIcon icon={faCircleCheck} />Added
                        </span>
                      ) : (
                        <OrangeBtn onClick={() => addAiSuggestion(s)}>
                          <FontAwesomeIcon icon={faPlus} style={{ marginRight: 6 }} />Add
                        </OrangeBtn>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Tracked keywords table */}
          <Card padding="0">
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                Tracked Keywords ({keywords.length})
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={engine} onChange={e => setEngine(e.target.value)} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 9px', fontSize: 12, color: T.text2, background: '#fff' }}>
                  {ENGINES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                <OrangeBtn onClick={refreshFirstPage} disabled={checking || !keywords.length}>
                  {checking ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Checking...</> : <><FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} />Check Page 1</>}
                </OrangeBtn>
                <OrangeBtn onClick={runWeeklyScanReport} disabled={scanRunning || !keywords.length}>
                  {scanRunning ? <><FontAwesomeIcon icon={faArrowsRotate} spin style={{ marginRight: 6 }} />Scanning...</> : <>Weekly scan report</>}
                </OrangeBtn>
              </div>
            </div>

            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                placeholder="Filter tracked keywords"
                value={trackedSearch}
                onChange={(e) => setTrackedSearch(e.target.value)}
                style={{ width: 200, fontSize: 12 }}
              />
              {['all', 'High Value', 'Quick Win', 'Long Tail', 'Standard', 'High Competition', 'Low Priority'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTrackedTier(tier)}
                  style={{
                    border: `1px solid ${T.border}`,
                    borderRadius: 99,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: trackedTier === tier ? T.orangeDim : '#fff',
                    color: trackedTier === tier ? T.orange : T.text2,
                  }}
                >
                  {tier === 'all' ? `All (${keywords.length})` : `${tier} (${trackedTierCounts[tier] || 0})`}
                </button>
              ))}
            </div>

            {keywords.length > 0 && (
              <div style={{ padding: '10px 20px', background: T.surface2, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: T.text2 }}>
                  Tracked: <strong style={{ color: T.text }}>{keywords.length}</strong>
                  {' · '}Rank checked: <strong style={{ color: T.text }}>{checkedCount}/{keywords.length}</strong>
                  {' · '}Page-1: <strong style={{ color: firstPageCount > 0 ? T.green : T.muted }}>{firstPageCount}/{checkedCount}</strong>
                  {' · '}Not checked: <strong style={{ color: T.text }}>{notCheckedCount}</strong>
                  {trackedCoverage.local > 0 && (
                    <span style={{ marginLeft: 8, color: T.orange, fontWeight: 700 }}>
                      ({trackedCoverage.local} Local Pack)
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: T.muted }}>Page-1 counts Local Pack + organic top 10 (Norway-aware).</span>
              </div>
            )}

            {scanReport?.report && (
              <div style={{ margin: '12px 20px', padding: '12px 14px', borderRadius: 10, background: '#F8FAFC', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 12, color: T.text }}>Weekly Rank Scan Report</strong>
                  <span style={{ fontSize: 11, color: T.muted }}>{new Date(scanReport.report.generatedAt).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: T.text2 }}>
                  <span>Checked: <strong>{scanReport.report.checkedKeywords}</strong></span>
                  <span>Alerts: <strong>{scanReport.report.alertsCreated}</strong></span>
                  <span>Entered page 1: <strong style={{ color: T.green }}>{(scanReport.report.transitions || []).filter(t => t.action === 'entered').length}</strong></span>
                  <span>Dropped: <strong style={{ color: T.red }}>{(scanReport.report.transitions || []).filter(t => t.action === 'dropped').length}</strong></span>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: T.muted }}>Loading...</div>
            ) : keywords.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: T.muted, fontSize: 13 }}>
                No keywords yet. Search for keywords above or add manually.
                <div style={{ marginTop: 10 }}>
                  <OrangeBtn onClick={importFromProject} disabled={importingProjectKeywords}>
                    <FontAwesomeIcon icon={faBolt} style={{ marginRight: 6 }} />
                    {importingProjectKeywords ? 'Importing from project...' : 'Import from project data'}
                  </OrangeBtn>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 90px 100px 120px 76px 110px 40px', gap: 8, fontSize: 11, color: T.muted, padding: '8px 20px', borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Keyword</span>
                  <span>Opportunity</span>
                  <span style={{ textAlign: 'right' }}>Vol/mo</span>
                  <span style={{ textAlign: 'center' }}>Difficulty</span>
                  <span style={{ textAlign: 'center' }}>Visibility</span>
                  <span style={{ textAlign: 'center' }}>Change</span>
                  <span style={{ textAlign: 'center' }}>Page 1</span>
                  <span style={{ textAlign: 'center' }}>Last checked</span>
                  <span></span>
                </div>
                {visibleTrackedKeywords.map(k => {
                  const rank = getPersistedRank(k)
                  const movement = getMovementDisplay(rank)
                  const posLabel = formatRankPositionLabel(rank)
                  return (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 90px 100px 120px 76px 110px 40px', gap: 8, alignItems: 'center', padding: '10px 20px', borderBottom: `1px solid #F3F4F6` }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{k.keyword}</span>
                    <div><OpportunityTag volume={k.volume} difficulty={k.difficulty} /></div>
                    <span style={{ fontSize: 13, textAlign: 'right', fontFamily: 'DM Mono, monospace', color: T.text2 }}>{k.volume?.toLocaleString()}</span>
                    <div style={{ textAlign: 'center' }}><Badge status={k.difficulty} /></div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: posLabel.colorKey === 'local' ? T.orange : posLabel.colorKey === 'organic' ? T.text : T.muted,
                      }}>
                        {posLabel.label}
                      </div>
                      <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{posLabel.sub}</div>
                    </div>
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: movement.color,
                        whiteSpace: 'nowrap',
                      }}
                      title={
                        rank.localPosition
                          ? `Local Pack #${rank.localPosition}${rank.organicPosition ? ` · Organic #${rank.organicPosition}` : ''}`
                          : rank.previousPosition
                            ? `Previous position: #${rank.previousPosition}`
                            : rank.status === 'lost'
                              ? 'Was ranked before, now missing from SERP'
                              : 'No valid previous ranking'
                      }
                    >
                      {movement.label}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {!rank.checked
                        ? <Badge variant="default">-</Badge>
                        : rank.inFirstPage
                          ? <Badge variant="success">{rank.localPosition ? 'Local' : 'Yes'}</Badge>
                          : <Badge variant="danger">No</Badge>
                      }
                    </div>
                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 10,
                        color: T.muted,
                        lineHeight: 1.25,
                      }}
                      title={
                        rank.checkedAt
                          ? new Date(rank.checkedAt).toLocaleString()
                          : 'Not scanned yet'
                      }
                    >
                      {rank.checkedAt
                        ? new Date(rank.checkedAt).toLocaleDateString()
                        : 'Not scanned'}
                    </div>
                    <button
                      onClick={() => confirmDelete(k)}
                      title="Remove keyword"
                      style={{ background: 'none', border: 'none', color: T.muted, fontSize: 14, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = T.muted}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  )
                })}
                {visibleTrackedAll.length > TRACKED_PAGE_SIZE && (
                  <div style={{ padding: '12px 20px', textAlign: 'center', borderTop: `1px solid ${T.border}` }}>
                    <button
                      onClick={() => setTrackedShowAll((v) => !v)}
                      style={{
                        border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 14px',
                        fontSize: 12, fontWeight: 700, color: T.text2, background: T.surface2, cursor: 'pointer',
                      }}
                    >
                      {trackedShowAll ? 'Show less' : `Show all (${visibleTrackedAll.length})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
          >
            <div style={{ background: '#fff', borderRadius: 16, padding: '32px', maxWidth: 400, width: '90%', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <FontAwesomeIcon icon={faTrash} style={{ color: '#ef4444', fontSize: 18 }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8 }}>Remove Keyword?</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>This will permanently remove:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, wordBreak: 'break-all' }}>
                "{deleteConfirm.keyword}"
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 24 }}>
                All tracking history will be lost. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${T.border}`, background: '#fff', fontSize: 13, fontWeight: 600, color: T.text2, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={remove}
                  disabled={deleting}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: deleting ? '#fca5a5' : '#ef4444', fontSize: 13, fontWeight: 700, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {deleting
                    ? <><FontAwesomeIcon icon={faArrowsRotate} spin />Removing...</>
                    : <><FontAwesomeIcon icon={faTrash} />Remove</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
