import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND } from '@/brand'
import { LogoMark } from '@/ui/Logo'
import { useAuth } from '@/auth/AuthProvider'
import { projects } from '@/cloud/projects'

/**
 * Where Google and the email link land.
 *
 * Supabase parses the token out of the URL itself; all this page has to do is
 * wait for the session to appear, move any browser-local projects into the new
 * account, and get out of the way.
 */
export function AuthCallback() {
  const { user, loading, error } = useAuth()
  const [status, setStatus] = useState('Finishing sign-in…')
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    if (!user) {
      // No session came back, most often a link that was already used.
      const t = setTimeout(() => navigate('/signin', { replace: true }), 2200)
      setStatus('That sign-in link did not work. Taking you back…')
      return () => clearTimeout(t)
    }

    let cancelled = false
    ;(async () => {
      setStatus('Moving your local projects into your account…')
      const moved = await projects.adoptLocal().catch(() => 0)
      if (cancelled) return
      setStatus(moved > 0 ? `Brought ${moved} project${moved === 1 ? '' : 's'} across.` : 'Signed in.')
      setTimeout(() => navigate('/projects', { replace: true }), moved > 0 ? 900 : 350)
    })()
    return () => {
      cancelled = true
    }
  }, [loading, user, navigate])

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
