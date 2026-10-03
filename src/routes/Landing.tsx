import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { SHOWCASE_GLYPHS } from '@/ui/PartIcons'
import { Clip } from './Clip'

/**
 * The front page.
 *
 * Dark, because everything it is showing is dark: the editor, the boards, the
 * clips. A light page wrapped around a dark picture is a page with a hole in
 * the middle of it.
 *
 * Shown rather than described. Every claim is a moving picture of the thing
 * doing it, and the words are labels — a paragraph on a landing page is read
 * by nobody and makes the page longer and less convincing at the same time.
 *
 * What moves, and what each one is for:
 *
 *   the bar at the top   where you are in the page
 *   the glow behind      depth, so the hero is not a flat rectangle
 *   the clips            the product, working
 *   the marquee          how much is in the catalog, without a number
 *   the ring             the same thing again, as a shape
 *   the counter          the number, once somebody is looking at it
 *
 * Nothing else animates. Decoration that moves for its own sake is what makes
 * a site feel cheap rather than alive.
 */

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/** Fills across the top as the page scrolls. */
function Progress() {
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
  return <div className="xp" style={{ transform: `scaleX(${pct})` }} aria-hidden="true" />
}

/** Reveals its child once, the first time it comes near the viewport. */
function Rise({ children, delay = 0, className = '' }: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return setOn(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { rootMargin: '-6%' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`rise ${className}`} data-on={on} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/**
 * Counts up when it is looked at.
 *
 * On a scroll listener rather than an observer: the number arrives from a
 * dynamic import, so anything armed on mount has nothing to count to and
 * leaves a zero on the page for ever. Not hypothetical — that is what the
 * first version of this did.
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
        const k = Math.min(1, (performance.now() - t0) / 1100)
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

/**
 * The catalog, running past.
 *
 * Two rows in opposite directions: one row reads as a banner, two read as a
 * quantity of things. Each row holds its list twice and slides by exactly
 * half its own width, which is what makes the loop seamless without any
 * measuring.
 */
function Marquee({ reverse = false, from = 0 }: { reverse?: boolean; from?: number }) {
  const row = SHOWCASE_GLYPHS.slice(from).concat(SHOWCASE_GLYPHS.slice(0, from))
  const twice = [...row, ...row]
  return (
    <div className="mq" data-reverse={reverse} aria-hidden="true">
      <div className="mq-run">
        {twice.map(({ Glyph, label }, i) => (
          <span className="mq-chip" key={`${label}-${i}`}>
            <Glyph size={15} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * A ring of parts, turning.
 *
 * The ring rotates and every glyph rotates back by the same amount, so the
 * symbols stay upright while the ring moves: a resistor lying on its side at
 * the bottom of a circle reads as a mistake rather than as motion. Both are
 * CSS animations of the same duration, so they cannot drift apart.
 */
function Orbit() {
  const picks = [0, 3, 6, 9, 12, 15, 18, 21, 24, 2, 5, 8]
  return (
    <div className="orbit" aria-hidden="true">
      <div className="orbit-ring">
        {picks.map((p, i) => {
          const { Glyph } = SHOWCASE_GLYPHS[p % SHOWCASE_GLYPHS.length]
          return (
            <span
              className="orbit-node"
              key={i}
              style={{ transform: `rotate(${(360 / picks.length) * i}deg) translateY(-102px)` }}
            >
              <span className="orbit-flip"><Glyph size={17} /></span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

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

function useStuck(): boolean {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return stuck
}

/* ------------------------------------------------------------------ */

export function Landing() {
  const stuck = useStuck()
  const parts = useCatalogCount()
  const accounts = useAuth().enabled

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="lp">
      <Progress />
      <div className="lp-grain" aria-hidden="true" />

      <header className="lp-nav" data-stuck={stuck}>
        <Link to="/" aria-label={BRAND.name}><Wordmark size={22} onDark /></Link>
        <div className="grow" />
        <AccountMenu compact />
        <Link className="btn-sheen" to="/app">Open the editor</Link>
      </header>

      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-mesh" aria-hidden="true" />

        <div className="hero-in">
          <Rise className="hero-copy">
            <h1>Build it <em>before</em> you buy it.</h1>
            <p>Circuits and the frame around them, in one 3D scene that runs.</p>
            <div className="row-cta">
              <Link className="btn-sheen lg" to="/app">Start building</Link>
              <a className="btn-ghost lg" href="#work">See it work</a>
            </div>
          </Rise>

          <Rise className="hero-stage" delay={120}>
            <div className="frame">
              <div className="frame-bar"><i /><i /><i /></div>
              <Clip name="clip-assemble" poster="/clips/clip-assemble.jpg" className="frame-film" priority />
            </div>
          </Rise>
        </div>

        <div className="mq-wrap">
          <Marquee />
          <Marquee reverse from={13} />
        </div>
      </section>

      <section className="bento" id="work">
        <Rise className="tile tile-wide">
          <Clip name="clip-wire" poster="/clips/clip-wire.jpg" className="tile-film" />
          <div className="tile-cap">
            <b>Wire it terminal to terminal</b>
            <span>Every pin is a real pin, at the real pitch.</span>
          </div>
        </Rise>

        <Rise className="tile tile-orbit" delay={80}>
          <Orbit />
          <div className="tile-cap">
            <b><Counter to={parts} /> parts</b>
            <span>Modelled to the millimetre.</span>
          </div>
        </Rise>

        <Rise className="tile" delay={140}>
          <Clip name="clip-run" poster="/clips/clip-run.jpg" className="tile-film" />
          <div className="tile-cap">
            <b>Switch it on</b>
            <span>A solver works out the voltages.</span>
          </div>
        </Rise>

        <Rise className="tile" delay={200}>
          <Clip name="clip-builds" poster="/clips/clip-builds.jpg" className="tile-film" />
          <div className="tile-cap">
            <b>Frame it</b>
            <span>Extrusion, panels and motion.</span>
          </div>
        </Rise>
      </section>

      <section className="closer">
        <div className="closer-glow" aria-hidden="true" />
        <Rise>
          <h2>Open it and put something together.</h2>
          <div className="row-cta center">
            <Link className="btn-sheen lg" to="/app">Open the editor</Link>
            {accounts && <Link className="btn-ghost lg" to="/signin">Sign in</Link>}
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
