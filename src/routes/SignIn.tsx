import { useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { LogoMark } from '@/ui/Logo'
import { useAuth } from '@/auth/AuthProvider'

/**
 * The door, which is mostly a signpost.
 *
 * Auth0 hosts the actual login, so there is no form here and no password to
 * handle. Which methods appear — Google, email and password, a one-time code —
 * is a setting in the Auth0 tenant rather than markup in this file, which
 * means adding a provider later does not touch the app at all.
 */
export function SignIn() {
  const { user, loading, enabled, error, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = pageTitle('Sign in')
  }, [])

  if (loading) return <div className="auth-page" />
  if (user) return <Navigate to="/projects" replace />

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
            <b>Accounts are not open yet.</b>
            <br />
            The editor works without one, everything you build saves in this browser. Sign-in is
            coming, and when it does your work comes with you.
            <br />
            <button className="auth-submit" style={{ marginTop: 14 }} onClick={() => navigate('/app')}>
              Open the editor
            </button>
          </div>
        ) : (
          <>
            <button className="auth-submit" onClick={signIn}>
              Continue
            </button>
            <p className="auth-fine" style={{ marginTop: 12 }}>
              New here?{' '}
              <button style={{ color: 'var(--brand)', textDecoration: 'underline' }} onClick={signUp}>
                Create an account
              </button>
            </p>

            {error && <p className="auth-msg err">{error}</p>}

            <p className="auth-fine">
              <button
                style={{ color: 'var(--tx-2)', textDecoration: 'underline', marginTop: 8 }}
                onClick={() => navigate('/app')}
              >
                Skip, just open the editor
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
