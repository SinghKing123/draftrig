import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { REDUCED, useMedia } from '@/ui/motion'

/**
 * A project in four frames: laid out, wired, coded, run.
 *
 * A carousel that moves on its own every two seconds. Each card carries its
 * stage as a heading, so the name travels with the picture it names. The
 * track loops: three copies of the four cards sit side by side, the visible
 * position stays in the middle copy, and whenever a move ends in an outer
 * copy the track jumps back to the same card in the middle without any
 * transition. Cards are always there to peek in from both sides, and the
 * loop has no seam.
 *
 * It stops moving while a pointer is over it, while it has focus, while a
 * finger is on it, while it is off screen, and for good when somebody asks
 * for reduced motion. It also has its own pause button, because a phone
 * has no hover, and anything that moves by itself for more than five
 * seconds needs a way to stop it.
 *
 * Each frame is a different build, picked for its stage, because no single
 * starter is a good picture of all four: the room has nothing to code and
 * the thrust rig has nothing to lay out. A card names its stage and the
 * build, and carries nothing else: the line of specification that used
 * to sit under the name was 12px of grey monospace, which at arm's
 * length is a smudge and not a number.
 *
 * Shot by tools/shoot-steps.mjs.
 */

interface Step {
  stage: string
  src: string
  name: string
  alt: string
  /** Where a phone's square crop centres: the part of the window that matters. */
  focus: string
}

const STEPS: Step[] = [
  {
    stage: 'Layout',
    src: '/shots/steps/layout.jpg',
    name: 'Room setup',
    alt: 'The Draftrig editor in Build mode: a room with a sit-stand desk, two monitors and a wall-mounted TV',
    focus: '62% 50%',
  },
  {
    stage: 'Wire',
    src: '/shots/steps/wire.jpg',
    name: 'Uno → 16×2 LCD',
    alt: 'The Draftrig editor in Wire mode: jumpers from an Arduino Uno to a character LCD',
    focus: '62% 50%',
  },
  {
    stage: 'Code',
    src: '/shots/steps/code.jpg',
    name: 'ESP32 · control cabinet',
    alt: 'The Draftrig code workspace with the ESP32 sketch for a four-zone control cabinet',
    focus: '30% 50%',
  },
  {
    stage: 'Simulate',
    src: '/shots/steps/sim.jpg',
    name: 'Brushless thrust rig',
    alt: 'The Draftrig editor in Simulate mode: a thrust rig running, with the throttle signal on the scope',
    focus: '60% 50%',
  },
]

const N = STEPS.length
/** Time from one move starting to the next one starting. */
const DWELL = 2000
/** How long a move takes. Kept in step with the CSS transition. */
const MOVE = 700

const mod = (a: number, n: number) => ((a % n) + n) % n
/** The same card, in the middle copy. */
const middle = (p: number) => N + mod(p - N, N)

