import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Carousel } from './Carousel'
import { RigBench, RigDesk, RigFrame } from '@/ui/RigScenes'
import { Selected } from '@/ui/Selected'
import { Trace } from './Trace'
import { Find } from './Find'
import { BuildWall } from './BuildWall'
import { SetupShow } from './SetupShow'

/**
 * The front page.
 *
 * The category convention, executed properly rather than escaped from: light
 * ground, dark text, one accent, generous air, and the product's own dark
 * renders carried in rounded containers. PRODUCT.md records this as a
 * standing preference with plyxl.com and nootles.com as the named references,
 * so the job here is restraint and spacing, not a concept.
 *
 * Everything on the page is the real product: the clips are captures of the
 * editor, the stills are screenshots of builds that ship with it, and the
 * search runs the actual catalog.
 */

/* ------------------------------------------------------------------ */



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
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } },
      { rootMargin: '-8% 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`rise ${className}`} data-on={on} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
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

function useCatalogCount(): number | null {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    void import('@/parts/catalog').then((m) => { if (live) setN(m.allParts().length) })
    return () => { live = false }
  }, [])
  return n
}

/* ------------------------------------------------------------------ */

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.4 L6.3 11.8 L13 4.6" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** One stroke weight, one size, drawn rather than borrowed. */
const ICONS = {
  solver: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  ),
  display: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" /><path d="M8 21h8M12 17.5V21" />
    </svg>
  ),
  code: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l-5-6 5-6M15 6l5 6-5 6" />
    </svg>
  ),
  wire: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M5 17c0-8 14-4 14-10" />
    </svg>
  ),
  frame: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" /><path d="M3 7l9 4.5L21 7M12 11.5V21" />
    </svg>
  ),
  bom: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3.5h14v17l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" />
    </svg>
  ),
}

/*
 * Six labels, no sentences.
 *
 * Each of these carried a line of explanation underneath. They were the kind
 * of copy that exists because a card looks empty without it, nobody reads
 * them, and a grid of six short paragraphs is what a page looks like when it
 * has nothing to show. The product is two sections below; these are a list
 * of what is in it.
 */
const FEATURES = [
  { title: 'Modified nodal analysis', icon: ICONS.solver },
  { title: 'LCD and OLED, decoded', icon: ICONS.display },
  { title: 'Sketches for Uno, Nano, ESP', icon: ICONS.code },
  { title: 'Wiring that routes itself', icon: ICONS.wire },
  { title: 'Extrusion, panels, fasteners', icon: ICONS.frame },
  { title: 'Priced bill of materials', icon: ICONS.bom },
]


/**
 * A 555 output, running.
 *
 * The page says it solves and then shows photographs of it having solved.
 * This is the claim in motion: the waveform the first circuit most people
 * here will build actually puts out, drawn at column width and panned on a
 * loop. The period and the duty are the ones the lab preset produces, so it
 * is the right shape rather than a decorative zigzag; it is not live data
 * and the page never says it is.
 *
 * Two copies end to end, translated by exactly half, which is what makes
 * the loop seamless without measuring anything.
 */
