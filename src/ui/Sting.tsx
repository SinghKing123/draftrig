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
 * It plays every time the editor is opened, from wherever it was opened:
 * the landing page, a tile on the dashboard, the account menu, straight in
 * off a link. It was once a session for a while, on the reasoning that a
 * tool somebody reopens all day should not make them watch a logo each
 * time — but that put it in front of the one route people arrive at cold
 * and nowhere else, and arriving from the dashboard got nothing.
 *
 * Opening a different project from inside the editor is not opening the
 * editor, and does not replay it: both routes render the same component, so
 * moving between them leaves it mounted.
 *
 * It never holds anything up. The editor chunk downloads underneath it the
 * whole time, and whichever finishes last is what the person waits for.
 * Where it does cost something is the trip back from the dashboard with the
 * chunk already cached — that navigation would otherwise be instant, and
 * now it takes the length of the sting.
 */

const RUN = 1750

/** Whether to play it. Only the motion setting can say no. */
export function useSting(): boolean {
  const [on] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
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
