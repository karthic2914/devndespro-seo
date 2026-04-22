import { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Sites from './pages/Sites'
import Dashboard from './pages/Dashboard'
import Keywords from './pages/Keywords'
import Backlinks from './pages/Backlinks'
import Competitors from './pages/Competitors'
import Actions from './pages/Actions'
import AiAssistant from './pages/AiAssistant'
import SiteAudit from './pages/SiteAudit'
import Alerts from './pages/Alerts'
import Integrations from './pages/Integrations'
import EmailReports from './pages/EmailReports'
import ColdEmails from './pages/ColdEmails'
import RankNo1 from './pages/RankNo1'
import Layout from './components/Layout'
import Users from './pages/Users'
import AcceptInvite from './pages/AcceptInvite'
import AdminSettings from './components/admin/AdminSettings'

// ── Global Snackbar context ──────────────────────────────────────────────────
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
  const c = colorMap[snackbar.type] || colorMap.info

  return (
    <div
      onClick={onClose}
      role="alert"
      style={{
        position: 'fixed', bottom: 36, left: '50%', transform: 'translateX(-50%)',
        zIndex: 999999, minWidth: 220, maxWidth: 420,
        padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 500,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', background: c.background, color: c.color,
      }}
    >
      {snackbar.type === 'success' && <span>✔️</span>}
      {snackbar.type === 'error'   && <span>❌</span>}
      {snackbar.type === 'warning' && <span>⚠️</span>}
      {snackbar.type === 'info'    && <span>ℹ️</span>}
      <span>{snackbar.message}</span>
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

export default function App() {
  const [snackbar, setSnackbar] = useState({ open: false, message: '', type: 'info', duration: 3500 })

  function showSnackbar(message, type = 'info', duration = 3500) {
    setSnackbar({ open: true, message, type, duration })
  }

  function closeSnackbar() {
    setSnackbar(s => ({ ...s, open: false }))
  }

  return (
    <SnackbarContext.Provider value={showSnackbar}>
      <GlobalSnackbar snackbar={snackbar} onClose={closeSnackbar} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/" element={<ProtectedRoute><Sites /></ProtectedRoute>} />
          <Route path="/site/:siteId" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="keywords" element={<Keywords />} />
            <Route path="backlinks" element={<Backlinks />} />
            <Route path="competitors" element={<Competitors />} />
            <Route path="actions" element={<Actions />} />
            <Route path="ai" element={<AiAssistant />} />
            <Route path="audit" element={<SiteAudit />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="email-reports" element={<EmailReports />} />
            <Route path="cold-emails" element={<ColdEmails />} />
            <Route path="rank" element={<RankNo1 />} />
            <Route path="users" element={<Users />} />
            <Route path="admin-settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SnackbarContext.Provider>
  )
}