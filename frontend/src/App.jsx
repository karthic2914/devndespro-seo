import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleXmark, faTriangleExclamation, faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from './hooks/useAuth'
import { canUseBacklinks, canUseKeywords, canUseAiAssistant, canUseColdEmails } from './utils/features'
import Login from './pages/Login'
import Landing from './pages/Landing'
import MarketingPage from './pages/marketing/MarketingPage'
import PricingPage from './pages/marketing/PricingPage'
import Sites from './pages/Sites'
import Dashboard from './pages/Dashboard'
import Keywords from './pages/Keywords'
import Backlinks from './pages/Backlinks'
import Competitors from './pages/Competitors'
import Actions from './pages/Actions'
import AIVisibility from './pages/AIVisibility'
import PublicAIVisibility from './pages/PublicAIVisibility'
import SiteAudit from './pages/SiteAudit'
import Alerts from './pages/Alerts'
import Integrations from './pages/Integrations'
import EmailReports from './pages/EmailReports'
import ColdEmails from './pages/ColdEmails'
import RankNo1 from './pages/RankNo1'
import Layout from './components/Layout'
import Users from './pages/Users'
import AcceptInvite from './pages/AcceptInvite'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Tools from './pages/Tools'

// -- Global Snackbar context --------------------------------------------------
export const SnackbarContext = createContext(null)

export function useSnackbar() {
  return useContext(SnackbarContext)
}

function GlobalSnackbar({ snackbar, onClose }) {
  useEffect(() => {
    if (!snackbar.open) return
    const t = setTimeout(onClose, snackbar.duration || 3500)
    return () => clearTimeout(t)
  }, [snackbar.open, snackbar.duration, onClose])

  if (!snackbar.open) return null

  const colorMap = {
    success: { background: '#059669', color: '#fff' },
    error:   { background: '#DC2626', color: '#fff' },
    warning: { background: '#D97706', color: '#fff' },
    info:    { background: '#1D4ED8', color: '#fff' },
  }
  let c = colorMap[snackbar.type] || colorMap.info

if (snackbar.engine === 'chatgpt') {
  c = {
    background: '#111827',
    color: '#ffffff'
  }
}

if (snackbar.engine === 'claude') {
  c = {
    background: '#D97706',
    color: '#ffffff'
  }
}

  const engineColorMap = {
    chatgpt: '#000000',
    claude: '#D97706',
    perplexity: '#14B8A6',
    gemini: '#4285F4',
  }

  const engineColor = snackbar.engine ? engineColorMap[snackbar.engine] : null

  const iconMap = {
    success: faCircleCheck,
    error: faCircleXmark,
    warning: faTriangleExclamation,
    info: faCircleInfo,
  }

  const icon = iconMap[snackbar.type] || faCircleInfo

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        zIndex: 999999, minWidth: 260, maxWidth: 460,
        padding: '12px 12px 12px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
        boxShadow: '0 8px 28px rgba(0,0,0,0.28)',
        borderLeft: engineColor ? `5px solid ${engineColor}` : 'none',
        display: 'flex', alignItems: 'center', gap: 12,
        background: c.background, color: c.color,
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 16, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{snackbar.message}</span>
      <button
        type="button"
        aria-label="Close notification"
        title="Close"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: 7,
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <FontAwesomeIcon icon={faXmark} style={{ fontSize: 13 }} />
      </button>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666', fontFamily: 'Syne,sans-serif' }}>
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666', fontFamily: 'Syne,sans-serif' }}>
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (Number(user.id) !== 1) return <Navigate to=".." replace />
  return children
}

function FeatureRoute({ feature, children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666', fontFamily: 'Syne,sans-serif' }}>
      Loading...
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  const allowed = feature === 'backlinks'
    ? canUseBacklinks(user)
    : feature === 'keywords'
    ? canUseKeywords(user)
    : feature === 'ai_assistant'
    ? canUseAiAssistant(user)
    : feature === 'cold_emails'
    ? canUseColdEmails(user)
    : false
  if (!allowed) return <Navigate to=".." replace />
  return children
}

function WebOnlyRoute({ children }) {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/" replace />
  }

  return children
}

function HomeRoute() {
  const { user, loading } = useAuth()
  const isNativeApp = Capacitor.isNativePlatform()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666', fontFamily: 'Syne,sans-serif' }}>
      Loading...
    </div>
  )

  // Installed Android/iOS app bypasses marketing.
  if (isNativeApp && !user) {
    return <Navigate to="/login" replace />
  }

  // Public website continues to show the landing page.
  if (!user) {
    return <Landing />
  }

  return <Sites />
}
export default function App() {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', type: 'info', duration: 3500, engine: null })
  const [showSplash, setShowSplash] = useState(Capacitor.isNativePlatform())
  const { loading: authLoading } = useAuth()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    SplashScreen.hide()

    // Keep the branded splash up until we actually know whether the
    // person is logged in, instead of a blind timer that can hide it
    // before the auth check finishes (which exposed a white flash).
    if (!authLoading) {
      const timer = setTimeout(() => {
        setShowSplash(false)
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [authLoading])

  function showSnackbar(message, type = 'info', duration = 3500, options = {}) {
    setSnackbar({ open: true, message, type, duration, ...options })
  }

  function closeSnackbar() {
    setSnackbar(s => ({ ...s, open: false }))
  }


  if (showSplash) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <img
          src="/splash.png"
          alt="DevnDespro SEO"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    )
  }

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      <GlobalSnackbar snackbar={snackbar} onClose={closeSnackbar} />
      <BrowserRouter>
        <Routes>
          <Route path="/public/ai-visibility/:token" element={<PublicAIVisibility />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/" element={<HomeRoute />} />
          <Route path="/features" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/platform" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/how-it-works" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/ai-visibility" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/seo-audit" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/keyword-tracking" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/backlink-monitoring" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/pricing" element={<WebOnlyRoute><PricingPage /></WebOnlyRoute>} />
          <Route path="/about" element={<WebOnlyRoute><MarketingPage /></WebOnlyRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />
          <Route path="/site/:siteId" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="keywords" element={<Keywords />} />
            <Route path="backlinks" element={<FeatureRoute feature="backlinks"><Backlinks /></FeatureRoute>} />
            <Route path="competitors" element={<Competitors />} />
            <Route path="actions" element={<Actions />} />
            <Route path="ai" element={<Navigate to=".." replace />} />
            <Route path="ai-visibility" element={<AIVisibility />} />
            <Route path="audit" element={<SiteAudit />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="email-reports" element={<EmailReports />} />
            <Route path="cold-emails" element={<FeatureRoute feature="cold_emails"><ColdEmails /></FeatureRoute>} />
            <Route path="rank" element={<RankNo1 />} />
            <Route path="users" element={<Users />} />
            <Route path="admin-settings" element={<Navigate to="/settings" replace />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SnackbarContext.Provider>
  )
}



