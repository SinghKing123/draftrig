import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND } from '@/brand'
import { LogoMark } from '@/ui/Logo'
import { useAuth } from '@/auth/AuthProvider'
import { projects } from '@/cloud/projects'
import { ensureProfile } from '@/cloud/profile'

/**
 * Where Auth0 sends people back to.
 *
 * The SDK has already taken the code out of the URL and swapped it for a
 * session by the time this renders; all this page does is wait for that to
 * settle, move anything built in this browser into the account, and get out of
 * the way.
 *
 * Adopting the local projects here rather than on the projects page matters:
 * it is the one moment we know a sign-in has just happened, so it runs once
 * instead of on every visit, and somebody who built something before making an
 * account does not have to be told what happened to it.
 */
export function AuthCallback() {
  const { user, loading, error } = useAuth()
  const [status, setStatus] = useState('Finishing sign-in…')
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    /*
     * The one refusal that is not a failure.
     *
     * A brand-new account whose address is unconfirmed comes back here as an
     * OAuth error, because that is how a post-login deny reaches the app.
     * Showing it as one would tell somebody their sign-up broke ten seconds
     * after it worked.
     */
    const denied = /email_unverified(?::(.*))?/.exec(error ?? '')
    if (denied) {
      const addr = denied[1]?.trim()
      /*
       * Mark the signup as in flight, for this tab only.
       *
       * The confirmation page is the last step of something that just
       * happened, not a place. Without this marker it is just a URL, and a
       * browser that restores its tabs reopens it every morning — which is
       * the other half of the site looking stuck on a message. sessionStorage
       * is exactly the right lifetime: a reload keeps it, a new session does
       * not.
       */
      try {
        sessionStorage.setItem('draftrig.signup.v1', addr ?? '1')
      } catch {
        /* private window: the page falls back to its own query string */
      }
      navigate(`/confirm${addr ? `?email=${encodeURIComponent(addr)}` : ''}`, { replace: true })
      return
    }

    if (!user) {
      const t = setTimeout(() => navigate('/signin', { replace: true }), 2200)
      setStatus('That sign-in did not complete. Taking you back…')
      return () => clearTimeout(t)
    }

    let cancelled = false
    ;(async () => {
      await ensureProfile(user)
      setStatus('Moving your local projects into your account…')
      const moved = await projects.adoptLocal().catch(() => 0)
      if (cancelled) return
      setStatus(moved > 0 ? `Brought ${moved} project${moved === 1 ? '' : 's'} across.` : 'Signed in.')
      setTimeout(() => navigate('/projects', { replace: true }), moved > 0 ? 900 : 350)
    })()
    return () => {
      cancelled = true
    }
  }, [loading, user, error, navigate])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <LogoMark size={40} />
        <h1>{BRAND.name}</h1>
        <p className="lede" style={{ marginBottom: 0 }}>{error ?? status}</p>
      </div>
    </div>
  )
}
