import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles, faCircleCheck, faCircleXmark, faLightbulb, faArrowRight, faRotateRight, faHistory, faShareNodes, faDownload, faChevronDown, faXmark, faPalette, faCode, faLink, faServer, faMagnifyingGlass, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'
import { useSnackbar } from '../App'
import {
  VisibilityResultsCard,
  VisibilitySummaryCard,
  VisibilityReasoningCard,
  VisibilityRecommendationsCard,
  VisibilityHistoryCard,
} from '../components/AIVisibilitySections3to7'

function genQueries(domain, brand, keywords) {
  const kw1 = keywords[0] || (brand + ' services')
  const kw2 = keywords[1] || (brand + ' tool')
  if (keywords.length > 0) {
    return [kw1, brand + ' ' + (keywords[1] || 'review'), 'best ' + kw1]
  }
  return [brand, brand + ' review', 'best ' + brand + ' alternatives']
}

const SCORE_LABEL = s => s >= 80 ? 'Excellent' : s >= 50 ? 'Average' : s > 0 ? 'Below average' : 'Poor'
const SCORE_COLOR = s => s >= 80 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'
const SCORE_BG = s => s >= 80 ? '#DCFCE7' : s >= 50 ? '#FEF3C7' : '#FEE2E2'

const ENGINES = [
  { key: 'Claude', label: 'Claude (Anthropic)', desc: 'Fast, accurate, reads your site content', color: '#D85A30' },
  { key: 'ChatGPT', label: 'ChatGPT (OpenAI)', desc: 'GPT-4o mini, ~.02 per analysis', color: '#10A37F' },
  { key: 'Both', label: 'Both engines', desc: 'Compare recommendations side by side', color: '#6366F1' },
]

function calculateScoreFromResults(results) {
  const arr = Array.isArray(results) ? results : []
  if (arr.length === 0) return null
  const cited = arr.filter(r => r.cited).length
  return Math.round((cited / arr.length) * 100)
}

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

function getLatestEngineScore(history, engineName) {
  const engine = engineName.toLowerCase()
  const rows = Array.isArray(history) ? history : []

  for (const row of rows) {
    const rowEngine = String(row.engine || row.provider || row.ai_engine || '').toLowerCase()

    if (rowEngine === engine && row.score != null) return Number(row.score)

    if (rowEngine === engine && Array.isArray(row.results)) {
      const score = calculateScoreFromResults(row.results)
      if (score != null) return score
    }

    if (!rowEngine && Array.isArray(row.results)) {
      const hasEngine = row.results.some(r => String(r.engine || '').toLowerCase() === engine)
      if (hasEngine) {
        const score = calculateScoreFromResults(row.results)
        if (score != null) return score
      }
    }
  }

  return null
}

