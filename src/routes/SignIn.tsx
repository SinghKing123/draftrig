import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { LogoMark } from '@/ui/Logo'
import { useAuth } from '@/auth/AuthProvider'

/** Google's mark. Reproduced exactly, per their branding requirements. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

export function SignIn() {
  const { user, loading, enabled, error, signInWithGoogle, signInWithEmail, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    document.title = pageTitle('Sign in')
  }, [])

  if (loading) return <div className="auth-page" />
  if (user) return <Navigate to="/projects" replace />

  const onEmail = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    clearError()
    const res = await signInWithEmail(email.trim())
    setBusy(false)
    if (res.sent) setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <LogoMark size={40} />
        <h1>Sign in to {BRAND.name}</h1>
        <p className="lede">
          Your projects follow you between devices, and nothing you have already built is lost —
          anything saved in this browser moves into your account.
        </p>

        {!enabled ? (
          <div className="notice">
            <b>Accounts are not switched on for this deployment.</b>
            <br />
            The editor works fully without one — projects save to this browser. To enable sign-in,
            add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart.
          </div>
        ) : sent ? (
          <div className="notice" style={{ background: 'rgba(61,214,140,0.09)', borderColor: 'rgba(61,214,140,0.3)', color: 'var(--ok)' }}>
            <b>Check your email.</b>
            <br />
            We sent a sign-in link to {email}. It works once, and expires in an hour.
          </div>
        ) : (
          <>
            <button className="btn-google" onClick={signInWithGoogle}>
              <GoogleG /> Continue with Google
            </button>

            <div className="auth-or">or</div>

            <form onSubmit={onEmail}>
              <input
                className="auth-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <button className="auth-submit" type="submit" disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>

            {error && <p className="auth-msg err">{error}</p>}

            <p className="auth-fine">
              No password to forget — we email you a one-time link instead.
              <br />
              <button
                style={{ color: 'var(--tx-2)', textDecoration: 'underline', marginTop: 8 }}
                onClick={() => navigate('/app')}
              >
                Skip — just open the editor
              </button>
            </p>
          </>
        )}

        <p className="auth-fine">
          <Link to="/">← Back to {BRAND.name}</Link>
        </p>
      </div>
    </div>
  )
}
