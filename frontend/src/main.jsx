import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth.jsx'
import App from './App.jsx'
import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const hasGoogleClientId = typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.trim().length > 0

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {hasGoogleClientId ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 2800,
              style: {
                background: '#111827',
                color: '#fff',
                border: '1px solid #1f2937',
                borderRadius: '10px',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
              error: { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </GoogleOAuthProvider>
    ) : (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 24,
      }}>
        <div style={{
          maxWidth: 560,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          color: '#0f172a',
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Configuration Error</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#475569' }}>
            Missing required frontend env variable <strong>VITE_GOOGLE_CLIENT_ID</strong>.
            Add it in Vercel project environment variables and redeploy.
          </p>
        </div>
      </div>
    )}
  </React.StrictMode>
)
