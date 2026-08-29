import { useState, useEffect, useRef } from 'react'
import './AIVisibility.css'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faRotateRight, faShareNodes, faDownload, faChevronDown, faXmark, faPalette, faCode, faLink, faServer, faMagnifyingGlass, faLayerGroup, faComments, faBolt, faInbox } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'
import { useAuth } from '../hooks/useAuth'
import { canUseAiVisibilityFull } from '../utils/features'
import {
  VisibilityKPICards,
} from '../components/AIVisibilitySections3to7'
import {
  VisibilityEngineTable,
  VisibilityReasoningCard,
  VisibilityCompetitorsPanel,
} from '../components/AIVisibilityInsightCards'
import AiMediaTrustPanel from '../components/AiMediaTrustPanel'
import { BrandFavicon } from '../components/SiteFavicon'
import { AI_VISIBILITY_PAGE_FLOW } from '../constants/pageFlows'
import { Modal } from '../components/UI'
import ScoreInfoTip from '../components/ScoreInfoTip'
import AppProcessTopBar from '../components/AppProcessTopBar'
import useProcessScrollSpy from '../hooks/useProcessScrollSpy'

// Picks a colored icon for a detected product card based on what it actually
// is (design, dev, AI-related, backlinks/keywords, infra, or generic audit),
// matching the "icon + colored box" look from the reference mockup.
const PRODUCT_ICON_FALLBACK = [
  { icon: faLayerGroup, bg: '#EFF6FF', color: '#2563EB' },
  { icon: faMagnifyingGlass, bg: '#F5F3FF', color: '#7C3AED' },
  { icon: faWandMagicSparkles, bg: '#FFF7ED', color: '#F97316' },
  { icon: faLink, bg: '#ECFDF5', color: '#059669' },
]

function getProductIcon(name = '', index = 0) {
  const n = name.toLowerCase()
  if (n.includes('ui') || n.includes('ux') || n.includes('design')) {
    return { icon: faPalette, bg: '#EFF6FF', color: '#2563EB' }
  }
  if (n.includes('web') || n.includes('development') || n.includes('react') || n.includes('app') || n.includes('full stack')) {
    return { icon: faCode, bg: '#F5F3FF', color: '#7C3AED' }
  }
  if (n.includes('ai') || n.includes('visibility') || n.includes('geo') || n.includes('aeo')) {
    return { icon: faWandMagicSparkles, bg: '#FFF7ED', color: '#F97316' }
  }
  if (n.includes('backlink') || n.includes('keyword') || n.includes('link')) {
    return { icon: faLink, bg: '#ECFDF5', color: '#059669' }
  }
  if (n.includes('cloud') || n.includes('devops') || n.includes('infrastructure') || n.includes('deploy')) {
    return { icon: faServer, bg: '#FEF2F2', color: '#DC2626' }
  }
  if (n.includes('seo') || n.includes('audit') || n.includes('technical')) {
    return { icon: faMagnifyingGlass, bg: '#EFF6FF', color: '#2563EB' }
  }
  return PRODUCT_ICON_FALLBACK[index % PRODUCT_ICON_FALLBACK.length]
}

