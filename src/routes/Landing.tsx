import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Clip } from './Clip'

/**
 * The front page.
 *
 * Shown, not described. Four short clips of the editor doing real things
 * carry it, and the words around them are labels rather than paragraphs —
 * nobody reads a paragraph on a landing page, and writing one anyway is how a
 * page ends up long and unconvincing at the same time.
 *
 * Everything that moves either responds to the pointer or plays only while it
 * is on screen. Nothing animates for its own sake, and nothing loads before it
 * is close.
 */

/** Counts read from the catalog, so the page cannot claim parts that are not there. */
function useCatalogCount(): number | null {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    import('@/parts/catalog').then((m) => {
      if (live) setN(m.allParts().length)
    })
    return () => {
      live = false
    }
  }, [])
  return n
}

/**
 * Count up to a number once it is on screen.
 *
 * Driven by a scroll listener rather than an IntersectionObserver, because
 * the number arrives from a dynamic import and the observer has to be armed
 * after it does. Getting that order wrong leaves a zero on the page for ever,
 * which is what happened: the first run had nothing to count to and returned
 * before observing, and by the time the catalog landed nobody was watching.
 */
function Counter({ to }: { to: number | null }) {
  const [shown, setShown] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const done = useRef(false)

  useEffect(() => {
    if (to === null) return
    const el = ref.current
    if (!el) return

    const start = () => {
      if (done.current) return
      done.current = true
      const t0 = performance.now()
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 900)
        setShown(Math.round(to * (1 - Math.pow(1 - k, 3))))
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }

    const check = () => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) start()
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [to])

  return <span ref={ref}>{to === null ? '—' : shown}</span>
}

/** Fades and lifts its child the first time it comes near the viewport. */
function Rise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setOn(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { rootMargin: '-8%' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="rise" data-on={on} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/**
 * The bar across the top of the page.
 *
 * It fills as you scroll, so it is a position rather than decoration — the
 * one piece of motion here that tells you something you would otherwise have
 * to guess.
 */
function ScrollBar() {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setPct(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return <div className="scrollbar" style={{ transform: `scaleX(${pct})` }} aria-hidden="true" />
}

function useStuck(): boolean {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return stuck
}

const FEATURES = [
  { clip: 'clip-wire', poster: '/clips/clip-wire.jpg', label: 'Wire it', note: 'Terminal to terminal' },
  { clip: 'clip-run', poster: '/clips/clip-run.jpg', label: 'Run it', note: 'A solver, not an animation' },
  { clip: 'clip-builds', poster: '/clips/clip-builds.jpg', label: 'Frame it', note: 'Extrusion, panels, motion' },
]

export function Landing() {
  const stuck = useStuck()
  const parts = useCatalogCount()
  const accounts = useAuth().enabled

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="site lp">
      <ScrollBar />

      <header className="lp-top" data-stuck={stuck}>
        <Link to="/" aria-label={BRAND.name}><Wordmark size={23} /></Link>
        <div className="grow" />
        <AccountMenu compact />
        <Link className="cta primary small" to="/app">Open the editor</Link>
      </header>

      {/* ---------------- hero ---------------- */}

      <section className="lp-hero">
        <div className="lp-hero-film">
          <Clip name="clip-assemble" poster="/clips/clip-assemble.jpg" className="lp-film" priority />
          <div className="lp-hero-wash" />
        </div>

        <div className="lp-hero-text">
          <h1>Build it before you buy it.</h1>
          <p>Electronics and the frame around them, in one 3D scene.</p>
          <div className="lp-cta">
            <Link className="cta primary" to="/app">Start building</Link>
            <a className="cta ghost onfilm" href="#see">See it work</a>
          </div>
        </div>
      </section>

      {/* ---------------- three things ---------------- */}

      <section className="lp-strip" id="see">
        {FEATURES.map((f, i) => (
          <Rise key={f.clip} delay={i * 90}>
            <figure className="lp-card">
              <Clip name={f.clip} poster={f.poster} className="lp-card-film" />
              <figcaption>
                <b>{f.label}</b>
                <span>{f.note}</span>
              </figcaption>
            </figure>
          </Rise>
        ))}
      </section>

      {/* ---------------- numbers ---------------- */}

      <section className="lp-figures">
        <div><b><Counter to={parts} /></b><span>parts, to scale</span></div>
        <div><b>3D</b><span>in the browser</span></div>
        <div><b>0</b><span>to install</span></div>
      </section>

      {/* ---------------- closer ---------------- */}

      <section className="lp-closer">
        <Rise>
          <h2>Open it and put something together.</h2>
          <div className="lp-cta">
            <Link className="cta onink" to="/app">Open the editor</Link>
            {accounts && <Link className="cta ghost onfilm" to="/signin">Sign in</Link>}
          </div>
        </Rise>
      </section>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} {BRAND.name}</span>
        <div className="grow" />
        <a href={`mailto:${BRAND.support}`}>Contact</a>
      </footer>
    </div>
  )
}
