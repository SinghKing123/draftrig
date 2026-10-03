import { useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { LogoMark, Wordmark } from '@/ui/Logo'
import { CONNECTIONS, useAuth } from '@/auth/AuthProvider'

/**
 * The door.
 *
 * Auth0 holds the passwords, so there is no form here and never will be: a
 * password typed into our own markup is a password we are then responsible
 * for, and the whole point of using an identity provider is not to be.
 *
 * What this page does own is the choice. Naming the connection on the way out
 * means picking Google goes straight to Google's account chooser and comes
 * straight back — Auth0's own screen never appears. Only the email route
 * passes through it, because that is the one that needs a password field.
 */
export function SignIn() {
  const { user, loading, enabled, error, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = pageTitle('Sign in')
  }, [])

  // A blank page rather than a flash of the form: this resolves in a few
  // hundred milliseconds, and a sign-in screen that appears and then vanishes
  // because you were signed in all along reads as a fault.
  if (loading) return <div className="auth-page" />
  if (user) return <Navigate to="/projects" replace />

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand">
          <Wordmark size={26} onDark />
        </Link>
        <div className="auth-pitch">
          <h2>One account, every machine.</h2>
          <p>
            An account keeps every board you build, on every machine you sign in from. Anything
            already saved in this browser comes with you the first time.
          </p>
        </div>
        <p className="auth-aside-fine">
          Passwords are handled by Auth0. {BRAND.name} never sees one.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-card-mark" aria-label={BRAND.name}>
            <LogoMark size={34} />
          </Link>

          <h1>Sign in to {BRAND.name}</h1>

          {!enabled ? (
            <div className="auth-notice">
              <b>Accounts are not open yet.</b> The editor works without one, and everything you
              build saves in this browser.
              <button className="auth-btn primary" onClick={() => navigate('/app')}>
                Open the editor
              </button>
            </div>
          ) : (
            <>
              <button className="auth-btn provider" onClick={() => signIn(CONNECTIONS.google)}>
                <GoogleMark />
                Continue with Google
              </button>

              <button className="auth-btn provider" onClick={() => signIn(CONNECTIONS.password)}>
                <MailMark />
                Continue with email
              </button>

              {error && <p className="auth-error">{error}</p>}

              <p className="auth-switch">
                New here?{' '}
                <button className="auth-link" onClick={() => signUp()}>
                  Create an account
                </button>
              </p>

              <div className="auth-rule" />

              <button className="auth-skip" onClick={() => navigate('/app')}>
                Skip — just open the editor
              </button>
            </>
          )}
        </div>

        <p className="auth-foot">
          <Link to="/">← Back to {BRAND.name}</Link>
        </p>
      </main>
    </div>
  )
}

/* Google's mark, drawn rather than fetched: one more network request on the
   one page where a slow load looks like a broken sign-in. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

function MailMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" fill="none">
      <rect x="1.4" y="3.6" width="15.2" height="10.8" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m2.4 5.2 6.6 4.6 6.6-4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
