import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './hooks/useAuth.jsx'
import App from './App.jsx'
import './styles/app/01-base-reset.css'
import './styles/app/02-layout-sidebar.css'
import './styles/app/03-components.css'
import './styles/app/04-tooltips-crawler.css'
import './styles/app/05-backlinks.css'
import './styles/app/06-responsive-breakpoints.css'
import './styles/app/07-saas-ux-overview.css'
import './styles/app/08-projects-cards.css'
import './responsive.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const hasGoogleClientId = typeof GOOGLE_CLIENT_ID === 'string' && GOOGLE_CLIENT_ID.trim().length > 0

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {hasGoogleClientId ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <App />
          <Toaster
  position="bottom-center"
  toastOptions={{
    duration: 12000,
    style: {
      background: '#111827',
      color: '#fff',
      border: '1px solid #1f2937',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: 600,
      padding: '12px 18px',
    },
    success: {
      iconTheme: {
        primary: '#16A34A',
        secondary: '#fff',
      },
      style: {
        borderLeft: '4px solid #16A34A',
      },
    },
    error: {
      iconTheme: {
        primary: '#DC2626',
        secondary: '#fff',
      },
      style: {
        borderLeft: '4px solid #DC2626',
      },
    },
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

// Remove crawler-only shell after React mounts so headless audits don't see duplicate H1s.
queueMicrotask(() => {
  const shell = document.getElementById('seo-shell')
  if (shell) shell.remove()
})

// DEVNDESPRO_FIRST_WEB_FRAME
const finishNativeStartup = async () => {
  try {
    const startupImage = document.querySelector(
      '#devndespro-startup-splash img'
    )

    if (startupImage && !startupImage.complete) {
      await new Promise((resolve) => {
        const finish = () => resolve()

        startupImage.addEventListener('load', finish, {
          once: true,
        })

        startupImage.addEventListener('error', finish, {
          once: true,
        })

        window.setTimeout(finish, 1500)
      })
    }

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })

    const capacitorModule = await import(
      '@capacitor/core'
    )

    if (
      capacitorModule.Capacitor.isNativePlatform()
    ) {
      const splashModule = await import(
        '@capacitor/splash-screen'
      )

      await splashModule.SplashScreen.hide({
        fadeOutDuration: 160,
      })
    }
  }
  catch (error) {
    console.warn(
      'Native startup transition:',
      error
    )
  }
}

finishNativeStartup()
