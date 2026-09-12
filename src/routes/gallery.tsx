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

/* ------------------------------------------------------------------ */
/* Turntable                                                           */
/* ------------------------------------------------------------------ */

const SPIN_FRAMES = 24
const spinSrc = (n: number): string => `/spin/spin-cnc-${String(n).padStart(2, '0')}.jpg`

/**
 * A build you can spin.
 *
 * Twenty four photographs taken all the way round, not a live scene. A live
 * one costs three.js, the part kernel and the whole catalog on a page most
 * people scroll past; this is a megabyte of frames that nobody downloads
 * until they are about to see them, and it is sharper.
 *
 * It turns on its own until someone touches it, and then it does what they
 * say. A thing that keeps moving under your hand is annoying.
 */
export function Turntable() {
  const [frame, setFrame] = useState(0)
  const [near, setNear] = useState(false)
  const [ready, setReady] = useState(false)
  const [grabbed, setGrabbed] = useState(false)
  const [touched, setTouched] = useState(false)
  const box = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; from: number } | null>(null)
  const reduced = useReducedMotion()

  // Do not fetch a megabyte of frames for someone who never scrolls this far.
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setNear(true)
        io.disconnect()
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!near) return
    let live = true
    let left = SPIN_FRAMES
    // Held in a local array so the browser keeps them decoded rather than
    // collecting them between frames and refetching on every swap.
    const held: HTMLImageElement[] = []
    for (let i = 0; i < SPIN_FRAMES; i++) {
      const img = new Image()
      img.decoding = 'async'
      img.onload = img.onerror = () => {
        if (!live) return
        if (--left === 0) setReady(true)
      }
      img.src = spinSrc(i)
      held.push(img)
    }
    return () => {
      live = false
      held.length = 0
    }
  }, [near])

  useEffect(() => {
    if (!ready || touched || reduced) return
    const t = window.setInterval(() => setFrame((f) => (f + 1) % SPIN_FRAMES), 110)
    return () => window.clearInterval(t)
  }, [ready, touched, reduced])

  const onDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, from: frame }
    setGrabbed(true)
    setTouched(true)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const w = box.current?.clientWidth ?? 600
    // One full turn per drag across the width of the picture.
    const steps = Math.round(((e.clientX - d.x) / w) * SPIN_FRAMES)
    setFrame((((d.from - steps) % SPIN_FRAMES) + SPIN_FRAMES) % SPIN_FRAMES)
  }
  const onUp = () => {
    drag.current = null
    setGrabbed(false)
  }

  return (
    <div className="turntable" ref={box} data-grabbed={grabbed}>
      <div
        className="spin-media"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {ready ? (
          <img src={spinSrc(frame)} alt="A CNC router, turning" draggable={false} />
        ) : (
          <div className="spin-wait" />
        )}
      </div>
      <p className="spin-hint">{touched ? 'CNC router' : 'Drag to turn it'}</p>
    </div>
  )
}
