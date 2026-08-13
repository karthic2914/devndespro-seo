import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faCircleXmark, faArrowRight, faRotateRight, faHistory, faShareNodes, faDownload, faChevronDown, faXmark, faPalette, faCode, faLink, faServer, faMagnifyingGlass, faLayerGroup, faGauge, faListCheck, faComments, faUsers, faLightbulb, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'
import {
  VisibilityResultsCard,
  VisibilityReasoningCard,
  VisibilityRecommendationsCard,
  VisibilityHistoryCard,
  VisibilityKPICards,
  VisibilityEngineTable,
  VisibilityCompetitorsPanel,
  VisibilityAlertsPanel,
  VisibilitySentimentPanel,
  VisibilityQuickActions,
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

// The 6 tabs shown below the header, above the KPI cards.
const TABS = [
  { key: 'summary', label: 'Summary', icon: faGauge },
  { key: 'questions', label: 'Questions', icon: faListCheck },
  { key: 'responses', label: 'AI Responses', icon: faComments },
  { key: 'competitors', label: 'Competitors', icon: faUsers },
  { key: 'recommendations', label: 'Recommendations', icon: faLightbulb },
  { key: 'history', label: 'History', icon: faClockRotateLeft },
]

// Matches the engine colors already used elsewhere on this page (KPI cards,
// engine breakdown table) - used for the Recent Sessions table headers.
const ENGINE_STYLE_MAP = {
  chatgpt: { label: 'ChatGPT', color: '#10A37F' },
  claude: { label: 'Claude', color: '#D85A30' },
  gemini: { label: 'Gemini', color: '#4285F4' },
  perplexity: { label: 'Perplexity', color: '#20808D' },
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
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState('All Questions')
  const [addingQuestion, setAddingQuestion] = useState(false)
  // Which of the 6 tabs is currently showing
  const [activeTab, setActiveTab] = useState('questions')
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
  const [selectedQuestion, setSelectedQuestion] = useState('')
  const [openQuestionMenu, setOpenQuestionMenu] = useState(null)

  // AUTO-GENERATE PRODUCT QUESTIONS
  useEffect(() => {
    if (
      products.length > 0 &&
      questionSets.length === 0 &&
      !generatingQuestions
    ) {
      generateProductQuestions()
    }
  }, [products.length])

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

  async function generateProductQuestions() {
    setGeneratingQuestions(true)
    try {
      const res = await api.post('/sites/' + siteId + '/products/questions', { engine: 'claude' })
      setQuestionSets(res.data.questionSets || [])
      showSnackbar((res.data.totalQuestions || 0) + ' questions generated across ' + (res.data.questionSets || []).length + ' products', 'success')
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
      setCustomQuestions(prev => [...prev, res.data])
      setSelectedProduct('Custom Questions')
      setCustomQuestionText('')
      setAddingQuestion(false)
      showSnackbar('Question saved - select it in AI Visibility Results below to test it against AI.', 'success')
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
  // database-backed customQuestions state. Kept as a computed merge (not
  // mutated into questionSets directly) so regenerating AI questions never
  // wipes out saved custom ones.
  const combinedQuestionSets = customQuestions.length
    ? [...questionSets, { product: 'Custom Questions', questions: customQuestions.map(q => q.question) }]
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

  const visibleQuestions = visibleQuestionSets
    .flatMap(set => set.questions || [])
    .filter(q => !questionSearch.trim() || String(q).toLowerCase().includes(questionSearch.trim().toLowerCase()))
    .slice(0, 5)

  const testedQuestionsCount = flatQuestions.filter(q =>
    questionStatuses.some(s => s.question === q)
  ).length

  const readyQuestionsCount = Math.max(flatQuestions.length - testedQuestionsCount, 0)

  
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
        }
        .ai-vis-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .ai-vis-tabbar {
          display: flex;
          gap: 4px;
          overflow-x: visible;
          border-bottom: 1px solid #E5E7EB;
          margin-bottom: 14px;
          padding-bottom: 1px;
        }
        .ai-vis-tab {
          display: flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          padding: 9px 14px;
          font-size: 12.5px;
          font-weight: 600;
          color: #6B7280;
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          font-family: inherit;
        }
        .ai-vis-tab.active {
          color: #F97316;
          border-bottom-color: #F97316;
          background: #FFF7ED;
          border-radius: 6px 6px 0 0;
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
          flex-wrap: nowrap;
          width: 100%;
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
          grid-template-columns: minmax(0, 1.12fr) minmax(360px, .88fr);
          gap: 14px;
          align-items: start;
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
          overflow: visible;
          padding: 0 10px 8px;
          box-sizing: border-box;
        }

        .ai-question-table {
          width: 100%;
          border-collapse: collapse;
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

        /*
         * Keep normal page scrolling but hide the visual scrollbar.
         * The user can still scroll with mouse wheel / trackpad.
         */
        .ai-vis-page {
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
        }

        html,
        body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }

        .ai-question-actions-header,

        .ai-question-menu-dropdown {
          position: absolute;
          right: 0;
          top: 32px;
          z-index: 999;
          width: 185px;
          padding: 6px;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 9px;
          box-shadow:
            0 12px 28px rgba(15, 23, 42, 0.14),
            0 2px 6px rgba(15, 23, 42, 0.06);
        }

        .ai-question-menu-item {
          width: 100%;
          min-height: 34px;
          display: flex;
          align-items: center;
          padding: 7px 9px;
          border: 0;
          border-radius: 6px;
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
          width: 38px !important;
          text-align: center !important;
          overflow: visible !important;
          position: relative;
        }

        .ai-question-menu-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .ai-question-menu-button {
          width: 28px;
          height: 28px;
          padding: 0;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #64748B;
        }

        .ai-question-menu-button::before {
          content: "\22EE";
          display: block;
          font-size: 20px;
          line-height: 1;
          font-weight: 700;
          color: #64748B;
        }

        .ai-question-menu-button:hover {
          background: #F1F5F9;
          border-color: #E2E8F0;
        }

        .ai-question-menu-button:hover::before {
          color: #111827;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

      {/* Tab bar sits above the KPI cards. Each tab shows only its own
          focused content below instead of one long scrolling page. */}
      <div className="ai-vis-tabbar">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={'ai-vis-tab ' + (activeTab === tab.key ? 'active' : '')}
          >
            <FontAwesomeIcon icon={tab.icon} style={{ fontSize: 12 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI cards stay visible on every tab - the shared "at a glance" row */}
      <VisibilityKPICards siteId={siteId} onSummaryLoaded={setSummaryPeriod} totalQuestions={flatQuestions.length} />

      {activeTab === 'summary' && (
      <div className="ai-vis-layout" style={{ marginBottom: 14 }}>
        <div className="ai-vis-left">
          <div className="ai-vis-engine-trend-row">
            <VisibilityEngineTable siteId={siteId} />
            <VisibilityHistoryCard siteId={siteId} />
          </div>
        </div>
        <div className="ai-vis-right">
          <VisibilityCompetitorsPanel />
          <VisibilityAlertsPanel />
          <VisibilitySentimentPanel />
          <VisibilityQuickActions
            onRunScan={() => setActiveTab('responses')}
            onAddQuestion={() => { setAddingQuestion(true); setActiveTab('questions') }}
            onGenerateQuestions={() => { generateProductQuestions(); setActiveTab('questions') }}
            onCompareAnswers={() => setActiveTab('responses')}
            onExport={downloadImage}
          />
        </div>
      </div>
      )}

      {activeTab === 'questions' && (
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
              onClick={() => setAddingQuestion(v => !v)}
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
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Intent</th>
                      <th>Status</th>
                      <th>ChatGPT</th>
                      <th>Claude</th>
                      <th>Last Tested</th>
                      <th className="ai-question-actions-header"></th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleQuestions.length > 0 ? (
                      visibleQuestions.map((q, i) => {
                        const status = questionStatuses.find(s => s.question === q)
                        const isTested = !!status

                        const chatgptRank =
                          status?.engines?.chatgpt?.brandRank ??
                          status?.engines?.chatgpt?.rank ??
                          status?.chatgptRank ??
                          status?.chatgpt_rank ??
                          null

                        const claudeRank =
                          status?.engines?.claude?.brandRank ??
                          status?.engines?.claude?.rank ??
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
                              <span className="ai-intent-pill">
                                Commercial
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
      onClick={(e) => {
        e.stopPropagation()
        setOpenQuestionMenu(
          openQuestionMenu === q ? null : q
        )
      }}
      title="Question actions"
    ></button>

    {openQuestionMenu === q && (
      <div
        className="ai-question-menu-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ai-question-menu-item"
          onClick={() => {
            setSelectedQuestion(q)
            setOpenQuestionMenu(null)
            setActiveTab('responses')
          }}
        >
          View AI Responses
        </button>

        <button
          type="button"
          className="ai-question-menu-item"
          onClick={() => {
            setSelectedQuestion(q)
            setOpenQuestionMenu(null)
          }}
        >
          {isTested ? 'Re-test Question' : 'Test Question'}
        </button>

        <button
          type="button"
          className="ai-question-menu-item"
          onClick={() => {
            setOpenQuestionMenu(null)
          }}
        >
          Edit Question
        </button>

        <div className="ai-question-menu-separator"></div>

        <button
          type="button"
          className="ai-question-menu-item ai-question-menu-delete"
          onClick={() => {
            setOpenQuestionMenu(null)
          }}
        >
          Delete Question
        </button>
      </div>
    )}
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
                  Showing {visibleQuestions.length} of {flatQuestions.length} questions
                </span>

                <div className="ai-question-pagination">
                  <span className="ai-page-button active">1</span>
                  <span className="ai-page-button">2</span>
                  <span className="ai-page-button">3</span>
                  <span className="ai-page-button">4</span>
                  <span className="ai-page-button">&gt;</span>
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

                  <button
                    onClick={() => setActiveTab('responses')}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: '#F97316',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: '--'
                              }}
                  >
                    View full answers</button>
                </div>

                <div className="ai-response-selected-question">
                  {selectedQuestion || 'Select a question to view AI responses'}
                </div>

                <div className="ai-response-engine-grid">

                  <div className="ai-response-engine-card">
                    <div className="ai-response-engine-top">
                      <div className="ai-response-engine-name">
                        ChatGPT
                      </div>

                      <span className="ai-response-mentioned">
                        Mentioned: Yes
                      </span>
                    </div>

                    <div className="ai-response-rank">
                      Rank: <strong>#4</strong>
                    </div>

                    <div className="ai-response-list-title">
                      Top Mentions
                    </div>

                    <ol className="ai-response-mentions">
                      <li>Ahrefs</li>
                      <li>Semrush</li>
                      <li>Moz</li>
                      <li><span className="ai-response-you">{visibilitySiteName || 'Your Brand'} - You</span></li>
                      <li>Ubersuggest</li>
                    </ol>

                    <button
                      className="ai-response-full-button"
                      onClick={() => setActiveTab('responses')}
                    >
                      View Full Answer
                    </button>
                  </div>


                  <div className="ai-response-engine-card">
                    <div className="ai-response-engine-top">
                      <div className="ai-response-engine-name">
                        Claude
                      </div>

                      <span className="ai-response-mentioned">
                        Mentioned: Yes
                      </span>
                    </div>

                    <div className="ai-response-rank">
                      Rank: <strong>#8</strong>
                    </div>

                    <div className="ai-response-list-title">
                      Top Mentions
                    </div>

                    <ol className="ai-response-mentions">
                      <li>Ahrefs</li>
                      <li>Semrush</li>
                      <li>Moz</li>
                      <li>Surfer SEO</li>
                      <li><span className="ai-response-you">{visibilitySiteName || 'Your Brand'} - You</span></li>
                    </ol>

                    <button
                      className="ai-response-full-button"
                      onClick={() => setActiveTab('responses')}
                    >
                      View Full Answer
                    </button>
                  </div>

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
      )}

      {activeTab === 'responses' && (
        <div style={{ marginBottom: 14 }}>
          {flatQuestions.length > 0 ? (
            <VisibilityResultsCard siteId={siteId} siteName={visibilitySiteName} questions={flatQuestions} productName={selectedProduct} sessionId={currentSession?.id || null} />
          ) : (
            <div style={sectionCard}>
              <div style={sectionTitle}>AI Responses</div>
              <div style={{ padding: '28px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                Generate AI questions first (Questions tab), then come back here to scan and see full responses.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'competitors' && (
        <div style={{ marginBottom: 14 }}>
          <VisibilityCompetitorsPanel />
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <VisibilityReasoningCard siteId={siteId} siteName={visibilitySiteName} />
          <VisibilityRecommendationsCard siteId={siteId} siteName={visibilitySiteName} />
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <VisibilityHistoryCard siteId={siteId} />

          <div style={sectionCard}>
            <div style={sectionTitle}>Recent Sessions</div>
            {!sessions.length ? (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
                No sessions yet. Click + New Session above to start tracking scans over time.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 640 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '0 10px 8px 0', fontWeight: 700, color: '#374151' }}>Session</th>
                      <th style={{ padding: '0 10px 8px', fontWeight: 700, color: '#374151' }}>Date</th>
                      <th style={{ padding: '0 10px 8px', fontWeight: 700, color: '#374151' }}>Questions</th>
                      {Object.keys(sessions[0]?.engineStatus || {}).map(engine => (
                        <th key={engine} style={{ padding: '0 10px 8px', fontWeight: 700, color: ENGINE_STYLE_MAP[engine]?.color || '#374151' }}>
                          {ENGINE_STYLE_MAP[engine]?.label || engine}
                        </th>
                      ))}
                      <th style={{ padding: '0 10px 8px', fontWeight: 700, color: '#374151' }}>Score</th>
                      <th style={{ padding: '0 10px 8px', fontWeight: 700, color: '#374151' }}>Avg. Position</th>
                      <th style={{ padding: '0 10px 8px', fontWeight: 700, color: '#374151' }}>Top 10 Engines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.slice(0, 5).map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '9px 10px 9px 0', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{s.name}</td>
                        <td style={{ padding: '9px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '9px 10px', color: '#111827' }}>{s.questionsTested}</td>
                        {Object.entries(s.engineStatus || {}).map(([engine, status]) => (
                          <td key={engine} style={{ padding: '9px 10px' }}>
                            <FontAwesomeIcon
                              icon={status.tested ? faCircleCheck : faCircleXmark}
                              style={{ color: status.tested ? (status.inTop10 ? '#16A34A' : '#DC2626') : '#D1D5DB', fontSize: 12 }}
                            />
                          </td>
                        ))}
                        <td style={{ padding: '9px 10px', fontWeight: 800, color: s.score >= 60 ? '#16A34A' : s.score >= 30 ? '#D97706' : '#DC2626' }}>
                          {s.score}%
                        </td>
                        <td style={{ padding: '9px 10px', color: '#111827' }}>{s.averageRank ?? '-'}</td>
                        <td style={{ padding: '9px 10px', color: '#111827' }}>{s.topEnginesCount} / {s.totalEngines}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

