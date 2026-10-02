import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Landing } from './Landing'

/**
 * What is at the front door.
 *
 * Signed out, the front page. Signed in, the dashboard — somebody with an
 * account has already been sold to, and every tool with a sign-in behaves
 * this way.
 *
 * The decision is made here rather than inside Landing so that a signed-in
 * visitor never renders the front page at all. Returning a redirect from
 * inside Landing still mounts it first: the hero paints, the catalog count
 * runs, the observers that load the 3D section arm themselves, and only then
 * does the route change. That is a visible flash of a page they did not ask
 * for, which is exactly what this is supposed to avoid.
 *
 * Arriving on purpose — the wordmark in the dashboard bar — says so in router
 * state rather than in the URL, so a link somebody shares still shows the
 * front page, and reloading the one you got from that wordmark goes back to
 * the dashboard.
 */
export function Root() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const onPurpose = Boolean((location.state as { fromApp?: boolean } | null)?.fromApp)

  /*
   * Nothing at all while Auth0 works out whether there is a session.
   *
   * It resolves in a few hundred milliseconds from a cached token. Painting
   * the front page for that long and then replacing it is worse than painting
   * nothing, and a spinner for a third of a second is its own kind of noise.
   */
  if (loading) return <div className="root-wait" />

  if (user && !onPurpose) return <Navigate to="/projects" replace />
  return <Landing />
}
