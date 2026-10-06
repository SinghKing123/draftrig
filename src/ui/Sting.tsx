import { useEffect, useRef, useState } from 'react'
import { LogoMark, Wordmark } from './Logo'

/**
 * The thing that plays when the editor opens.
 *
 * A trace draws itself in from both edges, the vias light as it passes, and
 * the mark powers up where the two halves meet. The brand is a circuit
 * drawing tool, so the sting is a circuit being drawn and switched on rather
 * than a logo that slides in from somewhere.
 *
 * It plays once a session, not once a load. A sting in front of a film is
 * seen once an evening; the editor is a tool somebody opens and reopens all
 * day, and the fourth time in ten minutes it is an obstacle between them and
 * their work. `sessionStorage` is what draws that line — first open of a tab
 * gets it, every later one goes straight in.
 *
 * It never holds anything up. The editor chunk downloads underneath it the
 * whole time, and whichever finishes last is what the person waits for.
 */

const SEEN = 'draftrig.sting'
const RUN = 1750

/** Whether to play it: once a session, and never against the motion setting. */
export function useSting(): boolean {
  /*
   * The decision is read here and recorded in an effect, never both in the
   * initialiser. Writing from inside useState made the answer depend on how
   * many times React chose to call it: under StrictMode the first call set
   * the flag and the second read it straight back, so the sting marked
   * itself as already seen and never played once.
   */
  const [on] = useState(() => {
    if (typeof window === 'undefined') return false
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
    try {
      return !sessionStorage.getItem(SEEN)
    } catch {
      // Private windows throw on access. A sting is not worth a crash.
      return false
    }
  })

  useEffect(() => {
    if (!on) return
    try {
      sessionStorage.setItem(SEEN, '1')
    } catch {
      /* nothing to do; it simply plays again next time */
    }
  }, [on])

  return on
}

export function Sting({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const t = window.setTimeout(() => {
      setGone(true)
      done.current?.()
    }, RUN)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="sting" data-gone={gone} aria-hidden="true">
      <div className="sting-art">
        <svg viewBox="0 0 620 120" width="620" height="120" className="sting-trace">
          {/*
            Two traces, each jogging at 45° the way a routed one does, stopping
            clear of the middle. The gap between them is the width of the
            lockup: when it was narrower the trace ran straight through the
            wordmark. Drawn with a dash offset so the line arrives rather than
            appears.
          */}
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path className="t t-l" d="M0 60h72l26-26h60l26 26h46" />
            <path className="t t-r" d="M620 60h-72l-26 26h-60l-26-26h-46" />
          </g>
          <g className="vias" fill="currentColor">
            {[72, 158, 230, 390, 462, 548].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 86 : 34} r="3" style={{ animationDelay: `${180 + i * 52}ms` }} />
            ))}
          </g>
        </svg>

        <div className="sting-mark">
          <LogoMark size={54} onDark />
        </div>
        <div className="sting-word">
          <Wordmark size={26} onDark />
        </div>
      </div>
    </div>
  )
}