function ChatGPTLogo({ size = 24 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#10A37F',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 3.2a4.3 4.3 0 0 1 4.15 3.15 4.3 4.3 0 0 1 2.35 6.95 4.3 4.3 0 0 1-3.6 6.25 4.3 4.3 0 0 1-6.75-.75 4.3 4.3 0 0 1-5.35-4.75 4.3 4.3 0 0 1 1.95-6.3A4.3 4.3 0 0 1 12 3.2Z"
          stroke="white"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.2 7.2 12 9.4l3.8-2.2M8.2 16.8V12.4L4.5 10.2M15.8 16.8 12 14.6l-3.8 2.2M15.8 7.2v4.4l3.7 2.2M12 9.4v5.2"
          stroke="white"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function ClaudeLogo({ size = 24 }) {
  const rays = Array.from({ length: 12 })

  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        {rays.map((_, i) => (
          <line
            key={i}
            x1="16"
            y1="3"
            x2="16"
            y2="10"
            stroke="#F97316"
            strokeWidth="2.4"
            strokeLinecap="round"
            transform={`rotate(${i * 30} 16 16)`}
          />
        ))}
        <circle cx="16" cy="16" r="3.2" fill="#F97316" />
      </svg>
    </span>
  )
}

function ExternalAnswerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 4h6v6M20 4l-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
export default function AIVisibility() {
  const { siteId } = useParams()
  const showSnackbar = useSnackbar()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fullAccess = canUseAiVisibilityFull(user)
  const reportRef = useRef(null)
  const [site, setSite] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [domain, setDomain] = useState('')
  const [products, setProducts] = useState([])
  const [productsDetectedAt, setProductsDetectedAt] = useState(null)
  const [productsStale, setProductsStale] = useState(true)
  const [detectingProducts, setDetectingProducts] = useState(false)
  const [questionSets, setQuestionSets] = useState([])
  const [questionsHydrated, setQuestionsHydrated] = useState(false)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState('All Questions')
  const [addingQuestion, setAddingQuestion] = useState(false)
  // Real period label ("Jul 13 - Aug 12, 2026") and comparison label from
  // the summary endpoint, shown in the header date-range box. Not a
  // functional filter yet - just an honest display of the fixed 30-day
  // window the numbers are actually computed from.
  const [summaryPeriod, setSummaryPeriod] = useState(null)
  const [customQuestionText, setCustomQuestionText] = useState('')
  const [showMoreTabs, setShowMoreTabs] = useState(false)
  const [moreTabsPos, setMoreTabsPos] = useState(null)
  const moreTabsRef = useRef(null)
  // Sessions: each scan run can be tagged to a named session so it can be
  // compared over time later. currentSession is null until the user creates
  // one via "+ New Session"; scans work fine without a session too.
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  const [sessionMenuPos, setSessionMenuPos] = useState(null)
  const sessionMenuRef = useRef(null)
  const sessionBtnRef = useRef(null)
  // Real tested/ready status per question, loaded from the database - not
  // the AI's own guess, so the Status column in the Questions table below
  // reflects what has actually been scanned.
  const [questionStatuses, setQuestionStatuses] = useState([])
  // Custom questions persisted to the database - [{id, question, created_at}]
  const [customQuestions, setCustomQuestions] = useState([])
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [questionSearch, setQuestionSearch] = useState('')
  const [questionPage, setQuestionPage] = useState(1)
  const QUESTIONS_PER_PAGE = 5
  const [selectedQuestion, setSelectedQuestion] = useState('')
  const [openQuestionMenu, setOpenQuestionMenu] = useState(null)
  const [questionMenuPos, setQuestionMenuPos] = useState(null)
  const [selectedQuestionResults, setSelectedQuestionResults] = useState([])
  const [loadingQuestionResults, setLoadingQuestionResults] = useState(false)
  const [selectedAnswerEngine, setSelectedAnswerEngine] = useState(null)
  const [mobileResponseEngine, setMobileResponseEngine] = useState('chatgpt')
  // In-memory cache: first view hits API/DB, later views of the same
  // question reuse this until a Test/Re-test refreshes it.
  const questionResultsCacheRef = useRef({})
  const [scoreExpanded, setScoreExpanded] = useState(true)
  const [testExpanded, setTestExpanded] = useState(true)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [prOpen, setPrOpen] = useState(false)
  const [scrollFlowId, setScrollFlowId] = useProcessScrollSpy(
    AI_VISIBILITY_PAGE_FLOW,
    [fullAccess, scoreExpanded, testExpanded, prOpen, insightsOpen]
  )
  const [prOutletCount, setPrOutletCount] = useState(0)
  const [deleteConfirmQuestion, setDeleteConfirmQuestion] = useState('')
  const [deletingQuestion, setDeletingQuestion] = useState(false)
  const [editQuestionOriginal, setEditQuestionOriginal] = useState('')
  const [editQuestionDraft, setEditQuestionDraft] = useState('')
  const [savingEditQuestion, setSavingEditQuestion] = useState(false)
  const [showAllAnswersModal, setShowAllAnswersModal] = useState(false)

  // Load cached product questions first (free). Only generate once if none exist.
  useEffect(() => {
    if (!siteId) return
    let cancelled = false
    setQuestionsHydrated(false)
    api.get('/sites/' + siteId + '/products/questions')
      .then((res) => {
        if (cancelled) return
        setQuestionSets(res.data?.questionSets || [])
      })
      .catch(() => {
        if (!cancelled) setQuestionSets([])
      })
      .finally(() => {
        if (!cancelled) setQuestionsHydrated(true)
      })
    return () => { cancelled = true }
  }, [siteId])

  useEffect(() => {
    if (!questionsHydrated) return
    if (
      products.length > 0 &&
      questionSets.length === 0 &&
      !generatingQuestions
    ) {
      generateProductQuestions(false)
    }
  }, [products.length, questionSets.length, questionsHydrated])

  useEffect(() => {
    if (!showMoreTabs) return
    const handleClick = (e) => {
      if (
        e.target.closest('.ai-questions-more-wrap') ||
        e.target.closest('.ai-questions-more-dropdown')
      ) return
      setShowMoreTabs(false)
      setMoreTabsPos(null)
    }
    const close = () => {
      setShowMoreTabs(false)
      setMoreTabsPos(null)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [showMoreTabs])

  function toggleMoreTabs(event) {
    event.stopPropagation()
    if (showMoreTabs) {
      setShowMoreTabs(false)
      setMoreTabsPos(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setMoreTabsPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 260),
    })
    setShowMoreTabs(true)
  }
  // Re-fetch question status (and sessions, so scores stay current) right
  // after any scan finishes, so the tables reflect the new data immediately.
  useEffect(() => {
    const handler = () => {
      api.get('/sites/' + siteId + '/ai-visibility/question-status').then(res => {
        setQuestionStatuses(res.data.statuses || [])
      }).catch(() => {})
      api.get('/sites/' + siteId + '/ai-visibility/sessions').then(res => {
        const list = res.data.sessions || []
        setSessions(list)
        setCurrentSession(prev => {
          if (!prev?.id) return prev
          return list.find(s => String(s.id) === String(prev.id)) || prev
        })
      }).catch(() => {})
    }
    window.addEventListener('ai-visibility-scan-complete', handler)
    return () => window.removeEventListener('ai-visibility-scan-complete', handler)
  }, [siteId])

  useEffect(() => {
    if (!showSessionMenu) return
    const onClick = (e) => {
      if (
        e.target.closest('.ai-session-menu-dropdown') ||
        e.target.closest('.ai-session-menu-btn')
      ) return
      setShowSessionMenu(false)
      setCreatingSession(false)
      setSessionMenuPos(null)
    }
    const reposition = () => {
      const btn = sessionBtnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      setSessionMenuPos({
        top: r.bottom + 6,
        left: Math.max(8, r.right - 300),
      })
    }
    reposition()
    document.addEventListener('mousedown', onClick)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', onClick)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [showSessionMenu])

  useEffect(() => {
    api.get('/sites').then(res => {
      const s = (res.data || []).find(x => String(x.id) === String(siteId))
      if (s) {
        setSite(s)
        const d = (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()
        setDomain(d)
      }
    }).catch(() => {})
    api.get('/sites/' + siteId + '/products').then(res => {
      setProducts(res.data.products || [])
      setProductsDetectedAt(res.data.detectedAt || null)
      setProductsStale(res.data.isStale !== false)
    }).catch(() => {})
    // Load previously saved custom questions from the database
    api.get('/sites/' + siteId + '/custom-questions').then(res => {
      setCustomQuestions(res.data.questions || [])
    }).catch(() => {})
    // Load previously created sessions from the database
    api.get('/sites/' + siteId + '/ai-visibility/sessions').then(res => {
      setSessions(res.data.sessions || [])
    }).catch(() => {})
    // Load real tested/ready status per question (for the Status column)
    api.get('/sites/' + siteId + '/ai-visibility/question-status').then(res => {
      setQuestionStatuses(res.data.statuses || [])
    }).catch(() => {})
  }, [siteId])

  async function detectProducts() {
    setDetectingProducts(true)
    try {
      const res = await api.post('/sites/' + siteId + '/products/detect', { engine: 'claude' })
      setProducts(res.data.products || [])
      setProductsDetectedAt(res.data.detectedAt || null)
      setProductsStale(false)
      showSnackbar('Products detected!', 'success')
    } catch (e) {
      showSnackbar('Product detection failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setDetectingProducts(false)
  }

  async function generateProductQuestions(force = false) {
    setGeneratingQuestions(true)
    try {
      const res = await api.post('/sites/' + siteId + '/products/questions', {
        engine: 'claude',
        force: !!force,
      })
      setQuestionSets(res.data.questionSets || [])
      if (res.data.cached) {
        // Silent when served from cache - no spend toast.
      } else {
        showSnackbar((res.data.totalQuestions || 0) + ' questions generated across ' + (res.data.questionSets || []).length + ' products', 'success')
      }
    } catch (e) {
      showSnackbar('Question generation failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setGeneratingQuestions(false)
  }

  // Saves the question to the database so it survives a page refresh.
  // On success, it's added to customQuestions, which flows into
  // combinedQuestionSets below and becomes selectable/testable in
  // AI Visibility Results (section 3), same as AI-generated questions.
  async function addCustomQuestion() {
    const text = customQuestionText.trim()
    if (!text || savingQuestion) return

    setSavingQuestion(true)
    try {
      const res = await api.post('/sites/' + siteId + '/custom-questions', { question: text })
      // Newest custom question first so it leads the All list.
      setCustomQuestions(prev => [res.data, ...prev])
      setSelectedProduct('All Questions')
      setQuestionPage(1)
      setSelectedQuestion(res.data.question || text)
      setCustomQuestionText('')
      setAddingQuestion(false)
      showSnackbar('Question saved and added to the top of the list.', 'success')
    } catch (e) {
      showSnackbar('Failed to save question: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setSavingQuestion(false)
  }

  async function deleteCustomQuestion(id) {
    try {
      await api.delete('/sites/' + siteId + '/custom-questions/' + id)
      setCustomQuestions(prev => prev.filter(q => q.id !== id))
      return true
    } catch (e) {
      showSnackbar('Failed to delete question: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
      return false
    }
  }

  function clearQuestionLocalState(questionText) {
    const q = String(questionText || '')
    if (!q) return
    setQuestionStatuses(prev => prev.filter(s => s.question !== q))
    if (questionResultsCacheRef.current?.[q]) {
      const next = { ...questionResultsCacheRef.current }
      delete next[q]
      questionResultsCacheRef.current = next
    }
    if (selectedQuestion === q) {
      setSelectedQuestion('')
      setSelectedQuestionResults([])
    }
  }

  function requestDeleteQuestion(questionText) {
    const q = String(questionText || '').trim()
    if (!q) return
    setDeleteConfirmQuestion(q)
  }

  async function confirmDeleteQuestion() {
    const q = String(deleteConfirmQuestion || '').trim()
    if (!q || deletingQuestion) return
    setDeletingQuestion(true)
    const custom = customQuestions.find(c => c.question === q)

    try {
      if (custom?.id) {
        const deleted = await deleteCustomQuestion(custom.id)
        if (!deleted) return
      } else {
        const nextSets = questionSets
          .map(set => ({
            ...set,
            questions: (set.questions || []).filter(item => item !== q),
          }))
          .filter(set => (set.questions || []).length > 0)
        const res = await api.put('/sites/' + siteId + '/products/questions', { questionSets: nextSets })
        setQuestionSets(res.data?.questionSets || nextSets)
      }
      clearQuestionLocalState(q)
      setDeleteConfirmQuestion('')
      showSnackbar('Question deleted', 'success')
    } catch (e) {
      showSnackbar('Failed to delete question: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    } finally {
      setDeletingQuestion(false)
    }
  }

  function requestEditQuestion(questionText) {
    const q = String(questionText || '').trim()
    if (!q) return
    setEditQuestionOriginal(q)
    setEditQuestionDraft(q)
  }

  async function confirmEditQuestion() {
    const q = String(editQuestionOriginal || '').trim()
    const trimmed = String(editQuestionDraft || '').trim()
    if (!q || !trimmed || savingEditQuestion) return
    if (trimmed === q) {
      setEditQuestionOriginal('')
      setEditQuestionDraft('')
      return
    }

    setSavingEditQuestion(true)
    const custom = customQuestions.find(c => c.question === q)

    try {
      if (custom?.id) {
        const res = await api.patch('/sites/' + siteId + '/custom-questions/' + custom.id, { question: trimmed })
        setCustomQuestions(prev => prev.map(c => (c.id === custom.id ? { ...c, ...res.data } : c)))
      } else {
        const nextSets = questionSets.map(set => ({
          ...set,
          questions: (set.questions || []).map(item => (item === q ? trimmed : item)),
        }))
        const res = await api.put('/sites/' + siteId + '/products/questions', { questionSets: nextSets })
        setQuestionSets(res.data?.questionSets || nextSets)
      }

      if (selectedQuestion === q) setSelectedQuestion(trimmed)
      setQuestionStatuses(prev => prev.map(s => (s.question === q ? { ...s, question: trimmed } : s)))
      if (questionResultsCacheRef.current?.[q]) {
        const cache = { ...questionResultsCacheRef.current }
        cache[trimmed] = cache[q]
        delete cache[q]
        questionResultsCacheRef.current = cache
      }
      setEditQuestionOriginal('')
      setEditQuestionDraft('')
      showSnackbar('Question updated', 'success')
    } catch (e) {
      showSnackbar('Failed to update question: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    } finally {
      setSavingEditQuestion(false)
    }
  }

  async function refreshSessions() {
    try {
      const res = await api.get('/sites/' + siteId + '/ai-visibility/sessions')
      const list = res.data.sessions || []
      setSessions(list)
      if (currentSession?.id) {
        const updated = list.find(s => String(s.id) === String(currentSession.id))
        if (updated) setCurrentSession(updated)
      }
    } catch {
      // keep existing session list on refresh failure
    }
  }

  // Named sessions group Test/Re-test scans so you can compare visibility
  // over time (e.g. "Before blog update" vs "After blog update").
  async function createNewSession() {
    const name = (newSessionName.trim() || ('Session ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))).slice(0, 200)
    setCreatingSession(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/sessions', { name })
      const created = {
        ...res.data,
        questionsTested: 0,
        score: 0,
        averageRank: null,
        topEnginesCount: 0,
        totalEngines: 2,
      }
      setSessions(prev => [created, ...prev])
      setCurrentSession(created)
      setNewSessionName('')
      setCreatingSession(false)
      setShowSessionMenu(false)
      setSessionMenuPos(null)
      showSnackbar('Session started. New tests will be saved under "' + name + '".', 'success')
    } catch (e) {
      showSnackbar('Failed to create session: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
      setCreatingSession(false)
    }
  }

  function selectSession(session) {
    setCurrentSession(session)
    setShowSessionMenu(false)
    setSessionMenuPos(null)
    setCreatingSession(false)
    showSnackbar('Active session: "' + session.name + '"', 'info')
  }

  async function shareReport() {
    setSharing(true)
    try {
      const res = await api.get('/sites/' + siteId + '/ai-visibility/share')
      const url = window.location.origin + '/public/ai-visibility/' + res.data.token
      await navigator.clipboard.writeText(url).catch(() => {})
      showSnackbar('Share link copied to clipboard!', 'success')
    } catch { showSnackbar('Failed to generate share link', 'error') }
    setSharing(false)
  }

  async function downloadImage() {
    setSharing(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' })
      const link = document.createElement('a')
      link.download = 'ai-visibility-' + (domain || 'report') + '.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      showSnackbar('Image downloaded!', 'success')
    } catch { showSnackbar('Download failed', 'error') }
    setSharing(false)
  }

  // AI-generated questionSets plus a "Custom Questions" group built from the
  // database-backed customQuestions state. Custom questions lead the All list
  // so newly added ones show first. Kept as a computed merge (not mutated into
  // questionSets directly) so regenerating AI questions never wipes custom ones.
  const combinedQuestionSets = customQuestions.length
    ? [
        { product: 'Custom Questions', questions: customQuestions.map(q => q.question) },
        ...questionSets,
      ]
    : questionSets

  // Flat list of all questions across products AND custom questions, used by
  // the AI Visibility Results scan (section 3).
  const flatQuestions = combinedQuestionSets.flatMap(qs => qs.questions || [])
  const visibilitySiteName = site?.name || domain

  const isCustomTab = selectedProduct === 'Custom Questions'

  const allTabs = ['All Questions', ...combinedQuestionSets.map(s => s.product)]
  const visibleTabs = allTabs.slice(0, 2)
  const overflowTabs = allTabs.slice(2)

  function chipLabel(tab) {
    if (tab === 'All Questions') return `All (${flatQuestions.length})`
    const count = combinedQuestionSets.find(s => s.product === tab)?.questions?.length || 0
    const short = tab.length > 24 ? `${tab.slice(0, 22)}...` : tab
    return `${short} (${count})`
  }

  const visibleQuestionSets = selectedProduct === 'All Questions'
    ? combinedQuestionSets
    : combinedQuestionSets.filter(set => set.product === selectedProduct)

  const filteredQuestions = visibleQuestionSets
    .flatMap(set => set.questions || [])
    .filter(q =>
      !questionSearch.trim() ||
      String(q)
        .toLowerCase()
        .includes(questionSearch.trim().toLowerCase())
    )

  const questionPageCount = Math.max(
    Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE),
    1
  )

  const safeQuestionPage = Math.min(
    questionPage,
    questionPageCount
  )

  const questionStartIndex =
    (safeQuestionPage - 1) * QUESTIONS_PER_PAGE

  const visibleQuestions = filteredQuestions.slice(
    questionStartIndex,
    questionStartIndex + QUESTIONS_PER_PAGE
  )

  const testedQuestionsCount = flatQuestions.filter(q =>
    questionStatuses.some(s => s.question === q)
  ).length

  const readyQuestionsCount = Math.max(flatQuestions.length - testedQuestionsCount, 0)

  
  
  
  // Current generated-question KPI.
  // Do not use the historical 30-day question count here because
  // regenerated/old questions may no longer belong to the current project set.
  const currentQuestionTotal = flatQuestions.length

  const currentQuestionsTested = Math.min(
    testedQuestionsCount,
    currentQuestionTotal
  )

  const questionsTestedPercent = currentQuestionTotal > 0
    ? Math.min(
        100,
        Math.round(
          (currentQuestionsTested / currentQuestionTotal) * 100
        )
      )
    : 0

// RESET QUESTION PAGINATION
  // Changing product/category or search should always return to page 1.
  useEffect(() => {
    setQuestionPage(1)
  }, [selectedProduct, questionSearch])

  // If question count shrinks while on a later page,
  // automatically move back to the last valid page.
  useEffect(() => {
    if (questionPage > questionPageCount) {
      setQuestionPage(questionPageCount)
    }
  }, [questionPage, questionPageCount])
  
  // QUESTION PAGINATION RESET
  useEffect(() => {
    setQuestionPage(1)
  }, [selectedProduct, questionSearch])

  useEffect(() => {
    if (questionPage > questionPageCount) {
      setQuestionPage(questionPageCount)
    }
  }, [questionPage, questionPageCount])
  // AUTO SELECT FIRST QUESTION FOR QUESTION/RESPONSE SPLIT VIEW
  useEffect(() => {
    if (!selectedQuestion && visibleQuestions.length > 0) {
      setSelectedQuestion(visibleQuestions[0])
    }

    if (
      selectedQuestion &&
      visibleQuestions.length > 0 &&
      !visibleQuestions.includes(selectedQuestion)
    ) {
      setSelectedQuestion(visibleQuestions[0])
    }
  }, [visibleQuestions, selectedQuestion])

  // QUESTION MENU OUTSIDE CLICK
  useEffect(() => {
    if (!openQuestionMenu) return

    const handleOutsideClick = (event) => {
      const target = event.target

      if (
        target.closest('.ai-question-menu-wrap') ||
        target.closest('.ai-question-menu-dropdown')
      ) {
        return
      }

      setOpenQuestionMenu(null)
      setQuestionMenuPos(null)
    }

    const handleRepositionClose = () => {
      setOpenQuestionMenu(null)
      setQuestionMenuPos(null)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('resize', handleRepositionClose)
    window.addEventListener('scroll', handleRepositionClose, true)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('resize', handleRepositionClose)
      window.removeEventListener('scroll', handleRepositionClose, true)
    }
  }, [openQuestionMenu])

  function openQuestionActionsMenu(event, question) {
    event.stopPropagation()
    if (openQuestionMenu === question) {
      setOpenQuestionMenu(null)
      setQuestionMenuPos(null)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 205
    const menuHeight = 190
    const gap = 6
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    )
    const openUp = rect.bottom + gap + menuHeight > window.innerHeight - 8
    const top = openUp
      ? Math.max(8, rect.top - menuHeight - gap)
      : rect.bottom + gap

    setQuestionMenuPos({ top, left })
    setOpenQuestionMenu(question)
  }
  // Load the real stored AI results for the selected question.
  // First time: fetch from API (DB). Second time: serve from memory cache.
  async function loadSelectedQuestionResults(question, { force = false } = {}) {
    if (!question) {
      setSelectedQuestionResults([])
      return
    }

    if (!force && questionResultsCacheRef.current[question]) {
      setSelectedQuestionResults(questionResultsCacheRef.current[question])
      return
    }

    setLoadingQuestionResults(true)

    try {
      const res = await api.get(
        '/sites/' + siteId + '/ai-visibility/question-response',
        {
          params: { question }
        }
      )

      const results = res.data?.results || []
      questionResultsCacheRef.current[question] = results
      setSelectedQuestionResults(results)
    } catch (error) {
      console.error(
        'Failed to load selected question AI responses:',
        error
      )

      setSelectedQuestionResults([])
    } finally {
      setLoadingQuestionResults(false)
    }
  }


  // Whenever the user selects another question, load its actual
  // ChatGPT / Claude results (cache first, then DB API).
  useEffect(() => {
    questionResultsCacheRef.current = {}
  }, [siteId])

  useEffect(() => {
    loadSelectedQuestionResults(selectedQuestion, { force: false })
  }, [selectedQuestion, siteId])


  // Run/re-run only the selected question.
  async function testSelectedQuestion() {
    if (!selectedQuestion) return

    setLoadingQuestionResults(true)

    try {
      await api.post(
        '/sites/' + siteId + '/ai-visibility/scan',
        {
          siteName: visibilitySiteName,
          questions: [selectedQuestion],
          sessionId: currentSession?.id || null
        }
      )

      await loadSelectedQuestionResults(selectedQuestion, { force: true })

      const statusRes = await api.get(
        '/sites/' + siteId + '/ai-visibility/question-status'
      )

      setQuestionStatuses(
        statusRes.data?.statuses || []
      )

      window.dispatchEvent(new CustomEvent('ai-visibility-scan-complete'))
      await refreshSessions()

      showSnackbar(
        'Question tested successfully',
        'success'
      )
    } catch (error) {
      console.error(
        'Question test failed:',
        error
      )

      showSnackbar(
        'Question test failed',
        'error'
      )
    } finally {
      setLoadingQuestionResults(false)
    }
  }

  // Run a fresh ChatGPT + Claude visibility scan for one exact question.
  async function reTestVisibilityQuestion(question) {
    if (!question) return

    setSelectedQuestion(question)
    setOpenQuestionMenu(null)
    setLoadingQuestionResults(true)

    try {

      const scanRes = await api.post(
        '/sites/' + siteId + '/ai-visibility/scan',
        {
          siteName: visibilitySiteName,
          questions: [question],
          sessionId: currentSession?.id || null
        }
      )

      // Immediately use the NEW scan response instead of waiting for
      // another database request. This makes the right panel update at once.
      const scannedQuestion = (scanRes.data?.results || []).find(
        item => item.question === question
      )

      if (scannedQuestion) {

        const freshResults = (scannedQuestion.results || []).map(result => ({
          engine: result.engine,
          question,
          rankings: result.top10 || result.rankings || [],
          brandRank:
            result.brand_rank !== undefined
              ? result.brand_rank
              : result.brandRank ?? null,
          rawResponse:
            result.raw_response ||
            result.rawResponse ||
            '',
          testedAt: new Date().toISOString()
        }))

        questionResultsCacheRef.current[question] = freshResults
        setSelectedQuestionResults(freshResults)
      }


      // Refresh question status so:
      // Tested / Ready,
      // ChatGPT rank,
      // Claude rank,
      // Last Tested
      // all come from the newly stored DB result.
      const statusRes = await api.get(
        '/sites/' + siteId + '/ai-visibility/question-status'
      )

      setQuestionStatuses(
        statusRes.data?.statuses || []
      )

      window.dispatchEvent(new CustomEvent('ai-visibility-scan-complete'))
      await refreshSessions()

      showSnackbar(
        'Question re-tested with ChatGPT and Claude',
        'success'
      )

    } catch (error) {

      console.error(
        'Question re-test failed:',
        error
      )

      showSnackbar(
        'Question re-test failed: ' +
        (
          error?.response?.data?.error ||
          error?.message ||
          'Unknown error'
        ),
        'error'
      )

    } finally {

      setLoadingQuestionResults(false)

    }
  }

  function getQuestionIntent(question) {
    const q = String(question || '')

    for (const set of combinedQuestionSets) {
      const intent = set?.intents?.[q]

      if (intent) {
        return String(intent).toLowerCase()
      }
    }

    // Custom/legacy questions may not yet have AI intent metadata.
    // Use a sensible dynamic fallback instead of hard-coding Commercial.
    const lower = q.toLowerCase()

    if (
      /\bvs\b/.test(lower) ||
      lower.includes('versus') ||
      lower.includes('compare') ||
      lower.includes('comparison') ||
      lower.includes('difference between') ||
      lower.includes('which is better')
    ) {
      return 'comparison'
    }

    if (
      lower.includes('best ') ||
      lower.includes('top ') ||
      lower.includes('cost') ||
      lower.includes('price') ||
      lower.includes('pricing') ||
      lower.includes('hire') ||
      lower.includes('hiring') ||
      lower.includes('agency') ||
      lower.includes('agencies') ||
      lower.includes('company') ||
      lower.includes('companies') ||
      lower.includes('provider') ||
      lower.includes('providers') ||
      lower.includes('recommend')
    ) {
      return 'commercial'
    }

    return 'informational'
  }

  function getIntentLabel(intent) {
    if (intent === 'comparison') return 'Comparison'
    if (intent === 'informational') return 'Informational'
    return 'Commercial'
  }
  const sectionCard = {
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 12,
    padding: 16,
    boxSizing: 'border-box',
  }

  const sectionTitle = {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }

  const numberBadge = {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#F97316',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 800,
    flexShrink: 0,
  }

  if (!fullAccess) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(145deg, #FF8A4C, #FF6B2B)',
            color: '#fff', display: 'grid', placeItems: 'center',
          }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>AI Visibility</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748B' }}>
              Free plan shows your overall score. Upgrade for full scans and insights.
            </p>
          </div>
        </div>

        <div style={{
          marginTop: 18,
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 14,
          padding: 20,
        }}>
          <VisibilityKPICards
            siteId={siteId}
            freeTeaser
            onSummaryLoaded={setSummaryPeriod}
          />
          <div style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            background: '#FFF7F3',
            border: '1px solid #FED7AA',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#9A3412', marginBottom: 6 }}>
              Unlock full AI Visibility on Pro
            </div>
            <div style={{ fontSize: 13, color: '#78716C', lineHeight: 1.5, marginBottom: 12 }}>
              Engine breakdown, question tests, competitors, reasoning, and recommendations.
              From <strong>199 kr/mo</strong> (Pro) or <strong>499 kr/mo</strong> (Agency).
            </div>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              style={{
                border: 0,
                background: '#E66A39',
                color: '#fff',
                borderRadius: 8,
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              View plans & upgrade
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <AppProcessTopBar
        steps={AI_VISIBILITY_PAGE_FLOW.map((s) => ({
          ...s,
          done:
            s.id === 'score'
              ? Boolean(summaryPeriod) || currentQuestionsTested > 0
              : s.id === 'test'
                ? currentQuestionsTested > 0
                : prOutletCount > 0,
          active: scrollFlowId === s.id,
          onClick: () => {
            if (s.id === 'score') setScoreExpanded(true)
            if (s.id === 'test') setTestExpanded(true)
            if (s.id === 'pr') setPrOpen(true)
            setScrollFlowId(s.id)
            if (s.sectionId) {
              document.getElementById(s.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          },
        }))}
      />

    <div ref={reportRef} className="ai-vis-page">

      <div className="ai-vis-header">
        <div>
          <div className="ai-vis-title-row">
            <div className="ai-vis-title-icon">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </div>
            <h1 className="ai-vis-title">
              <span className="score-label-with-tip">
                AI Visibility
                <ScoreInfoTip scoreKey="aiVisibility" />
              </span>
              {site && <span className="ai-vis-domain-pill">{domain}</span>}
            </h1>
          </div>
          <p className="ai-vis-subtitle">
            Track whether ChatGPT and Claude recommend your brand, and compare scores before vs after changes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {summaryPeriod && (
            <div style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11.5, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }} title="Fixed 30-day window - date filtering isn't built yet">
              <span style={{ fontWeight: 700 }}>{summaryPeriod.periodLabel}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{summaryPeriod.comparisonLabel}</span>
            </div>
          )}

          <div ref={sessionMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="ai-session-menu-btn"
              ref={sessionBtnRef}
              onClick={() => {
                const next = !showSessionMenu
                setShowSessionMenu(next)
                setCreatingSession(false)
                if (next && sessionBtnRef.current) {
                  const r = sessionBtnRef.current.getBoundingClientRect()
                  setSessionMenuPos({
                    top: r.bottom + 6,
                    left: Math.max(8, r.right - 300),
                  })
                } else {
                  setSessionMenuPos(null)
                }
              }}
              style={{
                padding: '8px 13px',
                borderRadius: 7,
                border: '1px solid #FED7AA',
                background: '#FFF7ED',
                color: '#EA580C',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="Group Test/Re-test runs into named sessions to compare visibility over time"
            >
              {currentSession ? currentSession.name : 'Sessions'}
              <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10 }} />
            </button>
          </div>

          {showSessionMenu && sessionMenuPos && createPortal(
              <div
                className="ai-session-menu-dropdown"
                style={{
                  position: 'fixed',
                  top: sessionMenuPos.top,
                  left: sessionMenuPos.left,
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: 10,
                  zIndex: 10050,
                  width: 300,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  Visibility sessions
                </div>
                <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 10, lineHeight: 1.4 }}>
                  Group tests under a named session so you can compare scores before/after changes.
                </div>

                {!creatingSession ? (
                  <button
                    type="button"
                    onClick={() => setCreatingSession(true)}
                    style={{
                      width: '100%',
                      padding: '8px 0',
                      borderRadius: 6,
                      border: '1px solid #F97316',
                      background: '#F97316',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 11,
                      cursor: 'pointer',
                      marginBottom: 8,
                    }}
                  >
                    + New Session
                  </button>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <input
                      autoFocus
                      value={newSessionName}
                      onChange={e => setNewSessionName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createNewSession() }}
                      placeholder="e.g. After homepage rewrite"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #D1D5DB',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#111827',
                        boxSizing: 'border-box',
                        marginBottom: 6,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setCreatingSession(false)}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 6,
                          border: '1px solid #E5E7EB',
                          background: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          color: '#374151',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={createNewSession}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 6,
                          border: 'none',
                          background: '#F97316',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Start
                      </button>
                    </div>
                  </div>
                )}

                {currentSession && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSession(null)
                      setShowSessionMenu(false)
                      setSessionMenuPos(null)
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      border: 0,
                      background: 'transparent',
                      color: '#9A3412',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: 4,
                    }}
                  >
                    Clear active session
                  </button>
                )}

                <div style={{ maxHeight: 180, overflowY: 'auto', borderTop: '1px solid #F3F4F6', paddingTop: 6 }}>
                  {!sessions.length ? (
                    <div style={{ fontSize: 11, color: '#9CA3AF', padding: '8px 4px' }}>
                      No sessions yet. Create one before testing questions.
                    </div>
                  ) : (
                    sessions.slice(0, 8).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSession(s)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 8px',
                          border: 0,
                          borderRadius: 6,
                          background: currentSession?.id === s.id ? '#FFF7ED' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                            {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' | '}{s.questionsTested || 0} tested
                          </div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: (s.score || 0) >= 60 ? '#16A34A' : (s.score || 0) >= 30 ? '#D97706' : '#DC2626' }}>
                          {s.score || 0}%
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
          , document.body)}

          <button onClick={downloadImage} style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} /> Export Report
          </button>
          <button onClick={shareReport} disabled={sharing} style={{ padding: '8px 13px', borderRadius: 7, border: 'none', background: '#F97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faShareNodes} style={{ marginRight: 6 }} /> {sharing ? 'Generating...' : 'Share'}
          </button>
        </div>
      </div>

      {currentSession && (
        <div className="ai-vis-session-banner">
          <span className="ai-vis-session-dot" aria-hidden />
          <span style={{ fontWeight: 800 }}>Active session</span>
          <span style={{ fontWeight: 700 }}>{currentSession.name}</span>
          <span style={{ color: '#C2410C', fontSize: 11.5 }}>
            {currentSession.questionsTested || 0} tested | score {currentSession.score || 0}%
          </span>
          <span style={{ fontSize: 11, opacity: 0.85 }}>
            New tests save here
          </span>
          <button
            type="button"
            onClick={() => setCurrentSession(null)}
            style={{
              marginLeft: 'auto',
              border: '1px solid #FDBA74',
              background: '#fff',
              color: '#9A3412',
              fontSize: 11,
              cursor: 'pointer',
              fontWeight: 700,
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div
        id="ai-section-score"
        style={{
          scrollMarginTop: 72,
          marginBottom: 12,
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setScoreExpanded(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 14px',
            border: 0,
            borderBottom: scoreExpanded ? '1px solid #F1F5F9' : 0,
            background: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#9A3412',
              background: '#FFF7ED', border: '1px solid #FED7AA', flexShrink: 0,
            }}>1</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }} className="score-label-with-tip">
                Score Overview
                <ScoreInfoTip scoreKey="aiVisibility" asSpan />
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                {currentQuestionsTested}/{currentQuestionTotal || 0} questions tested
                {summaryPeriod?.periodLabel ? ` | ${summaryPeriod.periodLabel}` : ''}
              </div>
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronDown} style={{
            color: '#94A3B8',
            fontSize: 12,
            transform: scoreExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }} />
        </button>
        {scoreExpanded ? (
          <div style={{ padding: '12px 14px 14px' }}>
            <VisibilityKPICards
              siteId={siteId}
              onSummaryLoaded={setSummaryPeriod}
              totalQuestions={currentQuestionTotal}
              testedQuestions={currentQuestionsTested}
            />
          </div>
        ) : (
          <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden>
            <VisibilityKPICards
              siteId={siteId}
              onSummaryLoaded={setSummaryPeriod}
              totalQuestions={currentQuestionTotal}
              testedQuestions={currentQuestionsTested}
            />
          </div>
        )}
      </div>

      <div
        id="ai-section-test"
        style={{
          scrollMarginTop: 72,
          marginBottom: 12,
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setTestExpanded(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 14px',
            border: 0,
            borderBottom: testExpanded ? '1px solid #F1F5F9' : 0,
            background: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#9A3412',
              background: '#FFF7ED', border: '1px solid #FED7AA', flexShrink: 0,
            }}>2</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Test Question</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                {testedQuestionsCount} tested | {readyQuestionsCount} ready | {flatQuestions.length} total
              </div>
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronDown} style={{
            color: '#94A3B8',
            fontSize: 12,
            transform: testExpanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }} />
        </button>

        {testExpanded ? (
      <div style={{ padding: '12px 14px 14px' }}>

          {/* Single row: chips + search + add */}
          <div id="ai-questions-toolbar" className="ai-questions-toolbar">
            <div className="ai-questions-chips">
            {visibleTabs.map(tab => (
              <button
                key={tab}
                type="button"
                title={tab === 'All Questions' ? 'All Questions' : tab}
                className={'ai-question-chip ' + (selectedProduct === tab ? 'active' : '')}
                onClick={() => setSelectedProduct(tab)}
              >
                {chipLabel(tab)}
              </button>
            ))}

            {overflowTabs.length > 0 && (
              <div ref={moreTabsRef} className="ai-questions-more-wrap" style={{ position: 'relative', flex: '0 0 auto' }}>
                <button
                  type="button"
                  className={'ai-question-chip ' + (overflowTabs.includes(selectedProduct) ? 'active' : '')}
                  onClick={toggleMoreTabs}
                  aria-expanded={showMoreTabs}
                  style={{ maxWidth: 'none', overflow: 'visible' }}
                >
                  More ({overflowTabs.length})
                  <FontAwesomeIcon icon={faChevronDown} style={{ marginLeft: 5, fontSize: 9 }} />
                </button>
              </div>
            )}
            </div>

            <div className="ai-questions-actions">
            <input
              className="ai-question-search"
              value={questionSearch}
              onChange={e => setQuestionSearch(e.target.value)}
              placeholder="Search..."
            />

            <button
              type="button"
              className="ai-question-add-button"
              onClick={() => setAddingQuestion(true)}
              disabled={addingQuestion}
              style={addingQuestion ? { opacity: 0.55, cursor: 'default' } : undefined}
            >
              + Add
            </button>
            </div>
          </div>

          {addingQuestion && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
                background: '#fff',
                border: '1px solid #E5E7EB',
                padding: 12,
                borderRadius: 9
              }}
            >
              <input
                autoFocus
                value={customQuestionText}
                onChange={e => setCustomQuestionText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addCustomQuestion()
                  if (e.key === 'Escape') {
                    setAddingQuestion(false)
                    setCustomQuestionText('')
                  }
                }}
                placeholder="Ask a question you want to track across AI engines..."
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  border: '1px solid #D1D5DB',
                  borderRadius: 6,
                  fontSize: 11
                }}
              />

              <button
                className="ai-soft-button"
                type="button"
                onClick={() => {
                  setAddingQuestion(false)
                  setCustomQuestionText('')
                }}
                disabled={savingQuestion}
              >
                Cancel
              </button>

              <button
                className="ai-primary-action"
                onClick={addCustomQuestion}
                disabled={!customQuestionText.trim() || savingQuestion}
              >
                {savingQuestion ? 'Saving...' : 'Add'}
              </button>
            </div>
          )}


          {/* Questions + AI response evidence */}
          <div className="ai-question-main-grid">

            {/* LEFT - Questions */}
            <section id="ai-questions-panel" className="ai-question-panel">
              <div className="ai-question-panel-header">
                <div>
                  <h2 className="ai-question-panel-title">
                    Questions AI Users Ask
                  </h2>

                  <div className="ai-question-stats" style={{ marginTop: 5 }}>
                    <span className="generated">
                      {flatQuestions.length} Generated
                    </span>

                    <span className="ai-stat-divider">|</span><span className="tested">
                      {testedQuestionsCount} Tested
                    </span>

                    <span className="ai-stat-divider">|</span><span className="ready">
                      {readyQuestionsCount} Ready
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllAnswersModal(true)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#F97316',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  View all answers
                </button>
              </div>


              <div className="ai-question-table-wrap">
                <table className="ai-question-table">
                  <colgroup>
                    <col className="q-col-question" />
                    <col className="q-col-intent" />
                    <col className="q-col-status" />
                    <col className="q-col-chatgpt" />
                    <col className="q-col-claude" />
                    <col className="q-col-tested" />
                    <col className="q-col-actions" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Intent</th>
                      <th>Status</th>
                      <th>ChatGPT</th>
                      <th>Claude</th>
                      <th>Last Tested</th>
                      <th className="ai-question-actions-header"></th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleQuestions.length > 0 ? (
                      visibleQuestions.map((q, i) => {
                        const status = questionStatuses.find(s => s.question === q)
                        const isTested = !!status

                        const chatgptRankRaw =
                          status?.engines?.chatgpt ??
                          status?.chatgptRank ??
                          status?.chatgpt_rank ??
                          null

                        const claudeRankRaw =
                          status?.engines?.claude ??
                          status?.claudeRank ??
                          status?.claude_rank ??
                          null

                        const chatgptRank = Number.isFinite(Number(chatgptRankRaw)) && Number(chatgptRankRaw) > 0
                          ? Number(chatgptRankRaw)
                          : null

                        const claudeRank = Number.isFinite(Number(claudeRankRaw)) && Number(claudeRankRaw) > 0
                          ? Number(claudeRankRaw)
                          : null

                        return (
                          <tr
                            key={q + '-' + i}
                            className={selectedQuestion === q ? 'ai-question-row-selected' : ''}
                            onClick={() => setSelectedQuestion(q)}
                          >
                            <td className="ai-question-text">
                              {q}
                            </td>

                            <td>
                              <span
                                className={
                                  'ai-intent-pill ai-intent-' +
                                  getQuestionIntent(q)
                                }
                              >
                                {getIntentLabel(
                                  getQuestionIntent(q)
                                )}
                              </span>
                            </td>

                            <td>
                              {isTested ? (
                                <span className="ai-status-tested">
                                  <FontAwesomeIcon icon={faCircleCheck} />
                                  Tested
                                </span>
                              ) : (
                                <span className="ai-status-ready">
                                  <FontAwesomeIcon icon={faRotateRight} />
                                  Ready
                                </span>
                              )}
                            </td>

                            <td>
                              {chatgptRank
                                ? <span className="ai-rank-pill ai-rank-pill--good">#{chatgptRank}</span>
                                : isTested
                                  ? (
                                    <span
                                      className="ai-rank-pill ai-rank-pill--miss"
                                      title="Not ranked in Top 10"
                                    >
                                      Out
                                    </span>
                                  )
                                  : null
                              }
                            </td>

                            <td>
                              {claudeRank
                                ? <span className="ai-rank-pill ai-rank-pill--good">#{claudeRank}</span>
                                : isTested
                                  ? (
                                    <span
                                      className="ai-rank-pill ai-rank-pill--miss"
                                      title="Not ranked in Top 10"
                                    >
                                      Out
                                    </span>
                                  )
                                  : null
                              }
                            </td>

                            <td style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
                              {isTested && status?.lastTested
                                ? new Date(status.lastTested).toLocaleDateString(
                                    'en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' }
                                  )
                                : null
                              }
                            </td>

                            <td className="ai-question-actions-cell">
  <div className="ai-question-menu-wrap">
    <button
      type="button"
      className="ai-question-menu-button"
      aria-expanded={openQuestionMenu === q}
      onClick={(e) => openQuestionActionsMenu(e, q)}
      title="Question actions"
    >
                                  <span className="ai-question-menu-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                  </span>
                                </button>
  </div>
</td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          style={{
                            padding: 30,
                            textAlign: 'center',
                            color: '--'
                              }}
                        >
                          {products.length
                            ? 'Generate questions or add your own question.'
                            : '--'
                              }
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>


              <div className="ai-question-footer">
                <span>
                  Showing {filteredQuestions.length === 0
                    ? 0
                    : questionStartIndex + 1
                  }-{Math.min(
                    questionStartIndex + visibleQuestions.length,
                    filteredQuestions.length
                  )} of {filteredQuestions.length} questions
                </span>

                <>
                  <div className="ai-question-pagination ai-question-pagination--desktop">
                    {safeQuestionPage > 1 && (
                      <button
                        type="button"
                        className="ai-page-button"
                        onClick={() => setQuestionPage(page => Math.max(page - 1, 1))}
                        aria-label="Previous page"
                      >
                        &lt;
                      </button>
                    )}

                    {Array.from(
                      { length: questionPageCount },
                      (_, index) => index + 1
                    ).map(page => (
                      <button
                        key={page}
                        type="button"
                        className={
                          'ai-page-button' +
                          (safeQuestionPage === page ? ' active' : '')
                        }
                        onClick={() => setQuestionPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                    {safeQuestionPage < questionPageCount && (
                      <button
                        type="button"
                        className="ai-page-button"
                        onClick={() =>
                          setQuestionPage(page =>
                            Math.min(page + 1, questionPageCount)
                          )
                        }
                        aria-label="Next page"
                      >
                        &gt;
                      </button>
                    )}
                  </div>

                  <div className="ai-question-pagination--mobile">
                    <button
                      type="button"
                      disabled={safeQuestionPage <= 1}
                      onClick={() => {
                        setQuestionPage(Math.max(safeQuestionPage - 1, 1))
                        requestAnimationFrame(() =>
                          document
                            .querySelector('.ai-question-panel')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        )
                      }}
                    >
                      Previous
                    </button>

                    <span aria-live="polite">
                      Page <strong>{safeQuestionPage}</strong> of {questionPageCount}
                    </span>

                    <button
                      type="button"
                      disabled={safeQuestionPage >= questionPageCount}
                      onClick={() => {
                        setQuestionPage(
                          Math.min(safeQuestionPage + 1, questionPageCount)
                        )
                        requestAnimationFrame(() =>
                          document
                            .querySelector('.ai-question-panel')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        )
                      }}
                    >
                      Next
                    </button>
                  </div>
                </>
              </div>
            </section>


            {/* RIGHT - actual AI answer / ranking evidence */}
            <div id="ai-responses-panel" className="ai-response-column" style={{ scrollMarginTop: 72 }}>
              <div className="ai-response-shell">

                <div className="ai-response-header">
                  <div className="ai-response-title">
                    AI Responses
                    <span style={{ marginLeft: 5, fontSize: 9.5, fontWeight: 500, color: '#64748B' }}>
                      (Selected Question)
                    </span>
                  </div>
                </div>

                <div className="ai-response-selected-question">
                  {selectedQuestion || 'Select a question to view AI responses'}
                </div>

                <div className="ai-response-mobile-tabs" role="tablist" aria-label="AI response engine">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileResponseEngine === 'chatgpt'}
                    className={mobileResponseEngine === 'chatgpt' ? 'active' : ''}
                    onClick={() => setMobileResponseEngine('chatgpt')}
                  >
                    <ChatGPTLogo size={18} />
                    ChatGPT
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileResponseEngine === 'claude'}
                    className={mobileResponseEngine === 'claude' ? 'active' : ''}
                    onClick={() => setMobileResponseEngine('claude')}
                  >
                    <ClaudeLogo size={18} />
                    Claude
                  </button>
                </div>

                <div className="ai-response-engine-grid">

                  {loadingQuestionResults ? (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '36px 16px',
                        textAlign: 'center',
                        color: '#64748B',
                        fontSize: 11
                      }}
                    >
                      Loading AI responses...
                    </div>

                  ) : selectedQuestionResults.length === 0 ? (

                    <div className="ai-vis-empty-state">
                      <div className="ai-vis-empty-icon">
                        <FontAwesomeIcon icon={faBolt} />
                      </div>
                      <div className="ai-vis-empty-title">Not tested yet</div>
                      <div className="ai-vis-empty-text">
                        Run a scan to see whether ChatGPT and Claude mention your brand for this question.
                      </div>
                      <button
                        type="button"
                        className="ai-primary-action"
                        onClick={testSelectedQuestion}
                        style={{ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12 }}
                      >
                        Test Question
                      </button>
                    </div>

                  ) : (

                    ['chatgpt', 'claude'].map(engine => {

                      const result = selectedQuestionResults.find(
                        item =>
                          String(item.engine || '').toLowerCase() === engine
                      )

                      if (!result) {
                        return (
                          <div
                            key={engine}
                            className={'ai-response-engine-card' + (mobileResponseEngine === engine ? ' ai-mobile-engine-active' : '')}
                            data-engine={engine}
                          >
                            <div className="ai-response-engine-top">
                              <div className="ai-response-engine-name">
                              {engine === 'chatgpt'
  ? <ChatGPTLogo size={25} />
  : <ClaudeLogo size={25} />
}

                              <span>
                                {engine === 'chatgpt'
                                  ? 'ChatGPT'
                                  : 'Claude'
                                }
                              </span>
                            </div>

                              <span
                                style={{
                                  fontSize: 9,
                                  color: '#94A3B8'
                                }}
                              >
                                Not tested
                              </span>
                            </div>

                            <div
                              style={{
                                padding: '22px 0',
                                color: '#94A3B8',
                                fontSize: 10
                              }}
                            >
                              No response available.
                            </div>
                          </div>
                        )
                      }

                      const rankings =
                        Array.isArray(result.rankings)
                          ? result.rankings
                          : []

                      const mentioned =
                        result.brandRank !== null &&
                        result.brandRank !== undefined

                      return (
                        <div
                          key={engine}
                          className={'ai-response-engine-card' + (mobileResponseEngine === engine ? ' ai-mobile-engine-active' : '')}
                            data-engine={engine}
                        >
                          <div className="ai-response-engine-top">

                            <div className="ai-response-engine-name">
                              {engine === 'chatgpt'
  ? <ChatGPTLogo size={25} />
  : <ClaudeLogo size={25} />
}

                              <span>
                                {engine === 'chatgpt'
                                  ? 'ChatGPT'
                                  : 'Claude'
                                }
                              </span>
                            </div>

                            <span
                              className={
                                mentioned
                                  ? 'ai-response-mentioned'
                                  : 'ai-response-not-mentioned'
                              }
                            >
                              {mentioned
                                ? 'Mentioned: Yes'
                                : 'Mentioned: No'
                              }
                            </span>

                          </div>


                          <div className="ai-response-rank">
                            Rank:{' '}

                            <strong style={{ color: mentioned ? '#0F172A' : '#94A3B8' }}>
                              {mentioned
                                ? '#' + result.brandRank
                                : rankings.length
                                  ? 'Not in Top 10'
                                  : 'No brands ranked'
                              }
                            </strong>
                          </div>


                          <div className="ai-response-list-title">
                            Top Results
                          </div>


                          {rankings.length > 0 ? (
                            <ol className="ai-response-mentions">

                              {rankings
                                .slice(0, 5)
                                .map(item => {

                                  const name =
                                    String(item?.name || '')

                                  const brand =
                                    String(
                                      visibilitySiteName || ''
                                    ).toLowerCase()

                                  const isYou =
                                    brand &&
                                    name
                                      .toLowerCase()
                                      .includes(brand)

                                  return (
                                    <li
                                      key={
                                        engine +
                                        '-' +
                                        item.rank +
                                        '-' +
                                        name
                                      }
                                    >
                                      {isYou ? (
                                        <span className="ai-response-you" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                          <BrandFavicon name={name} size={14} />
                                          {name} - You
                                        </span>
                                      ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                          <BrandFavicon name={name} size={14} />
                                          {name}
                                        </span>
                                      )}
                                    </li>
                                  )
                                })}

                            </ol>
                          ) : (
                            <div className="ai-vis-rank-empty">
                              <div className="ai-vis-rank-empty-title">
                                <FontAwesomeIcon icon={faInbox} style={{ marginRight: 6, color: '#F97316' }} />
                                No brands listed
                              </div>
                              <div className="ai-vis-rank-empty-hint">
                                This answer was advice-only. AI didn't name agencies.
                                Try a "best / hire / top agencies" style question to get ranked brands.
                              </div>
                            </div>
                          )}


                          {selectedAnswerEngine === engine && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: 10,
                                background: '#F8FAFC',
                                borderRadius: 6,
                                fontSize: 10,
                                lineHeight: 1.55,
                                color: '#475569',
                                maxHeight: 180,
                                overflowY: 'auto',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {result.rawResponse ||
                                'No raw AI answer stored.'
                              }
                            </div>
                          )}


                          <button
                            type="button"
                            className="ai-response-full-button"
                            onClick={() =>
                              setSelectedAnswerEngine(
                                selectedAnswerEngine === engine
                                  ? null
                                  : engine
                              )
                            }
                          >
                            <span>
                              {selectedAnswerEngine === engine
                                ? 'Hide Full Answer'
                                : 'View Full Answer'
                              }
                            </span>

                            <ExternalAnswerIcon />
                          </button>

                        </div>
                      )
                    })

                  )}

                </div>
              </div>
            </div>

          </div>

      </div>
        ) : null}
      </div>

          {/* Insights - same level as sections 1 & 2 */}
          <div style={{
            marginBottom: 12,
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            background: '#fff',
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setInsightsOpen(v => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '12px 14px',
                border: 0,
                borderBottom: insightsOpen ? '1px solid #F1F5F9' : 0,
                background: '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 99,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#64748B',
                  background: '#F8FAFC', border: '1px solid #E5E7EB', flexShrink: 0,
                }}>i</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Insights & competitors</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                    Engine breakdown, ranking gaps, top competitors
                  </div>
                </div>
              </div>
              <FontAwesomeIcon icon={faChevronDown} style={{
                color: '#94A3B8',
                fontSize: 12,
                transform: insightsOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform .15s',
              }} />
            </button>
            {insightsOpen ? (
              <div className="ai-question-lower-grid" style={{ padding: '12px 14px 14px' }}>
                <VisibilityEngineTable siteId={siteId} />
                <VisibilityReasoningCard
                  siteId={siteId}
                  siteName={visibilitySiteName}
                />
                <VisibilityCompetitorsPanel
                  siteId={siteId}
                  siteName={visibilitySiteName}
                />
              </div>
            ) : null}
          </div>

      <div
        id="ai-section-pr"
        style={{
          scrollMarginTop: 72,
          marginBottom: 8,
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setPrOpen(v => !v)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '12px 14px',
            border: 0,
            borderBottom: prOpen ? '1px solid #F1F5F9' : 0,
            background: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#64748B',
              background: '#F8FAFC', border: '1px solid #E5E7EB', flexShrink: 0,
            }}>3</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Digital PR</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                {prOutletCount > 0 ? `${prOutletCount} outlets saved` : 'Discover media after you finish testing'}
              </div>
            </div>
          </div>
          <FontAwesomeIcon icon={faChevronDown} style={{
            color: '#94A3B8',
            fontSize: 12,
            transform: prOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }} />
        </button>
        {prOpen ? (
          <div style={{ padding: '12px 14px 14px' }}>
          <AiMediaTrustPanel
            siteId={siteId}
            siteName={site?.name}
            siteUrl={site?.url || domain}
            onOutletCountChange={setPrOutletCount}
          />
          </div>
        ) : null}
      </div>

      {showMoreTabs && moreTabsPos && createPortal(
        <div
          className="ai-questions-more-dropdown"
          style={{ top: moreTabsPos.top, left: moreTabsPos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {overflowTabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setSelectedProduct(tab)
                setShowMoreTabs(false)
                setMoreTabsPos(null)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 12px',
                border: 0,
                background: selectedProduct === tab ? '#FFF7ED' : '#fff',
                color: selectedProduct === tab ? '#EA580C' : '#374151',
                textAlign: 'left',
                fontSize: 10.5,
                cursor: 'pointer',
              }}
            >
              {tab === 'All Questions'
                ? `All (${flatQuestions.length})`
                : `${tab} (${combinedQuestionSets.find(s => s.product === tab)?.questions?.length || 0})`}
            </button>
          ))}
        </div>,
        document.body
      )}

      {openQuestionMenu && questionMenuPos && createPortal(
        <div
          className="ai-question-menu-dropdown"
          style={{ top: questionMenuPos.top, left: questionMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="ai-question-menu-item"
            onClick={() => {
              setSelectedQuestion(openQuestionMenu)
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
            }}
          >
            <FontAwesomeIcon
              icon={faComments}
              className="ai-question-menu-icon"
            />
            <span>View AI Responses</span>
          </button>

          <button
            type="button"
            className="ai-question-menu-item"
            onClick={async (e) => {
              e.stopPropagation()
              const q = openQuestionMenu
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
              await reTestVisibilityQuestion(q)
            }}
          >
            <FontAwesomeIcon
              icon={faRotateRight}
              className="ai-question-menu-icon"
            />
            <span>
              {questionStatuses.some(s => s.question === openQuestionMenu)
                ? 'Re-test Question'
                : 'Test Question'}
            </span>
          </button>

          <button
            type="button"
            className="ai-question-menu-item"
            onClick={() => {
              const q = openQuestionMenu
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
              requestEditQuestion(q)
            }}
          >
            <FontAwesomeIcon
              icon={faCode}
              className="ai-question-menu-icon"
            />
            <span>Edit Question</span>
          </button>

          <div className="ai-question-menu-separator"></div>

          <button
            type="button"
            className="ai-question-menu-item ai-question-menu-delete"
            onClick={() => {
              const q = openQuestionMenu
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
              requestDeleteQuestion(q)
            }}
          >
            <FontAwesomeIcon
              icon={faXmark}
              className="ai-question-menu-icon"
            />
            <span>Delete Question</span>
          </button>
        </div>,
        document.body
      )}

      <Modal
        open={Boolean(deleteConfirmQuestion)}
        onClose={() => {
          if (deletingQuestion) return
          setDeleteConfirmQuestion('')
        }}
        title="Delete question?"
        subtitle="This removes it from your AI Visibility list. You can add it again later if needed."
        width={440}
        closeOnOverlayClick={!deletingQuestion}
        footer={
          <>
            <button
              type="button"
              disabled={deletingQuestion}
              onClick={() => setDeleteConfirmQuestion('')}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: '#fff',
                color: '#374151',
                fontWeight: 700,
                fontSize: 13,
                cursor: deletingQuestion ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingQuestion}
              onClick={confirmDeleteQuestion}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: 0,
                background: '#DC2626',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: deletingQuestion ? 'not-allowed' : 'pointer',
                opacity: deletingQuestion ? 0.75 : 1,
              }}
            >
              {deletingQuestion ? 'Deleting...' : 'Delete question'}
            </button>
          </>
        }
      >
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#7F1D1D',
          fontSize: 13,
          fontWeight: 650,
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}>
          {deleteConfirmQuestion}
        </div>
      </Modal>

      <Modal
        open={Boolean(editQuestionOriginal)}
        onClose={() => {
          if (savingEditQuestion) return
          setEditQuestionOriginal('')
          setEditQuestionDraft('')
        }}
        title="Edit question"
        subtitle="Update the wording used for ChatGPT and Claude tests."
        width={520}
        closeOnOverlayClick={!savingEditQuestion}
        footer={
          <>
            <button
              type="button"
              disabled={savingEditQuestion}
              onClick={() => {
                setEditQuestionOriginal('')
                setEditQuestionDraft('')
              }}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: '#fff',
                color: '#374151',
                fontWeight: 700,
                fontSize: 13,
                cursor: savingEditQuestion ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={savingEditQuestion || !editQuestionDraft.trim()}
              onClick={confirmEditQuestion}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: 0,
                background: '#E66A39',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: savingEditQuestion || !editQuestionDraft.trim() ? 'not-allowed' : 'pointer',
                opacity: savingEditQuestion || !editQuestionDraft.trim() ? 0.7 : 1,
              }}
            >
              {savingEditQuestion ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      >
        <textarea
          value={editQuestionDraft}
          onChange={(e) => setEditQuestionDraft(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Enter the question..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #D1D5DB',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.45,
            color: '#0F172A',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: 96,
          }}
        />
      </Modal>

      <Modal
        open={showAllAnswersModal}
        onClose={() => setShowAllAnswersModal(false)}
        title="All AI answers"
        subtitle={`${testedQuestionsCount} tested | ${readyQuestionsCount} ready | click a question to open responses`}
        width={720}
        closeOnOverlayClick
        footer={
          <button
            type="button"
            onClick={() => setShowAllAnswersModal(false)}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: '#fff',
              color: '#374151',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        }
      >
        {testedQuestionsCount === 0 ? (
          <div style={{
            padding: '28px 16px',
            textAlign: 'center',
            color: '#64748B',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            No tested questions yet. Pick a question and click <strong>Test Question</strong> to store ChatGPT / Claude answers here.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'min(60vh, 480px)', overflowY: 'auto' }}>
            {questionStatuses.map((status, i) => {
              const q = status.question
              if (!q) return null
              const chatgptRankRaw =
                status?.engines?.chatgpt ??
                status?.chatgptRank ??
                status?.chatgpt_rank ??
                null
              const claudeRankRaw =
                status?.engines?.claude ??
                status?.claudeRank ??
                status?.claude_rank ??
                null
              const chatgptRank = Number.isFinite(Number(chatgptRankRaw)) && Number(chatgptRankRaw) > 0
                ? Number(chatgptRankRaw)
                : null
              const claudeRank = Number.isFinite(Number(claudeRankRaw)) && Number(claudeRankRaw) > 0
                ? Number(claudeRankRaw)
                : null
              const isSelected = selectedQuestion === q

              return (
                <button
                  key={`all-ans-${i}-${q.slice(0, 40)}`}
                  type="button"
                  onClick={() => {
                    setSelectedQuestion(q)
                    setShowAllAnswersModal(false)
                    requestAnimationFrame(() => {
                      document.getElementById('ai-responses-panel')?.scrollIntoView?.({
                        behavior: 'smooth',
                        block: 'nearest',
                      })
                    })
                  }}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${isSelected ? '#FDBA74' : '#E5E7EB'}`,
                    background: isSelected ? '#FFF7ED' : '#fff',
                    borderRadius: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.4 }}>
                    {q}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                    fontSize: 11,
                    color: '#64748B',
                    alignItems: 'center',
                  }}>
                    <span style={{
                      fontWeight: 800,
                      color: '#15803D',
                      background: '#F0FDF4',
                      borderRadius: 99,
                      padding: '2px 8px',
                    }}>
                      Tested
                    </span>
                    <span>
                      ChatGPT: {chatgptRank ? `#${chatgptRank}` : 'Not mentioned'}
                    </span>
                    <span>|</span>
                    <span>
                      Claude: {claudeRank ? `#${claudeRank}` : 'Not mentioned'}
                    </span>
                    {status.lastTested ? (
                      <span style={{ marginLeft: 'auto' }}>
                        {new Date(status.lastTested).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Modal>

    </div>
    </>
  )
}


