import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Wordmark } from '@/ui/Logo'
import { BRAND, pageTitle } from '@/brand'
import { useEffect } from 'react'

/**
 * Where somebody lands straight after signing up with an email address.
 *
 * Auth0 creates the account, the post-login Action refuses the login because
 * the address is unconfirmed, and Auth0 hands that refusal back to the
 * callback as an OAuth error. Left alone that renders as "access_denied" on
 * a page that then bounces to a sign-in form — which reads as the sign-up
 * having failed, seconds after it succeeded. It did not fail. There is one
 * thing left to do and it is in their inbox.
 *
 * So this is not an error page and is not styled as one. No red, no warning
 * triangle, no apology. It is the last step of signing up.
 */
export function ConfirmEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email')?.trim() || null

  /*
   * Only reachable off the back of a signup in this tab.
   *
   * Read before the redirect below so a reload still works: the marker is
   * set by the callback and lives as long as the tab does. Opened cold —
   * a restored tab, a bookmark, a second visit — there is nothing to
   * confirm and the front page is where they meant to go.
   */
  const inFlight = (() => {
    try {
      return sessionStorage.getItem('draftrig.signup.v1') !== null
    } catch {
      return true
    }
  })()

  useEffect(() => {
    document.title = pageTitle('Confirm your email')
  }, [])

  if (!inFlight) return <Navigate to="/" replace />

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand">
          <Wordmark size={26} onDark />
        </Link>
        <div className="auth-pitch">
          <h2>One account, every machine.</h2>
          <p>
            Confirming the address is the last step. After that, every board you build is
            kept — on this machine and on any other you sign in from.
          </p>
        </div>
        <p className="auth-aside-fine">
          Passwords are handled by Auth0. {BRAND.name} never sees one.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card confirm">
          <span className="confirm-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <rect x="5" y="11" width="38" height="26" rx="4" stroke="currentColor" strokeWidth="2.4" />
              <path d="M6.5 13.5 24 26 41.5 13.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          <h1>Check your email</h1>

          <p className="lede">
            {email ? (
              <>
                Your account is made. We sent a message to <b>{email}</b> — open it to finish,
                and you will be able to sign in.
              </>
            ) : (
              <>
                Your account is made. We sent you a message — open it to finish, and you will
                be able to sign in.
              </>
            )}
          </p>

          <button className="auth-btn primary" onClick={() => navigate('/app')}>
            Keep building meanwhile
          </button>

          <p className="confirm-note">
            The bench does not need an account. Everything you make before confirming stays in
            this browser and comes across with you when you sign in.
          </p>

          <div className="auth-rule" />

          <p className="auth-switch">
            Already confirmed?{' '}
            <Link className="auth-link" to="/signin">
              Sign in
            </Link>
          </p>
        </div>

        <p className="auth-foot">
          <Link to="/">← Back to {BRAND.name}</Link>
        </p>
      </main>
    </div>
  )
}