function Wave() {
  const HI = 16
  const LO = 58
  const PERIOD = 150
  const DUTY = 0.34
  const cycles = 10
  let d = `M0 ${LO}`
  for (let i = 0; i < cycles; i++) {
    const x = i * PERIOD
    const up = x + PERIOD * DUTY
    d += ` L${x} ${LO} L${x} ${HI} L${up} ${HI} L${up} ${LO}`
  }
  d += ` L${cycles * PERIOD} ${LO}`
  return (
    <div className="trace" aria-hidden="true">
      <svg viewBox={`0 0 ${cycles * PERIOD} 76`} preserveAspectRatio="none">
        <path className="trace-grid" d={`M0 ${LO + 0.5} H${cycles * PERIOD}`} />
        <path d={d} />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function Landing() {
  const stuck = useStuck()
  const accounts = useAuth().enabled
  const parts = useCatalogCount()

  useEffect(() => { document.title = pageTitle() }, [])


  return (
    <div className="lp">
      <header className="nav" data-stuck={stuck}>
        <div className="nav-in">
          <Link to="/" aria-label={BRAND.name}><Wordmark size={20} /></Link>
          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#parts">Parts</a>
            <a href="#setup">New</a>
            <a href="#builds">Builds</a>
          </nav>
          <div className="nav-sp" />
          <AccountMenu compact />
          <Link className="btn btn-primary btn-sm" to="/app">Open the editor</Link>
        </div>
      </header>

      {/* ---- hero ---- */}
      <section className="hero">
        <div className="lpw hero-split">
          <Rise className="hero-copy">
            <Link className="pill" to="/app?start=lab9-blinker">
              <b>New</b> 555 breadboard labs
              <span className="chev" aria-hidden="true">›</span>
            </Link>

            <h1>Run it before you build it.</h1>
            <p className="hero-sub">
              A bench you can put anything on. Boards, frames, screens, a whole desk and
              the mains behind it — laid out in 3D, wired point to point, and solved.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" to="/app">
                Start building<span className="arr" aria-hidden="true" />
              </Link>
              <a className="btn btn-ghost btn-lg" href="#features">See how it works</a>
            </div>
          </Rise>

          {/*
            * The build, selected.
            *
            * Not a screenshot in a rounded frame, which is what the category
            * ships and what the deck below already does properly. This is the
            * desk-setup document drawn as the editor would have it: picked,
            * boxed, named, and measured. The millimetres are that build's.
            */}
          <Rise delay={110} className="hero-art">
            <Selected label="Desk setup" dim="1600 × 740 mm">
              <RigDesk />
            </Selected>
          </Rise>
        </div>

        <div className="lpw">
          <Rise delay={170}>
            <Carousel />
          </Rise>
        </div>
      </section>

      {/* ---- what it does now that it did not last month ---- */}
      <SetupShow />

      {/* ---- builds ---- */}
      <BuildWall />

      {/*
        * Two more of him, at the two other kinds of work.
        *
        * The page had one claim about scope and a lot of boards. This is the
        * scope: the same editor solders a board and bolts a frame, and the
        * measurements under each are that build's own.
        */}
      <section className="sec works">
        <div className="lpw">
          <Rise className="sec-head center">
            <h2>Same bench, either job.</h2>
            <p>
              A board of twenty-two parts and a rack a metre and a third tall are
              the same document, drawn the same way, priced off the same list.
            </p>
          </Rise>

          <div className="works-grid">
            <Rise>
              <Selected label="Bench clock" dim="22 parts · $37.89" live={false}>
                <RigBench />
              </Selected>
              <h3>Boards, down to the pad</h3>
              <p>
                Perfboard, a vice, an iron. Parts sit where they sit on the real
                thing, and the solver runs on what you joined.
              </p>
            </Rise>
            <Rise delay={90}>
              <Selected label="Extrusion rack" dim="600 × 400 × 1300 mm" live={false}>
                <RigFrame />
              </Selected>
              <h3>Frames, down to the T-nut</h3>
              <p>
                2020 profile, corner brackets, every screw counted. It comes out
                as a cut list you can order from.
              </p>
            </Rise>
          </div>
        </div>
      </section>

      {/* ---- features ---- */}
      <section className="sec sec-alt" id="features">
        <div className="lpw">
          <Rise className="sec-head center">
            <h2>What it does</h2>
          </Rise>

          <div className="feats">
            {FEATURES.map((f, i) => (
              <Rise key={f.title} delay={i * 50}>
                <div className="feat">
                  <span className="feat-ico">{f.icon}</span>
                  <h3>{f.title}</h3>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* ---- the drawn circuit, beside the built one ---- */}
      <Trace />

      {/* ---- wiring row ---- */}
      <section className="sec">
        <div className="lpw">
          <div className="row flip">
            <Rise className="row-copy">
              <h2>Point-to-point wiring</h2>
              <p>Click a pin, click another. The route finds its own way around.</p>
              <ul className="row-list">
                <li><Check /> Pins sit where they do on the real part</li>
                <li><Check /> Parts snap into breadboards and perfboard holes</li>
                <li><Check /> Current shows on the wire that is carrying it</li>
              </ul>
            </Rise>
            <Rise className="row-art" delay={80}>
              <div className="art">
                <video
                  src="/clips/clip-wire.mp4"
                  poster="/clips/clip-wire.jpg"
                  muted
                  loop
                  playsInline
                  autoPlay
                  aria-hidden="true"
                />
              </div>
            </Rise>
          </div>
        </div>
      </section>

      <Wave />

      {/* ---- parts search ---- */}
      <Find total={parts} />

      {/* ---- closing ---- */}
      <section className="end">
        <div className="lpw">
          <Rise>
            <h2>Start building</h2>
            <div className="end-cta">
              <Link className="btn btn-primary btn-lg" to="/app">
                Open the editor<span className="arr" aria-hidden="true" />
              </Link>
              {accounts && <Link className="btn btn-ghost btn-lg" to="/signin">Sign in</Link>}
            </div>
          </Rise>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-in">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <div className="foot-sp" />
          <a href={`mailto:${BRAND.support}`}>Contact</a>
          <Link to="/app">Editor</Link>
        </div>
      </footer>
    </div>
  )
}
