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
import RankNo1 from './pages/RankNo1'
import Layout from './components/Layout'
import Users from './pages/Users'
import AcceptInvite from './pages/AcceptInvite'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#666',fontFamily:'Syne,sans-serif' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
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
          <Route path="rank" element={<RankNo1 />} />
          <Route path="users" element={<Users />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