export function Steps() {
  const reduced = useMedia(REDUCED)
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLOListElement>(null)

  const [pos, setPos] = useState(N)
  const [animate, setAnimate] = useState(false)
  const [stride, setStride] = useState(0)
  const [drag, setDrag] = useState(0)
  /** Counts moves, so the timer and the progress bar restart on each one. */
  const [beat, setBeat] = useState(0)

  const [held, setHeld] = useState(false) // pointer over it, or focus in it
  const [touching, setTouching] = useState(false)
  const [stopped, setStopped] = useState(false) // the pause button
  const [onScreen, setOnScreen] = useState(false)
  const [tabHidden, setTabHidden] = useState(false)

  const playing = !reduced && !stopped && !held && !touching && onScreen && !tabHidden
  const active = mod(pos, N)

  /* ---- measuring: one card plus the gap, in pixels ---- */
  useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => {
      const [a, b] = el.children as unknown as HTMLElement[]
      if (a && b) setStride(b.offsetLeft - a.offsetLeft)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---- what stops it ---- */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    const vis = () => setTabHidden(document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  /* ---- moving ---- */
  const go = useCallback(
    (to: (p: number) => number) => {
      setBeat((b) => b + 1)
      if (reduced) {
        setAnimate(false)
        setPos((p) => middle(to(p)))
        return
      }
      setAnimate(true)
      // Never past the copies on either side, however fast somebody taps.
      setPos((p) => Math.min(3 * N - 1, Math.max(0, to(p))))
    },
    [reduced],
  )
  const next = useCallback(() => go((p) => p + 1), [go])
  const prev = useCallback(() => go((p) => p - 1), [go])
  const jump = (i: number) => go((p) => p + (i - mod(p, N)))

  // After a move lands in an outer copy, step back to the middle one unseen.
  useEffect(() => {
    if (pos >= N && pos < 2 * N) return
    const t = window.setTimeout(() => {
      setAnimate(false)
      setPos(middle)
    }, MOVE + 40)
    return () => window.clearTimeout(t)
  }, [pos])

  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(next, DWELL)
    return () => window.clearTimeout(t)
  }, [playing, beat, next])

  /* ---- swiping ---- */
  const start = useRef<{ x: number; y: number; t: number; id: number; dragging: boolean } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, dragging: false }
    setTouching(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.dragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.dragging = true
        setAnimate(false)
        track.current?.setPointerCapture(e.pointerId)
      } else if (Math.abs(dy) > 10) {
        // A vertical swipe is the page scrolling, not this.
        start.current = null
        setTouching(false)
        return
      } else return
    }
    // Resistance past half a card, so it cannot be flung off into the copies.
    const lim = stride * 0.6
    setDrag(Math.abs(dx) > lim ? Math.sign(dx) * (lim + (Math.abs(dx) - lim) * 0.3) : dx)
  }
  const onPointerEnd = (e: React.PointerEvent) => {
    const s = start.current
    start.current = null
    setTouching(false)
    if (!s || !s.dragging) return
    const dx = e.clientX - s.x
    const speed = dx / Math.max(1, performance.now() - s.t)
    setDrag(0)
    if (dx < -stride * 0.18 || speed < -0.45) next()
    else if (dx > stride * 0.18 || speed > 0.45) prev()
    else go((p) => p)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev()
    }
  }

  const cards = Array.from({ length: 3 * N }, (_, k) => ({ s: STEPS[k % N], k, real: k >= N && k < 2 * N }))

  return (
    <div
      ref={root}
      className="dr-car"
      role="region"
      aria-roledescription="carousel"
      aria-label="A project, stage by stage"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHeld(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHeld(false)}
      // Keyboard focus only: a tapped button keeps focus, and that is not a request to stop.
      onFocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHeld(false)}
      onKeyDown={onKeyDown}
    >
      <div className="dr-car-view">
        <ol
          ref={track}
          className="dr-car-track"
          data-animate={animate || undefined}
          aria-live={playing ? 'off' : 'polite'}
          style={{ transform: `translate3d(${-pos * stride + drag}px, 0, 0)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {cards.map(({ s, k, real }) => {
            const i = k % N
            return (
              <li
                key={k}
                className="dr-car-card"
                data-on={k === pos || undefined}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${N}: ${s.stage}`}
                aria-hidden={!real || undefined}
                // The copies are there to be seen at the edges, not read twice.
                {...(!real ? { inert: '' } : {})}
              >
                <div className="dr-car-head">
                  <h3>{s.stage}</h3>
                </div>
                <div className="dr-car-pic">
                  <img
                    src={s.src}
                    alt={real ? s.alt : ''}
                    width={960}
                    height={665}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{ '--focus': s.focus } as React.CSSProperties}
                  />
                </div>
                <p className="dr-car-cap">
                  <strong>{s.name}</strong>
                </p>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="dr-car-bar">
        <div className="dr-car-dots" role="tablist" aria-label="Stages">
          {STEPS.map((s, i) => (
            <button
              key={s.stage}
              role="tab"
              aria-selected={i === active}
              data-on={i === active || undefined}
              onClick={() => jump(i)}
            >
              <span className="fill" key={i === active ? `${beat}-${playing}` : 'idle'} data-run={(i === active && playing) || undefined} />
              {s.stage}
            </button>
          ))}
        </div>
        <div className="dr-car-btns">
          {!reduced && (
            <button
              onClick={() => setStopped((v) => !v)}
              aria-label={stopped ? 'Play the slides' : 'Pause the slides'}
              aria-pressed={stopped}
            >
              {stopped ? (
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8 12.5 8l-8 5.2V2.8Z" fill="currentColor" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3h2.4v10H4.5zM9.1 3h2.4v10H9.1z" fill="currentColor" /></svg>
              )}
            </button>
          )}
          <button className="dr-car-step" onClick={prev} aria-label="Previous stage">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
          </button>
          <button className="dr-car-step" onClick={next} aria-label="Next stage">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
