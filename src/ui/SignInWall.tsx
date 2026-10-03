import { useEffect } from 'react'
import { LogoMark } from './Logo'
import { IconX } from './Icons'
import { useAuth } from '@/auth/AuthProvider'

/**
 * What a signed-out person gets when they try to keep something.
 *
 * The bench is open to everybody: you can build, wire and run a circuit
 * without an account, because a tool nobody can try is a tool nobody adopts.
 * What needs an account is anything that outlives the tab — saving a build,
 * and the place saved builds live.
 *
 * It asks at the moment the person wants the thing, rather than at the door.
 * Somebody who has just wired a circuit and pressed Save has a reason to make
 * an account; somebody who has just arrived does not.
 */
export function SignInWall({
  reason,
  onClose,
  onContinue,
}: {
  /** What they were trying to do, in their words, not ours. */
  reason: string
  onClose: () => void
  /**
   * Run before leaving for the sign-in page.
   *
   * Signing in is a round trip through another site, so the bench has to be
   * put somewhere first or it is gone by the time they come back. The editor
   * writes it to this browser, and the callback moves it into the new account
   * along with anything else that was waiting.
   */
  onContinue?: () => void
}) {
  const { signIn, signUp } = useAuth()

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const go = (fn: () => void) => () => {
    onContinue?.()
    fn()
  }

  return (
    <div className="wall-scrim" onPointerDown={onClose}>
      <div className="wall" role="dialog" aria-modal="true" onPointerDown={(e) => e.stopPropagation()}>
        <button className="wall-x" onClick={onClose} aria-label="Close">
          <IconX size={13} />
        </button>

        <LogoMark size={34} onDark />
        <h2>{reason}</h2>
        <p>Builds live in your account, on every machine you sign in from.</p>

        <div className="wall-actions">
          <button className="btn primary lg" onClick={go(signUp)}>Create an account</button>
          <button className="btn lg" onClick={go(signIn)}>Sign in</button>
        </div>

      </div>
    </div>
  )
}
