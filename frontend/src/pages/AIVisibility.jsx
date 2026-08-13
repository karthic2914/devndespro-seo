import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faCircleXmark, faArrowRight, faRotateRight, faHistory, faShareNodes, faDownload, faChevronDown, faXmark, faPalette, faCode, faLink, faServer, faMagnifyingGlass, faLayerGroup, faGauge, faListCheck, faComments, faUsers, faCircleExclamation, faLightbulb, faClockRotateLeft } from '@fortawesome/free-solid-svg-icons'
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

// The 7 tabs shown below the header - replaces the old numbered stepper.
// Each tab shows only its own focused content instead of everything
// stacked on one long scrolling page.
const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: faGauge },
  { key: 'questions', label: 'Questions', icon: faListCheck },
  { key: 'responses', label: 'Responses', icon: faComments },
  { key: 'competitors', label: 'Competitors', icon: faUsers },
  { key: 'reasons', label: 'Reasons', icon: faCircleExclamation },
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
  // Which of the 7 tabs is currently showing
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const visibleQuestions = visibleQuestionSets.flatMap(set => set.questions || []).slice(0, 5)

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
          overflow-x: auto;
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

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

      {/* KPI cards stay visible on every tab - the shared "at a glance" row */}
      <VisibilityKPICards siteId={siteId} onSummaryLoaded={setSummaryPeriod} />

      {/* Tab bar - replaces the old numbered stepper. Each tab shows only
          its own focused content below instead of one long scrolling page. */}
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

      {activeTab === 'dashboard' && (
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
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div id="step-products" style={sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={sectionTitle}>
                  <span style={numberBadge}>1</span>
                  Detected products & services
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#F97316' }}>How it works?</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, marginLeft: 30 }}>
                  {productsDetectedAt
                    ? 'Last detected ' + new Date(productsDetectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Detect your website products and services to begin.'}
                </div>
              </div>

              <button onClick={detectProducts} disabled={detectingProducts} style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #F97316', background: '#fff', color: '#F97316', fontWeight: 700, fontSize: 11, cursor: detectingProducts ? 'not-allowed' : 'pointer' }}>
                <FontAwesomeIcon icon={faRotateRight} style={{ marginRight: 6, animation: detectingProducts ? 'spin 1s linear infinite' : 'none' }} />
                {detectingProducts ? 'Detecting...' : products.length ? 'Re-detect Products' : 'Detect Products'}
              </button>
            </div>

            {products.length > 0 ? (
              <>
                <div className="ai-product-grid">
                  {products.slice(0, 4).map((p, i) => {
                    const iconMeta = getProductIcon(p.name, i)
                    return (
                      <div className="ai-product-card" key={i} onClick={() => setSelectedProduct(p.name)}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: iconMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
                          <FontAwesomeIcon icon={iconMeta.icon} style={{ color: iconMeta.color, fontSize: 13 }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginBottom: 7 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{p.name}</div>
                          {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#15803D', background: '#DCFCE7', borderRadius: 4, padding: '2px 5px' }}>Primary</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.45 }}>
                          {p.description || p.targetCustomer || 'Detected from website content'}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button style={{ border: '1px solid #E5E7EB', background: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 10.5, cursor: 'pointer' }}>Edit Products</button>
                  {products.length > 4 && <span style={{ fontSize: 10.5, color: '#6B7280', alignSelf: 'center' }}>+{products.length - 4} more detected</span>}
                </div>
              </>
            ) : (
              <div style={{ marginTop: 14, padding: 16, border: '1px dashed #FDBA74', background: '#FFF7ED', borderRadius: 8, color: '#9A3412', fontSize: 12 }}>
                No products detected yet. Click <strong>Detect Products</strong>.
              </div>
            )}
          </div>

          {/* 2. Questions AI users ask */}
          <div id="step-questions" style={sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={sectionTitle}>
                <span style={numberBadge}>2</span>
                Questions AI users ask
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>(Auto-generated)</span>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                {overflowTabs.length > 0 && (
                  <div ref={moreTabsRef} style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowMoreTabs(v => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        border: '1px solid ' + (overflowTabs.includes(selectedProduct) ? '#FDBA74' : '#E5E7EB'),
                        background: overflowTabs.includes(selectedProduct) ? '#FFF7ED' : '#fff',
                        color: overflowTabs.includes(selectedProduct) ? '#F97316' : '#374151',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      More ({overflowTabs.length})
                      <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, transition: 'transform 0.15s', transform: showMoreTabs ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>

                    {showMoreTabs && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 190, overflow: 'hidden' }}>
                        {overflowTabs.map(tab => (
                          <div
                            key={tab}
                            onClick={() => { setSelectedProduct(tab); setShowMoreTabs(false) }}
                            style={{
                              padding: '9px 14px',
                              fontSize: 12,
                              cursor: 'pointer',
                              color: selectedProduct === tab ? '#F97316' : '#374151',
                              fontWeight: selectedProduct === tab ? 700 : 500,
                              background: selectedProduct === tab ? '#FFF7ED' : '#fff',
                            }}
                            onMouseEnter={e => { if (selectedProduct !== tab) e.currentTarget.style.background = '#F9FAFB' }}
                            onMouseLeave={e => { if (selectedProduct !== tab) e.currentTarget.style.background = '#fff' }}
                          >
                            {tab}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setAddingQuestion(v => !v)} style={{ border: 0, background: 'transparent', color: '#6366F1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {addingQuestion ? 'Cancel' : '+ Add Custom Question'}
                </button>
                <button onClick={generateProductQuestions} disabled={generatingQuestions || products.length === 0} style={{ border: 0, background: 'transparent', color: '#F97316', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {generatingQuestions ? 'Generating...' : '+ Generate Questions'}
                </button>
              </div>
            </div>

            {addingQuestion && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  autoFocus
                  value={customQuestionText}
                  onChange={e => setCustomQuestionText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addCustomQuestion()
                    if (e.key === 'Escape') { setAddingQuestion(false); setCustomQuestionText('') }
                  }}
                  placeholder="e.g. What's the best UI/UX design agency for a startup?"
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, color: '#111827' }}
                />
                <button onClick={addCustomQuestion} disabled={!customQuestionText.trim() || savingQuestion} style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: (customQuestionText.trim() && !savingQuestion) ? '#F97316' : '#D1D5DB', color: '#fff', fontWeight: 700, fontSize: 11, cursor: (customQuestionText.trim() && !savingQuestion) ? 'pointer' : 'not-allowed' }}>
                  {savingQuestion ? 'Saving...' : 'Add'}
                </button>
              </div>
            )}

            <div className="ai-question-tabs">
              {visibleTabs.map(tab => (
                <button key={tab} className={'ai-question-tab ' + (selectedProduct === tab ? 'active' : '')} onClick={() => setSelectedProduct(tab)}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 5 }}>
              {isCustomTab && customQuestions.length > 0 ? (
                customQuestions.slice(0, 5).map((q, i) => (
                  <div className="ai-question-row" style={{ gridTemplateColumns: '28px minmax(0,1fr) 28px' }} key={q.id}>
                    <span style={{ color: '#9CA3AF' }}>{i + 1}</span>
                    <span style={{ color: '#111827', fontWeight: 500 }}>{q.question}</span>
                    <button
                      onClick={() => deleteCustomQuestion(q.id)}
                      title="Delete question"
                      style={{ justifySelf: 'end', border: 0, background: 'transparent', color: '#9CA3AF', cursor: 'pointer', padding: 4 }}
                    >
                      <FontAwesomeIcon icon={faXmark} style={{ fontSize: 11 }} />
                    </button>
                  </div>
                ))
              ) : visibleQuestions.length > 0 ? visibleQuestions.map((q, i) => {
                const status = questionStatuses.find(s => s.question === q)
                const isTested = !!status
                return (
                  <div className="ai-question-row" key={i}>
                    <span style={{ color: '#9CA3AF' }}>{i + 1}</span>
                    <span style={{ color: '#111827', fontWeight: 500 }}>{q}</span>
                    <span className="intent" style={{ fontSize: 9.5, color: '#C2410C', background: '#FFEDD5', borderRadius: 4, padding: '2px 6px', justifySelf: 'start' }}>
                      Commercial
                    </span>
                    <span style={{ fontSize: 10.5, color: isTested ? '#16A34A' : '#2563EB', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <FontAwesomeIcon icon={isTested ? faCircleCheck : faRotateRight} style={{ fontSize: 10 }} />
                      {isTested ? 'Tested' : 'Ready'}
                    </span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {isTested ? new Date(status.lastTested).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </span>
                  </div>
                )
              }) : (
                <div style={{ padding: '18px 4px 8px', fontSize: 12, color: '#9CA3AF' }}>
                  {products.length ? 'Generate questions to see real customer-intent prompts, or add your own above.' : 'Detect products first, or add your own question above.'}
                </div>
              )}
            </div>
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

      {activeTab === 'reasons' && (
        <div style={{ marginBottom: 14 }}>
          <VisibilityReasoningCard siteId={siteId} siteName={visibilitySiteName} />
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div style={{ marginBottom: 14 }}>
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