export default function AIVisibility() {
  const { siteId } = useParams()
  const showSnackbar = useSnackbar()
  const reportRef = useRef(null)
  const menuRef = useRef(null)
  const [site, setSite] = useState(null)
  const [queries, setQueries] = useState(['', '', ''])
  const [results, setResults] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [claudeLoading, setClaudeLoading] = useState(false)
  const [claudeResults, setClaudeResults] = useState(null)
  const [engineScores, setEngineScores] = useState({ chatgpt: null, claude: null })
  const [improvements, setImprovements] = useState([])
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [aiRecommendations, setAiRecommendations] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [domain, setDomain] = useState('')
  const [showEngineMenu, setShowEngineMenu] = useState(false)
  const [selectedEngine, setSelectedEngine] = useState('Claude')
  const [aiCronEnabled, setAiCronEnabled] = useState(false)
  const [products, setProducts] = useState([])
  const [productsDetectedAt, setProductsDetectedAt] = useState(null)
  const [productsStale, setProductsStale] = useState(true)
  const [detectingProducts, setDetectingProducts] = useState(false)
  const [questionSets, setQuestionSets] = useState([])
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [scoreHistory, setScoreHistory] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('All Questions')
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [customQuestionText, setCustomQuestionText] = useState('')
  const [showMoreTabs, setShowMoreTabs] = useState(false)
  const moreTabsRef = useRef(null)
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
  const toggleCron = async (val) => {
    setAiCronEnabled(val)
    await api.patch('/sites/' + siteId + '/ai-cron', { enabled: val }).catch(() => {})
  }

  useEffect(() => {
    const handleClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowEngineMenu(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const handleClick = e => { if (moreTabsRef.current && !moreTabsRef.current.contains(e.target)) setShowMoreTabs(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    api.get('/sites').then(res => {
      const s = (res.data || []).find(x => String(x.id) === String(siteId))
      if (s) {
        setSite(s)
        const d = (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })()
        setDomain(d)
        const brand = d.split('.')[0]
        // Claude score is loaded from score-history, not old site field
        setAiCronEnabled(!!s.enable_ai_cron)
        api.post('/sites/' + siteId + '/ai-visibility/suggest-queries', {})
          .then(r => {
            if (r.data.queries && r.data.queries.length > 0) {
              setQueries(r.data.queries)
            } else {
              api.get('/sites/' + siteId + '/keywords').then(kr => {
                const kws = (kr.data || []).slice(0, 3).map(k => k.keyword || k.query || '').filter(Boolean)
                setQueries(genQueries(d, brand, kws))
              }).catch(() => setQueries(genQueries(d, brand, [])))
            }
          })
          .catch(() => {
            api.get('/sites/' + siteId + '/keywords').then(kr => {
              const kws = (kr.data || []).slice(0, 3).map(k => k.keyword || k.query || '').filter(Boolean)
              setQueries(genQueries(d, brand, kws))
            }).catch(() => setQueries(genQueries(d, brand, [])))
          })
      }
    }).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/improvements').then(res => setImprovements(res.data.tips || [])).catch(() => {})
    api.get('/sites/' + siteId + '/products').then(res => {
      setProducts(res.data.products || [])
      setProductsDetectedAt(res.data.detectedAt || null)
      setProductsStale(res.data.isStale !== false)
    }).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/score-history').then(res => {
      const h = res.data.history || []
      setScoreHistory(h)

      const latestChatGPT = getLatestEngineScore(h, 'chatgpt')
      const latestClaude = getLatestEngineScore(h, 'claude')

      setEngineScores(prev => ({
        ...prev,
        chatgpt: latestChatGPT,
        claude: latestClaude
      }))
    }).catch(() => {})
    api.get('/sites/' + siteId + '/ai-visibility/history').then(res => {
      const h = res.data || []
      setHistory(h)
      if (h.length > 0) setResults(h[0].results || [])
    }).catch(() => {})
    // Load previously saved custom questions from the database
    api.get('/sites/' + siteId + '/custom-questions').then(res => {
      setCustomQuestions(res.data.questions || [])
    }).catch(() => {})
  }, [siteId])

  async function runTest() {
    if (isTesting) return
    const q = queries.filter(q => q.trim())
    if (!q.length) {
      showSnackbar('Please enter at least one query', 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/test', { queries: q })
      const chatgptItems = res.data.results || []
      setResults(chatgptItems)
      setEngineScores(prev => ({ ...prev, chatgpt: calcEngineScore(chatgptItems) }))
      setHistory(h => [{ results: res.data.results, created_at: new Date().toISOString() }, ...h].slice(0, 10))
      showSnackbar('ChatGPT Analysis Complete', 'success', 3500, { engine: 'chatgpt' })
    } catch (e) {
      showSnackbar('ChatGPT test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setLoading(false)
  }

  async function runClaudeTest() {
    if (isTesting) return
    const q = queries.filter(q => q.trim())
    if (!q.length) {
      showSnackbar('Please enter at least one query', 'warning')
      return
    }

    setClaudeLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/test', { queries: q, engine: 'claude' })
      const claudeItems = (res.data.results || []).map(r => ({ ...r, engine: 'Claude' }))
      setResults(claudeItems)
      setEngineScores(prev => ({ ...prev, claude: calcEngineScore(claudeItems) }))
      setClaudeResults({ score: res.data.score ?? 0 })
      setHistory(h => [{ results: res.data.results, created_at: new Date().toISOString() }, ...h].slice(0, 10))
      showSnackbar('Claude Analysis Complete', 'success', 3500, { engine: 'claude' })
    } catch (e) {
      showSnackbar('Claude test failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error')
    }
    setClaudeLoading(false)
  }
  async function analyseWithEngine(engine) {
    setSelectedEngine(engine)
    setShowEngineMenu(false)
    setAnalyseLoading(true)
    try {
      const res = await api.post('/sites/' + siteId + '/ai-visibility/analyse', { engine })
      setAiRecommendations({ ...res.data, engine })
      showSnackbar(engine + ' analysis complete!', 'success')
    } catch (e) { showSnackbar('Analysis failed: ' + (e?.response?.data?.error || 'Unknown error'), 'error') }
    setAnalyseLoading(false)
  }

  async function detectProducts() {
    setDetectingProducts(true)
    try {
      const res = await api.post('/sites/' + siteId + '/products/detect', { engine: selectedEngine.toLowerCase() })
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
      const res = await api.post('/sites/' + siteId + '/products/questions', { engine: selectedEngine.toLowerCase() })
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

  const cited = (results || []).filter(r => r.cited).length
  const total = (results || []).length
  const score = total > 0 ? Math.round((cited / total) * 100) : null

  const tipsToShow = improvements.length > 0 ? improvements : [
    { title: 'Submit sitemap to Bing Webmaster Tools', message: 'ChatGPT uses Bing. Not indexed on Bing = invisible to ChatGPT. Takes 10 mins at webmaster.bing.com.', priority: 'High' },
    { title: 'Get listed on Trustpilot or G2', message: 'AI engines use review platforms as trust signals. A free Trustpilot listing is enough to start.', priority: 'High' },
    { title: 'Add author schema to content pages', message: 'Named authors with credentials make content more citable by AI engines.', priority: 'Medium' },
    { title: 'Build Reddit presence', message: 'Perplexity heavily cites Reddit. Comment in relevant subreddits before posting.', priority: 'Medium' },
  ]

  const selectedEngineObj = ENGINES.find(e => e.key === selectedEngine) || ENGINES[0]

  const calcEngineScore = (items) => {
    const arr = Array.isArray(items) ? items : []
    if (arr.length === 0) return 0
    const citedCount = arr.filter(x => x.cited).length
    return Math.round((citedCount / arr.length) * 100)
  }
  const isTesting = loading || claudeLoading || analyseLoading

  const engines = [
    { key: 'chatgpt', label: 'ChatGPT', bg: '#000', color: '#fff', initial: 'G', score: engineScores.chatgpt ?? score, active: true },
    { key: 'claude', label: 'Claude', bg: '#D85A30', color: '#fff', initial: 'C', score: engineScores.claude ?? claudeResults?.score ?? null, pending: engineScores.claude === null && claudeResults === null },
    { key: 'perplexity', label: 'Perplexity', bg: '#20808D', color: '#fff', initial: 'P', soon: true },
    { key: 'gemini', label: 'Gemini', bg: '#4285F4', color: '#fff', initial: 'G', soon: true },
  ]

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
        .ai-vis-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.75fr) minmax(330px, 1fr);
          gap: 14px;
          align-items: start;
        }
        .ai-vis-left, .ai-vis-right {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
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
          grid-template-columns: 28px minmax(0,1fr) 140px;
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #FED7AA', background: '#FFF7ED', color: '#EA580C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            + New Session
          </button>
          <button onClick={downloadImage} style={{ padding: '8px 13px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            <FontAwesomeIcon icon={faDownload} style={{ marginRight: 6 }} /> Export Report
          </button>
          <button onClick={shareReport} disabled={sharing} style={{ padding: '8px 13px', borderRadius: 7, border: 'none', background: '#F97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <FontAwesomeIcon icon={faShareNodes} style={{ marginRight: 6 }} /> {sharing ? 'Generating...' : 'Share'}
          </button>
        </div>
      </div>

      <div className="ai-vis-layout">
        <div className="ai-vis-left">

          {/* 1. Detected products & services */}
          <div style={sectionCard}>
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
          <div style={sectionCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={sectionTitle}>
                <span style={numberBadge}>2</span>
                Questions AI users ask
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500 }}>(Auto-generated)</span>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
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

              {overflowTabs.length > 0 && (
                <div ref={moreTabsRef} style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button
                    className={'ai-question-tab ' + (overflowTabs.includes(selectedProduct) ? 'active' : '')}
                    onClick={() => setShowMoreTabs(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    More ({overflowTabs.length})
                    <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, transition: 'transform 0.15s', transform: showMoreTabs ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>

                  {showMoreTabs && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 190, overflow: 'hidden' }}>
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
              ) : visibleQuestions.length > 0 ? visibleQuestions.map((q, i) => (
                <div className="ai-question-row" key={i}>
                  <span style={{ color: '#9CA3AF' }}>{i + 1}</span>
                  <span style={{ color: '#111827', fontWeight: 500 }}>{q}</span>
                  <span className="intent" style={{ justifySelf: 'end', fontSize: 9.5, color: '#C2410C', background: '#FFEDD5', borderRadius: 4, padding: '2px 6px' }}>
                    Commercial
                  </span>
                </div>
              )) : (
                <div style={{ padding: '18px 4px 8px', fontSize: 12, color: '#9CA3AF' }}>
                  {products.length ? 'Generate questions to see real customer-intent prompts, or add your own above.' : 'Detect products first, or add your own question above.'}
                </div>
              )}
            </div>
          </div>

          {/* 3. AI Visibility Results */}
          {flatQuestions.length > 0 ? (
            <VisibilityResultsCard siteId={siteId} siteName={visibilitySiteName} questions={flatQuestions} productName={selectedProduct} />
          ) : (
            <div style={sectionCard}>
              <div style={sectionTitle}><span style={numberBadge}>3</span>AI Visibility Results</div>
              <div style={{ padding: '28px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
                Generate AI questions first to run Top 10 visibility analysis.
              </div>
            </div>
          )}
        </div>

        <div className="ai-vis-right">
          {/* 4. AI Visibility Summary */}
          <VisibilitySummaryCard siteId={siteId} siteName={visibilitySiteName}
/>

          {/* 5. Why not Top 10 */}
          <VisibilityReasoningCard siteId={siteId} siteName={visibilitySiteName} />

          {/* 6. Actionable Recommendations */}
          <VisibilityRecommendationsCard siteId={siteId} siteName={visibilitySiteName} />

          {/* 7. AI Visibility History */}
          <VisibilityHistoryCard siteId={siteId} />
        </div>
      </div>
    </div>
  )
}

