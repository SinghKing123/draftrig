import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevron } from '@/ui/Icons'

/**
 * The builds the front page shows.
 *
 * Every one is a starter, so the id here opens the same thing the picture is a
 * photograph of. Nothing on this page is a render made somewhere else.
 */
export interface Build {
  /** Starter id. `/app?start=<id>` opens it. */
  id: string
  img: string
  name: string
  note: string
}

export const BUILDS: Build[] = [
  { id: 'motion-sim', img: '/build-motion.jpg', name: 'Motion rig', note: 'Seat, wheel and two screw actuators' },
  { id: 'cnc', img: '/build-cnc.jpg', name: 'CNC router', note: 'Three axes and the drivers for them' },
  { id: 'rover', img: '/build-rover.jpg', name: 'Rover', note: 'Four motors, a range finder, a battery' },
  { id: 'panel', img: '/build-panel.jpg', name: 'Control panel', note: 'Everything a hand touches' },
  { id: 'gaming-4k', img: '/build-pc.jpg', name: 'Gaming PC', note: 'A 4090 and what it needs' },
  { id: 'frame', img: '/build-frame.jpg', name: '2020 frame', note: 'Extrusion cut to length' },
  { id: 'lcd', img: '/build-lcd.jpg', name: 'LCD on a bus', note: 'Driven pin by pin' },
]

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])
  return reduced
}

/* ------------------------------------------------------------------ */
/* Hero stage                                                          */
/* ------------------------------------------------------------------ */

const STAGE = [
  { kind: 'video' as const, name: 'Assembling', id: 'frame' },
  ...BUILDS.slice(0, 5).map((b) => ({ kind: 'image' as const, ...b })),
]

/** How long each build holds before the stage moves on, ms. */
const HOLD = 4200

/**
 * The hero: one build after another, with the assembly clip first.
 *
 * Recorded and photographed rather than run live. A live scene would put
 * three.js, the part kernel and the whole catalog on a page most people
 * scroll past, which is a megabyte to show what a few hundred kilobytes
 * already shows at higher quality.
 */
export function BuildStage() {
  const [i, setI] = useState(0)
  const [held, setHeld] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced || held) return
    const t = window.setTimeout(() => setI((n) => (n + 1) % STAGE.length), HOLD)
    return () => window.clearTimeout(t)
  }, [i, held, reduced])

  return (
    <div
      className="stage"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="stage-media">
        {STAGE.map((item, n) => (
          <figure className="slide" key={item.name} data-on={n === i} aria-hidden={n !== i}>
            {item.kind === 'video' && !videoFailed && !reduced ? (
              <video
                src="/assembly.webm"
                poster="/assembly-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={() => setVideoFailed(true)}
              />
            ) : (
              <img
                src={item.kind === 'video' ? '/assembly-poster.jpg' : item.img}
                alt={item.name}
                loading={n < 2 ? 'eager' : 'lazy'}
                decoding="async"
              />
            )}
          </figure>
        ))}
      </div>

      <div className="stage-tabs" role="tablist" aria-label="Builds">
        {STAGE.map((item, n) => (
          <button
            key={item.name}
            role="tab"
            aria-selected={n === i}
            data-on={n === i}
            onClick={() => setI(n)}
          >
            <span className="dot" />
            {item.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Carousel                                                            */
/* ------------------------------------------------------------------ */

/**
 * A row of builds you push along.
 *
 * Scroll snapping does the work, so it drags on a phone and flicks with a
 * trackpad without any of it being reimplemented in JavaScript. The arrows
 * are for mice, which have neither.
 */
export function BuildCarousel() {
  const rail = useRef<HTMLDivElement | null>(null)
  const [edge, setEdge] = useState<'start' | 'middle' | 'end'>('start')

  const sync = useCallback(() => {
    const el = rail.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdge(el.scrollLeft < 8 ? 'start' : el.scrollLeft > max - 8 ? 'end' : 'middle')
  }, [])

  useEffect(() => {
    sync()
    const el = rail.current
    if (!el) return
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [sync])

  const push = (dir: -1 | 1) => {
    const el = rail.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.card')
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="carousel">
      <div className="rail" ref={rail}>
        {BUILDS.map((b) => (
          <Link className="card" key={b.id} to={`/app?start=${b.id}`}>
            <div className="card-img">
              <img src={b.img} alt={b.name} loading="lazy" decoding="async" />
            </div>
            <div className="card-foot">
              <b>{b.name}</b>
              <span>{b.note}</span>
            </div>
          </Link>
        ))}
      </div>

      <button className="nudge left" onClick={() => push(-1)} disabled={edge === 'start'} aria-label="Previous">
        <IconChevron size={16} />
      </button>
      <button className="nudge right" onClick={() => push(1)} disabled={edge === 'end'} aria-label="Next">
        <IconChevron size={16} />
      </button>
    </div>
  )
}
