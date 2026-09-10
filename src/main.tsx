import React, { Suspense, lazy, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/app.css'
import '@/styles/site.css'
import { AuthProvider } from '@/auth/AuthProvider'
import { Landing } from '@/routes/Landing'
import { SignIn } from '@/routes/SignIn'
import { AuthCallback } from '@/routes/AuthCallback'
import { Projects } from '@/routes/Projects'
import { LogoMark } from '@/ui/Logo'

/**
 * The editor is the only route that needs three.js, the solver and the part
 * geometry. Splitting it out keeps the landing page a fraction of the size.
 * Nobody should download a 3D engine to read what the product does.
 */
const Editor = lazy(() => import('@/app/App').then((m) => ({ default: m.Editor })))

/**
 * Exposed for the screenshot and regression harness in tools/, which drives the
 * app through this rather than through fragile UI clicks.
 */
/** Holding screen while the editor chunk arrives. */
function EditorLoading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: 'var(--bg-0)', gap: 14 }}>
      <LogoMark size={40} />
      <span style={{ color: 'var(--tx-3)', fontSize: 'var(--fs-lg)' }}>Loading the editor…</span>
    </div>
  )
}

function EditorRoute() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <Editor />
    </Suspense>
  )
}

/**
 * The public pages are light and the editor is dark, so the document itself has
 * to say which it is. Without this the body keeps whichever background it was
 * given at build time and shows through when a short page is overscrolled.
 */
function ThemeByRoute() {
  const { pathname } = useLocation()
  useEffect(() => {
    const dark = pathname.startsWith('/app')
    document.documentElement.dataset.surface = dark ? 'dark' : 'light'
  }, [pathname])
  return null
}

const el = document.getElementById('root')
if (!el) throw new Error('#root is missing from index.html')

createRoot(el).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeByRoute />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<EditorRoute />} />
          <Route path="/app/:projectId" element={<EditorRoute />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
