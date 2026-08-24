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


// DEVNDESPRO_SINGLE_SPLASH_CONTROLLER
const finishNativeStartup = async () => {
  const startupSplash = document.getElementById(
    'devndespro-startup-splash'
  )

  const startupImage = startupSplash?.querySelector(
    'img'
  )

  const waitForImage = async () => {
    if (!startupImage || startupImage.complete) return

    await new Promise((resolve) => {
      let completed = false

      const finish = () => {
        if (completed) return
        completed = true
        resolve()
      }

      startupImage.addEventListener('load', finish, {
        once: true,
      })

      startupImage.addEventListener('error', finish, {
        once: true,
      })

      window.setTimeout(finish, 2000)
    })
  }

  const waitForAppReady = async () => {
    if (
      document.documentElement.dataset
        .devndesproAppReady === 'true'
    ) {
      return
    }

    await new Promise((resolve) => {
      let completed = false

      const finish = () => {
        if (completed) return
        completed = true

        window.removeEventListener(
          'devndespro:app-ready',
          finish
        )

        resolve()
      }

      window.addEventListener(
        'devndespro:app-ready',
        finish,
        { once: true }
      )

      // Safety fallback if authentication is unavailable.
      window.setTimeout(finish, 6000)
    })
  }

  try {
    await Promise.all([
      waitForImage(),
      waitForAppReady(),
    ])

    // Allow Login or Sites to complete two paint cycles.
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve)
      })
    })

    const {
      Capacitor,
    } = await import('@capacitor/core')

    if (Capacitor.isNativePlatform()) {
      const {
        SplashScreen,
      } = await import('@capacitor/splash-screen')

      await SplashScreen.hide({
        fadeOutDuration: 160,
      })
    }

    // The static branded splash remains underneath the
    // native layer, preventing a white transition.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 180)
    })

    if (startupSplash) {
      startupSplash.style.opacity = '0'
      startupSplash.style.pointerEvents = 'none'

      window.setTimeout(() => {
        startupSplash.remove()
      }, 180)
    }
  }
  catch (error) {
    console.warn(
      'Startup splash transition:',
      error
    )

    startupSplash?.remove()
  }
}

finishNativeStartup()
