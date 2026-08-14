import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faRotateRight, faShareNodes, faDownload, faChevronDown, faXmark, faPalette, faCode, faLink, faServer, faMagnifyingGlass, faLayerGroup, faComments } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'
import {
  VisibilityReasoningCard,
  VisibilityKPICards,
  VisibilityEngineTable,
  VisibilityCompetitorsPanel,
} from '../components/AIVisibilitySections3to7'

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
  const moreTabsRef = useRef(null)
  // Sessions: each scan run can be tagged to a named session so it can be
  // compared over time later. currentSession is null until the user creates
  // one via "+ New Session"; scans work fine without a session too.
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
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
    const handleClick = e => { if (moreTabsRef.current && !moreTabsRef.current.contains(e.target)) setShowMoreTabs(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Re-fetch question status (and sessions, so scores stay current) right
  // after any scan finishes, so the tables reflect the new data immediately.
  useEffect(() => {
    const handler = () => {
      api.get('/sites/' + siteId + '/ai-visibility/question-status').then(res => {
        setQuestionStatuses(res.data.statuses || [])
      }).catch(() => {})
      api.get('/sites/' + siteId + '/ai-visibility/sessions').then(res => {
        setSessions(res.data.sessions || [])
      }).catch(() => {})
    }
    window.addEventListener('ai-visibility-scan-complete', handler)
    return () => window.removeEventListener('ai-visibility-scan-complete', handler)
  }, [siteId])

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
        // Silent when served from cache — no spend toast.
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
    } catch (e) {
      showSnackbar('Failed to delete question', 'error')
    }
  }

  // Creates a named session and makes it the active one - future scans
  // (run from AI Visibility Results) get tagged to it via sessionId, so
  // this scan run can be found again later in Recent Sessions.
  async function createNewSession() {
    const name = (newSessionName.trim() || (visibleQuestions[0] || 'New session')).slice(0, 200)
    setCreatingSession(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/sessions', { name })
      setSessions(prev => [{ ...res.data, questionsTested: 0, score: 0, averageRank: null }, ...prev])
      setCurrentSession(res.data)
      setNewSessionName('')
      showSnackbar('New session started: "' + name + '"', 'success')
    } catch (e) {
      showSnackbar('Failed to create session: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setCreatingSession(false)
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
  const visibleTabs = allTabs.slice(0, 5)
  const overflowTabs = allTabs.slice(5)

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
  async function loadSelectedQuestionResults(question) {
    if (!question) {
      setSelectedQuestionResults([])
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

      setSelectedQuestionResults(
        res.data?.results || []
      )
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
  // ChatGPT / Claude results from the database.
  useEffect(() => {
    loadSelectedQuestionResults(selectedQuestion)
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

      await loadSelectedQuestionResults(selectedQuestion)

      const statusRes = await api.get(
        '/sites/' + siteId + '/ai-visibility/question-status'
      )

      setQuestionStatuses(
        statusRes.data?.statuses || []
      )

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


      // Re-read the stored result as final source of truth.
      await loadSelectedQuestionResults(question)


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

  return (
    <div ref={reportRef} className="ai-vis-page">
      <style>{`
        .ai-vis-page {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 18px 22px 28px;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .ai-vis-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .ai-vis-layout {
          display: grid;
          grid-template-columns: minmax(0, 2.1fr) minmax(300px, 340px);
          gap: 14px;
          align-items: start;
        }
        .ai-vis-left, .ai-vis-right {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }
        .ai-vis-engine-trend-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .ai-product-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 14px;
        }
        .ai-product-card {
          border: 1px solid #E5E7EB;
          border-radius: 9px;
          padding: 12px;
          min-height: 82px;
          background: #fff;
          cursor: pointer;
          transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .ai-product-card:hover {
          border-color: #FDBA74;
          box-shadow: 0 3px 10px rgba(249,115,22,.08);
          transform: translateY(-1px);
        }
        .ai-question-tabs {
          display: flex;
          align-items: center;
          gap: 18px;
          border-bottom: 1px solid #E5E7EB;
          margin-top: 12px;
        }
        .ai-question-tab {
          border: 0;
          background: transparent;
          padding: 8px 2px;
          white-space: nowrap;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
          color: #6B7280;
          border-bottom: 2px solid transparent;
        }
        .ai-question-tab.active {
          color: #F97316;
          border-bottom-color: #F97316;
          font-weight: 700;
        }
        .ai-question-row {
          display: grid;
          grid-template-columns: 28px minmax(0,1fr) 90px 90px 100px;
          gap: 8px;
          align-items: center;
          padding: 8px 4px;
          border-bottom: 1px solid #F3F4F6;
          font-size: 12px;
        }
        .ai-vis-left > div, .ai-vis-right > div {
          margin-bottom: 0 !important;
        }
        
        /* =====================================================
           Questions UX - target AI Visibility design
           ===================================================== */

        .ai-questions-toolbar {
          display: flex;
          margin-top: 16px;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          flex-wrap: wrap;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .ai-question-chip {
          border: 1px solid #E5E7EB;
          background: #fff;
          color: #475569;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-question-chip.active {
          border-color: #F97316;
          color: #EA580C;
          background: #FFF7ED;
        }

        .ai-question-search {
          margin-left: auto;
          width: 220px;
          min-width: 180px;
          height: 32px;
          border: 1px solid #E5E7EB;
          background: #fff;
          border-radius: 7px;
          padding: 0 11px;
          font-size: 11px;
          color: #111827;
          outline: none;
          box-sizing: border-box;
        }

        .ai-question-search:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 2px rgba(249,115,22,.08);
        }

        .ai-question-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(0, .88fr);
          gap: 14px;
          align-items: start;
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        .ai-question-panel {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          min-width: 0;
          overflow: hidden;
        }

        .ai-question-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px 11px;
        }

        .ai-question-panel-title {
          margin: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 800;
        }

        .ai-question-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10.5px;
          color: #64748B;
          flex-wrap: wrap;
        }

        .ai-question-stats .generated {
          color: #475569;
        }

        .ai-question-stats .tested {
          color: #16A34A;
          font-weight: 700;
        }

        .ai-question-stats .ready {
          color: #2563EB;
          font-weight: 700;
        }

        .ai-question-table-wrap {
          width: 100%;
          overflow: hidden;
          padding: 0 0 8px;
          box-sizing: border-box;
          border-radius: 0 0 12px 12px;
        }

        .ai-question-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          font-size: 10.5px;
        }


        .ai-question-table th:nth-child(1),
        .ai-question-table td:nth-child(1) {
          width: 42%;
        }

        .ai-question-table th:nth-child(2),
        .ai-question-table td:nth-child(2) {
          width: 12%;
        }

        .ai-question-table th:nth-child(3),
        .ai-question-table td:nth-child(3) {
          width: 11%;
        }

        .ai-question-table th:nth-child(4),
        .ai-question-table td:nth-child(4) {
          width: 9%;
          text-align: center;
        }

        .ai-question-table th:nth-child(5),
        .ai-question-table td:nth-child(5) {
          width: 9%;
          text-align: center;
        }

        .ai-question-table th:nth-child(6),
        .ai-question-table td:nth-child(6) {
          width: 14%;
          white-space: nowrap;
        }

        .ai-question-table th:nth-child(7),
        .ai-question-table td:nth-child(7) {
          width: 3%;
          text-align: center;
        }
        .ai-question-table thead th {
          background: #F8FAFC;
          color: #475569;
          text-align: left;
          font-size: 9.5px;
          font-weight: 700;
          padding: 8px 9px;
          border-top: 1px solid #E5E7EB;
          border-bottom: 1px solid #E5E7EB;
        }

        .ai-question-table tbody td {
          padding: 9px;
          border-bottom: 1px solid #F1F5F9;
          color: #374151;
          vertical-align: middle;
        }

        .ai-question-table tbody tr {
          cursor: pointer;
          transition: background .12s;
        }

        .ai-question-table tbody tr:hover {
          background: #FFF7ED;
        }

        .ai-question-text {
          color: #111827 !important;
          font-weight: 650;
          line-height: 1.4;
          white-space: normal;
          word-break: normal;
          overflow-wrap: break-word;
          padding-right: 16px !important;
        }

        .ai-intent-pill {
          display: inline-flex;
          padding: 3px 7px;
          border-radius: 999px;
          background: #FFEDD5;
          color: #C2410C;
          font-size: 9px;
          font-weight: 600;
        }


        .ai-intent-commercial {
          background: #FFEDD5 !important;
          color: #C2410C !important;
        }

        .ai-intent-informational {
          background: #DBEAFE !important;
          color: #2563EB !important;
        }

        .ai-intent-comparison {
          background: #EDE9FE !important;
          color: #6D28D9 !important;
        }
        .ai-status-tested,
        .ai-status-ready {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9.5px;
          font-weight: 700;
          white-space: nowrap;
        }

        .ai-status-tested {
          color: #15803D;
        }

        .ai-status-ready {
          color: #2563EB;
        }

        .ai-rank-good {
          color: #15803D;
          font-weight: 800;
        }

        .ai-question-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 9px 14px 12px;
          font-size: 10px;
          color: #64748B;
          gap: 10px;
        }

        
        /* PAGINATION BUTTON RESET */
        .ai-question-pagination .ai-page-button {
          appearance: none;
          font-family: inherit;
          cursor: pointer;
        }

        .ai-question-pagination .ai-page-button:hover:not(.active) {
          background: #FFF7ED;
          border-color: #FDBA74;
          color: #EA580C;
        }

        .ai-question-pagination .ai-page-button.active {
          cursor: default;
        }

        .ai-question-pagination {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .ai-page-button {
          width: 27px;
          height: 27px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #E5E7EB;
          background: #fff;
          border-radius: 5px;
          color: #475569;
          font-size: 10px;
        }

        .ai-page-button.active {
          background: #F97316;
          color: #fff;
          border-color: #F97316;
        }

        .ai-response-column {
          min-width: 0;
        }

        .ai-question-lower-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
          gap: 14px;
          margin-top: 14px;
          align-items: start;
        }

        .ai-question-actions-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 16px 14px;
          flex-wrap: wrap;
        }

        .ai-question-action-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .ai-soft-button {
          height: 32px;
          padding: 0 11px;
          border: 1px solid #E5E7EB;
          background: #fff;
          color: #374151;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 650;
          cursor: pointer;
        }

        .ai-primary-action {
          height: 32px;
          padding: 0 13px;
          border: 1px solid #F97316;
          background: #F97316;
          color: #fff;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
        }

        
        .ai-question-filter-button {
          height: 32px;
          padding: 0 12px;
          border: 1px solid #E5E7EB;
          background: #fff;
          color: #374151;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-question-add-button {
          height: 32px;
          padding: 0 13px;
          border: 1px solid #F97316;
          background: #F97316;
          color: #fff;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-question-row-selected {
          background: #FFF7ED !important;
        }

        .ai-response-shell {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          overflow: hidden;
        }

        .ai-response-header {
          padding: 14px 16px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ai-response-title {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .ai-response-selected-question {
          margin: 0 14px 12px;
          padding: 10px 12px;
          background: #FFF7ED;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .ai-response-engine-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 0 14px 14px;
        }

        .ai-response-engine-card {
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          padding: 12px;
          min-width: 0;
        }

        .ai-response-engine-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .ai-response-engine-name {
          font-size: 11px;
          font-weight: 800;
          color: #111827;
        }

        .ai-response-mentioned {
          display: inline-flex;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          background: #DCFCE7;
          color: #15803D;
        }

        .ai-response-rank {
          font-size: 10px;
          color: #475569;
          margin-bottom: 10px;
        }

        .ai-response-list-title {
          font-size: 10px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }

        .ai-response-mentions {
          margin: 0;
          padding-left: 18px;
          font-size: 10px;
          color: #374151;
          line-height: 1.75;
        }

        .ai-response-you {
          background: #DCFCE7;
          border-radius: 4px;
          padding: 1px 4px;
          font-weight: 700;
          color: #166534;
        }

        .ai-response-full-button {
          width: 100%;
          border: 0;
          margin-top: 10px;
          padding: 7px;
          border-radius: 5px;
          background: #FFF7ED;
          color: #EA580C;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }
@media (max-width: 1180px) {
          .ai-question-main-grid {
            grid-template-columns: 1fr;
          }

          .ai-question-lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ai-question-search {
            margin-left: auto;
            width: 220px;
          }
        }

        .ai-question-filter-button {
          height: 32px;
          padding: 0 12px;
          border: 1px solid #E5E7EB;
          background: #fff;
          color: #374151;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-question-add-button {
          height: 32px;
          padding: 0 13px;
          border: 1px solid #F97316;
          background: #F97316;
          color: #fff;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }

        .ai-question-row-selected {
          background: #FFF7ED !important;
        }

        .ai-response-shell {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          overflow: hidden;
        }

        .ai-response-header {
          padding: 14px 16px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ai-response-title {
          font-size: 14px;
          font-weight: 800;
          color: #111827;
        }

        .ai-response-selected-question {
          margin: 0 14px 12px;
          padding: 10px 12px;
          background: #FFF7ED;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          color: #111827;
        }

        .ai-response-engine-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 0 14px 14px;
        }

        .ai-response-engine-card {
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          padding: 12px;
          min-width: 0;
        }

        .ai-response-engine-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .ai-response-engine-name {
          font-size: 11px;
          font-weight: 800;
          color: #111827;
        }

        .ai-response-mentioned {
          display: inline-flex;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          background: #DCFCE7;
          color: #15803D;
        }

        .ai-response-rank {
          font-size: 10px;
          color: #475569;
          margin-bottom: 10px;
        }

        .ai-response-list-title {
          font-size: 10px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
        }

        .ai-response-mentions {
          margin: 0;
          padding-left: 18px;
          font-size: 10px;
          color: #374151;
          line-height: 1.75;
        }

        .ai-response-you {
          background: #DCFCE7;
          border-radius: 4px;
          padding: 1px 4px;
          font-weight: 700;
          color: #166534;
        }

        .ai-response-full-button {
          width: 100%;
          border: 0;
          margin-top: 10px;
          padding: 7px;
          border-radius: 5px;
          background: #FFF7ED;
          color: #EA580C;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }
@media (max-width: 1180px) {
          .ai-vis-layout { grid-template-columns: 1fr; }
          .ai-product-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 900px) {
          .ai-vis-engine-trend-row { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .ai-vis-page { padding: 14px 10px 24px; }
          .ai-vis-header { flex-direction: column; }
          .ai-product-grid { grid-template-columns: 1fr; }
          .ai-question-row { grid-template-columns: 24px minmax(0,1fr); }
          .ai-question-row .intent { display: none; }
        }

        /* Questions UX spacing */
        .ai-questions-toolbar {
          margin-top: 16px !important;
        }

        .ai-vis-page {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        .ai-question-actions-header {
          position: static !important;
          right: auto !important;
          top: auto !important;
          width: auto !important;
          padding: 0 10px !important;
          background: #F8FAFC !important;
          border-top-right-radius: 0;
        }

        .ai-question-menu-dropdown {
          position: fixed;
          z-index: 4000;
          width: 205px;
          padding: 6px;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          box-shadow:
            0 14px 32px rgba(15, 23, 42, 0.14),
            0 3px 8px rgba(15, 23, 42, 0.06);
        }

        .ai-question-menu-item {
          width: 100%;
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #334155;
          font-size: 10.5px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }

        .ai-question-menu-item:hover {
          background: #F8FAFC;
          color: #111827;
        }

        .ai-question-menu-separator {
          height: 1px;
          background: #EEF2F7;
          margin: 4px 2px;
        }

        .ai-question-menu-delete {
          color: #DC2626;
        }

        .ai-question-menu-delete:hover {
          background: #FEF2F2;
          color: #B91C1C;
        }

        .ai-question-actions-cell {
          width: 46px !important;
          min-width: 46px !important;
          text-align: center !important;
          overflow: visible !important;
          position: relative;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .ai-question-menu-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .ai-question-menu-button {
          width: 30px;
          height: 30px;
          padding: 0;
          margin: 0 auto;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
          transition:
            background .15s ease,
            border-color .15s ease,
            color .15s ease;
        }

        .ai-question-menu-button:hover {
          background: #F1F5F9;
          border-color: #E2E8F0;
        }

        .ai-question-menu-dots {
          width: 14px;
          height: 20px;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          pointer-events: none;
        }

        .ai-question-menu-dots span {
          display: block;
          width: 3px;
          height: 3px;
          min-width: 3px;
          min-height: 3px;
          border-radius: 50%;
          background: #64748B;
        }

        .ai-question-menu-button:hover .ai-question-menu-dots span {
          background: #111827;
        }

        .ai-question-menu-icon {
          width: 14px;
          min-width: 14px;
          font-size: 12px;
          color: #64748B;
        }

        .ai-question-menu-item:hover .ai-question-menu-icon {
          color: #F97316;
        }

        .ai-question-menu-delete .ai-question-menu-icon {
          color: #DC2626;
        }

        .ai-question-menu-delete:hover .ai-question-menu-icon {
          color: #B91C1C;
        }

        /* =====================================================
           Questions table - final alignment/polish
           ===================================================== */

        .ai-questions-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }

        /* Question */
        .ai-questions-table th:nth-child(1),
        .ai-questions-table td:nth-child(1) {
          width: 40%;
          text-align: left;
        }

        /* Intent */
        .ai-questions-table th:nth-child(2),
        .ai-questions-table td:nth-child(2) {
          width: 13%;
          text-align: center;
        }

        /* Status */
        .ai-questions-table th:nth-child(3),
        .ai-questions-table td:nth-child(3) {
          width: 12%;
          text-align: center;
        }

        /* ChatGPT */
        .ai-questions-table th:nth-child(4),
        .ai-questions-table td:nth-child(4) {
          width: 9%;
          text-align: center;
        }

        /* Claude */
        .ai-questions-table th:nth-child(5),
        .ai-questions-table td:nth-child(5) {
          width: 9%;
          text-align: center;
        }

        /* Last Tested */
        .ai-questions-table th:nth-child(6),
        .ai-questions-table td:nth-child(6) {
          width: 13%;
          text-align: center;
          white-space: nowrap;
        }

        /* Action */
        .ai-questions-table th:nth-child(7),
        .ai-questions-table td:nth-child(7) {
          width: 4%;
          min-width: 42px;
          text-align: center;
        }

        /* Header */
        .ai-questions-table thead th {
          height: 40px;
          padding: 0 10px;
          vertical-align: middle;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
        }

        /* Explicitly center every header except Question */
        .ai-questions-table thead th:not(:first-child) {
          text-align: center !important;
        }

        .ai-questions-table tbody td {
          padding: 11px 10px;
          vertical-align: middle;
          border-bottom: 1px solid #EEF2F7;
        }

        /* Question text */
        .ai-questions-table tbody td:first-child {
          padding-left: 12px;
          padding-right: 18px;
          line-height: 1.35;
        }

        /* Keep badges visually centered */
        .ai-questions-table tbody td:nth-child(2) > *,
        .ai-questions-table tbody td:nth-child(3) > * {
          margin-left: auto;
          margin-right: auto;
        }

        /* Dedicated action space */
        .ai-question-actions-cell {
          width: 44px !important;
          min-width: 44px !important;
          padding-left: 6px !important;
          padding-right: 8px !important;
          text-align: center !important;
          position: relative;
          overflow: visible !important;
        }

        .ai-question-menu-button {
          width: 28px;
          height: 28px;
          margin: 0 auto;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          color: #64748B;
          cursor: pointer;
        }

        .ai-question-menu-button:hover,
        .ai-question-menu-button[aria-expanded="true"] {
          background: #F1F5F9;
          border-color: #E2E8F0;
          color: #334155;
        }


        .ai-question-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }

        .ai-question-table .q-col-question {
          width: 42%;
        }

        .ai-question-table .q-col-intent {
          width: 13%;
        }

        .ai-question-table .q-col-status {
          width: 12%;
        }

        .ai-question-table .q-col-chatgpt {
          width: 9%;
        }

        .ai-question-table .q-col-claude {
          width: 9%;
        }

        .ai-question-table .q-col-tested {
          width: 11%;
        }

        .ai-question-table .q-col-actions {
          width: 4%;
        }

        .ai-question-table th,
        .ai-question-table td {
          box-sizing: border-box;
          vertical-align: middle;
        }

        .ai-question-table th:first-child,
        .ai-question-table td:first-child {
          text-align: left;
        }

        .ai-question-table th:not(:first-child),
        .ai-question-table td:not(:first-child) {
          text-align: center;
        }

        .ai-question-table thead th {
          height: 40px;
          padding: 0 10px;
          font-size: 10.5px;
          font-weight: 600;
          color: #475569;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
        }

        .ai-question-table tbody td {
          padding: 10px;
          border-bottom: 1px solid #EEF2F7;
        }

        .ai-question-table tbody td:first-child {
          padding-left: 12px;
          padding-right: 16px;
        }

        .ai-question-actions-cell {
          width: auto !important;
          min-width: 0 !important;
          padding-left: 4px !important;
          padding-right: 6px !important;
          text-align: center !important;
          position: relative;
          overflow: visible !important;
        }

        /* FINAL Questions table header alignment */
        .ai-question-table thead th {
          box-sizing: border-box !important;
          vertical-align: middle !important;
          padding: 0 10px !important;
        }

        /* Question stays left aligned */
        .ai-question-table thead th:nth-child(1),
        .ai-question-table tbody td:nth-child(1) {
          text-align: left !important;
        }

        /* All remaining columns centered exactly */
        .ai-question-table thead th:nth-child(2),
        .ai-question-table tbody td:nth-child(2),

        .ai-question-table thead th:nth-child(3),
        .ai-question-table tbody td:nth-child(3),

        .ai-question-table thead th:nth-child(4),
        .ai-question-table tbody td:nth-child(4),

        .ai-question-table thead th:nth-child(5),
        .ai-question-table tbody td:nth-child(5),

        .ai-question-table thead th:nth-child(6),
        .ai-question-table tbody td:nth-child(6),

        .ai-question-table thead th:nth-child(7),
        .ai-question-table tbody td:nth-child(7) {
          text-align: center !important;
        }

        /* Same horizontal padding for header/body */
        .ai-question-table tbody td {
          box-sizing: border-box !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        /* Question needs a little extra breathing room */
        .ai-question-table thead th:first-child,
        .ai-question-table tbody td:first-child {
          padding-left: 12px !important;
          padding-right: 16px !important;
        }

        /* Do not let action-cell custom padding shift alignment */
        .ai-question-table .ai-question-actions-cell {
          padding-left: 4px !important;
          padding-right: 4px !important;
          text-align: center !important;
        }


        /* =====================================================
           FINAL QUESTION TABLE LAYOUT
           Header and rows use the exact same CSS Grid
           ===================================================== */

        .ai-question-table {
          display: block !important;
          width: 100% !important;
          table-layout: auto !important;
          border-collapse: collapse;
        }

        .ai-question-table colgroup {
          display: none !important;
        }

        .ai-question-table thead,
        .ai-question-table tbody {
          display: block !important;
          width: 100% !important;
        }

        .ai-question-table thead tr,
        .ai-question-table tbody tr {
          display: grid !important;

          grid-template-columns:
            minmax(0, 3.5fr)
            minmax(90px, 1fr)
            minmax(85px, .9fr)
            minmax(65px, .7fr)
            minmax(65px, .7fr)
            minmax(105px, 1.05fr)
            38px;

          width: 100% !important;
          box-sizing: border-box !important;
          align-items: center;
        }

        /* HEADER */
        .ai-question-table thead tr {
          min-height: 42px;
          height: 42px;
          background: #F8FAFC;
          border-top: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
          align-items: center !important;
        }

        .ai-question-table thead th {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          vertical-align: middle !important;

          width: auto !important;
          min-width: 0 !important;
          height: 42px !important;
          min-height: 42px !important;

          margin: 0 !important;
          padding: 0 8px !important;

          border: 0 !important;
          box-sizing: border-box !important;

          font-size: 10.5px;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
          background: #F8FAFC;
          text-align: center;
          line-height: 1.2;
        }

        .ai-question-table thead th:first-child {
          justify-content: flex-start !important;
          text-align: left !important;
          padding-left: 14px !important;
        }

        .ai-question-table thead th:last-child,
        .ai-question-actions-header {
          border-top-right-radius: 0;
          justify-content: center !important;
        }


        /* BODY ROW */
        .ai-question-table tbody tr {
          min-height: 62px;
          border-bottom: 1px solid #EEF2F7;
        }

        .ai-question-table tbody td {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;

          width: auto !important;
          min-width: 0 !important;

          margin: 0 !important;
          padding: 10px 8px !important;

          border: 0 !important;
          box-sizing: border-box !important;
          text-align: center !important;
        }

        /* QUESTION */
        .ai-question-table tbody td:first-child {
          justify-content: flex-start !important;
          text-align: left !important;
          padding-left: 14px !important;
          padding-right: 18px !important;
        }

        .ai-question-text {
          width: 100%;
          line-height: 1.35;
          text-align: left !important;
          white-space: normal !important;
          overflow-wrap: break-word;
        }


        /* INTENT */
        .ai-question-table tbody td:nth-child(2) {
          justify-content: center !important;
        }


        /* STATUS */
        .ai-question-table tbody td:nth-child(3) {
          justify-content: center !important;
        }


        /* CHATGPT + CLAUDE */
        .ai-question-table tbody td:nth-child(4),
        .ai-question-table tbody td:nth-child(5) {
          justify-content: center !important;
        }


        /* LAST TESTED */
        .ai-question-table tbody td:nth-child(6) {
          justify-content: center !important;
          white-space: nowrap !important;
        }


        /* THREE DOT ACTION */
        .ai-question-table tbody td:nth-child(7) {
          justify-content: center !important;
          overflow: visible !important;
          padding: 0 4px !important;
        }

        .ai-question-actions-cell {
          width: auto !important;
          min-width: 0 !important;
          position: relative !important;
          overflow: visible !important;
        }


        /* Selected question */
        .ai-question-table tbody tr.ai-question-row-selected {
          background: #FFF7ED !important;
        }


        .ai-response-not-mentioned {
          display: inline-flex;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          background: #FEE2E2;
          color: #DC2626;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      /* =====================================================
           AI RESPONSE ENGINE ICON POLISH
           ===================================================== */

        .ai-response-engine-name {
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
        }

        .ai-engine-icon {
          width: 25px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          flex-shrink: 0;
          font-size: 12px;
        }

        .ai-engine-icon-chatgpt {
          background: #ECFDF5;
          color: #10A37F;
        }

        .ai-engine-icon-claude {
          background: #FFF7ED;
          color: #D85A30;
        }

        .ai-response-full-button {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
        }

        .ai-full-answer-icon {
          font-size: 9px;
          transition: transform .15s ease;
        }

        .ai-response-full-button:hover .ai-full-answer-icon {
          transform: translateX(2px);
        }

      
        /* =====================================================
           REFERENCE RESPONSE ENGINE POLISH
           ===================================================== */

        .ai-response-engine-name {
          display: inline-flex !important;
          align-items: center !important;
          gap: 7px !important;
        }

        .ai-engine-label {
          font-size: 11px;
          font-weight: 800;
          color: #111827;
        }

        .ai-response-engine-card {
          padding: 12px !important;
        }

        .ai-response-engine-top {
          min-height: 28px;
          align-items: center !important;
        }

        .ai-response-mentioned,
        .ai-response-not-mentioned {
          white-space: nowrap;
        }

        .ai-response-full-button {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
        }

        .ai-response-full-button svg {
          flex-shrink: 0;
        }

        /* =====================================================
           AI RESPONSE PANEL POLISH (final)
           ===================================================== */
        .ai-response-shell {
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .ai-response-selected-question {
          padding: 11px 12px !important;
          background: linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 100%) !important;
          border: 1px solid #FED7AA !important;
          border-radius: 8px !important;
          line-height: 1.4;
        }

        .ai-response-engine-card {
          border-radius: 10px !important;
          padding: 13px !important;
          background: #FAFAFA;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .ai-response-engine-card:hover {
          border-color: #FDBA74;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.08);
          background: #fff;
        }

        .ai-response-engine-top {
          margin-bottom: 10px !important;
        }

        .ai-response-rank {
          font-size: 11px !important;
          color: #64748B !important;
          margin-bottom: 12px !important;
          padding-bottom: 10px;
          border-bottom: 1px solid #F1F5F9;
        }

        .ai-response-rank strong {
          color: #0F172A;
          font-weight: 800;
        }

        .ai-response-list-title {
          font-size: 10px !important;
          font-weight: 800 !important;
          color: #64748B !important;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 7px !important;
        }

        .ai-response-mentions {
          font-size: 11px !important;
          color: #334155 !important;
          line-height: 1.7 !important;
        }

        .ai-response-mentioned,
        .ai-response-not-mentioned {
          padding: 3px 8px !important;
        }

        .ai-response-full-button {
          margin-top: 12px !important;
          padding: 8px !important;
          border-radius: 7px !important;
        }

        .ai-response-full-button:hover {
          background: #FFEDD5 !important;
        }

      `}
        </style>

      <div className="ai-vis-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <FontAwesomeIcon icon={faWandMagicSparkles} style={{ color: '#F97316' }} />
            AI Visibility
            {site && <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7280' }}>- {domain}</span>}
          </h1>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
            See how AI engines perceive and recommend your products & services.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          {summaryPeriod && (
            <div style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11.5, color: '#374151', display: 'flex', flexDirection: 'column', lineHeight: 1.3 }} title="Fixed 30-day window - date filtering isn't built yet">
              <span style={{ fontWeight: 700 }}>{summaryPeriod.periodLabel}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{summaryPeriod.comparisonLabel}</span>
            </div>
          )}
          <button
            onClick={() => setCreatingSession(v => !v)}
            style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#EA580C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {creatingSession ? 'Cancel' : '+ New Session'}
          </button>
          {creatingSession && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 12, zIndex: 100, width: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Name this session</div>
              <input
                autoFocus
                value={newSessionName}
                onChange={e => setNewSessionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createNewSession() }}
                placeholder="e.g. SEO tools for small businesses"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, color: '#111827', boxSizing: 'border-box', marginBottom: 8 }}
              />
              <button onClick={createNewSession} style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: 'none', background: '#F97316', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                Start Session
              </button>
            </div>
          )}
          <button onClick={downloadImage} style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} /> Export Report
          </button>
          <button onClick={shareReport} disabled={sharing} style={{ padding: '8px 13px', borderRadius: 7, border: 'none', background: '#F97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faShareNodes} style={{ marginRight: 6 }} /> {sharing ? 'Generating...' : 'Share'}
          </button>
        </div>
      </div>

      {currentSession && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#9A3412', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Active session:</span> {currentSession.name}
          <button onClick={() => setCurrentSession(null)} style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: '#9A3412', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            Clear
          </button>
        </div>
      )}

      <VisibilityKPICards
        siteId={siteId}
        onSummaryLoaded={setSummaryPeriod}
        totalQuestions={currentQuestionTotal}
        testedQuestions={currentQuestionsTested}
      />

      <div style={{ marginBottom: 14 }}>

          {/* Product / question filters */}
          <div className="ai-questions-toolbar">
            {visibleTabs.map(tab => (
              <button
                key={tab}
                className={'ai-question-chip ' + (selectedProduct === tab ? 'active' : '')}
                onClick={() => setSelectedProduct(tab)}
              >
                {tab === 'All Questions'
                  ? `All (${flatQuestions.length})`
                  : `${tab} (${combinedQuestionSets.find(s => s.product === tab)?.questions?.length || 0})`
                }
              </button>
            ))}

            {overflowTabs.length > 0 && (
              <div ref={moreTabsRef} style={{ position: 'relative' }}>
                <button
                  className={'ai-question-chip ' + (overflowTabs.includes(selectedProduct) ? 'active' : '')}
                  onClick={() => setShowMoreTabs(v => !v)}
                >
                  More ({overflowTabs.length})
                  <FontAwesomeIcon icon={faChevronDown} style={{ marginLeft: 5, fontSize: 9 }} />
                </button>

                {showMoreTabs && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 5px)',
                      right: 0,
                      minWidth: 200,
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: 8,
                      boxShadow: '--'
                              }}
                  >
                    {overflowTabs.map(tab => (
                      <button
                        key={tab}
                        onClick={() => {
                          setSelectedProduct(tab)
                          setShowMoreTabs(false)
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
                          cursor: '--'
                              }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <input
              className="ai-question-search"
              value={questionSearch}
              onChange={e => setQuestionSearch(e.target.value)}
              placeholder="Search questions..."
            />

            <button className="ai-question-filter-button">
              Filters
            </button>

            <button
              className="ai-question-add-button"
              onClick={() => setAddingQuestion(true)}
              disabled={addingQuestion}
              style={addingQuestion ? { opacity: 0.55, cursor: 'default' } : undefined}
            >
              + Add Question
            </button>
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
            <section className="ai-question-panel">
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
                  onClick={() => setSelectedQuestion(q)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#F97316',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: '--'
                              }}
                >
                  View all answers</button>
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

                        const chatgptRank =
                          status?.engines?.chatgpt ??
                          status?.chatgptRank ??
                          status?.chatgpt_rank ??
                          null

                        const claudeRank =
                          status?.engines?.claude ??
                          status?.claudeRank ??
                          status?.claude_rank ??
                          null

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
                                ? <span className="ai-rank-good">#{chatgptRank}</span>
                                : <span style={{ color: '#94A3B8' }}>--</span>
                              }
                            </td>

                            <td>
                              {claudeRank
                                ? <span className="ai-rank-good">#{claudeRank}</span>
                                : <span style={{ color: '#94A3B8' }}>--</span>
                              }
                            </td>

                            <td style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
                              {isTested && status?.lastTested
                                ? new Date(status.lastTested).toLocaleDateString(
                                    'en-GB',
                                    { day: 'numeric', month: 'short', year: 'numeric' }
                                  )
                                : '--'
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

                <div className="ai-question-pagination">

                  {safeQuestionPage > 1 && (
                    <button
                      type="button"
                      className="ai-page-button"
                      onClick={() =>
                        setQuestionPage(page =>
                          Math.max(page - 1, 1)
                        )
                      }
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
                        (
                          safeQuestionPage === page
                            ? ' active'
                            : ''
                        )
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
                          Math.min(
                            page + 1,
                            questionPageCount
                          )
                        )
                      }
                      aria-label="Next page"
                    >
                      &gt;
                    </button>
                  )}

                </div>
              </div>
            </section>


            {/* RIGHT - actual AI answer / ranking evidence */}
            <div className="ai-response-column">
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

                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '28px 18px',
                        textAlign: 'center'
                      }}
                    >
                      <div
                        style={{
                          color: '#64748B',
                          fontSize: 11,
                          marginBottom: 12
                        }}
                      >
                        This question has not been tested yet.
                      </div>

                      <button
                        type="button"
                        className="ai-primary-action"
                        onClick={testSelectedQuestion}
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
                            className="ai-response-engine-card"
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
                          className="ai-response-engine-card"
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

                            <strong>
                              {mentioned
                                ? '#' + result.brandRank
                                : 'Not in Top 10'
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
                                        <span className="ai-response-you">
                                          {name} - You
                                        </span>
                                      ) : (
                                        name
                                      )}
                                    </li>
                                  )
                                })}

                            </ol>
                          ) : (
                            <div
                              style={{
                                color: '#94A3B8',
                                fontSize: 10,
                                padding: '8px 0 12px'
                              }}
                            >
                              No ranked brands returned.
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


          {/* Lower intelligence cards - like target UX */}
          <div className="ai-question-lower-grid">
            <VisibilityEngineTable siteId={siteId} />

            <VisibilityReasoningCard
              siteId={siteId}
              siteName={visibilitySiteName}
            />

            <VisibilityCompetitorsPanel />
          </div>

        </div>

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
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
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
              setOpenQuestionMenu(null)
              setQuestionMenuPos(null)
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

    </div>
  )
}

