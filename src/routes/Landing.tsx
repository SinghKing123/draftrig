import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Reel } from './Reel'
import { Trace } from './Trace'
import { Find } from './Find'
import { Showcase } from './Showcase'
import { Glyphs } from './Glyphs'

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

const TABS = [
  { label: 'Assemble', clip: 'clip-assemble' },
  { label: 'Wire', clip: 'clip-wire' },
  { label: 'Run', clip: 'clip-run' },
  { label: 'Build', clip: 'clip-builds' },
] as const

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

const THEME_KEY = 'draftrig.lp.theme.v2'

function useTheme(): ['light' | 'dark', () => void] {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private window: it simply will not be remembered */
    }
  }
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#FFFFFF' : '#09090B')
  }, [theme])
  return [theme, flip]
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

/* ------------------------------------------------------------------ */

export function Landing() {
  const stuck = useStuck()
  const accounts = useAuth().enabled
  const [theme, flipTheme] = useTheme()
  const parts = useCatalogCount()

  const [tab, setTab] = useState(0)
  const [seen, setSeen] = useState(false)
  const onSeen = useCallback(() => setSeen(true), [])
  const onEnded = useCallback(() => setTab((t) => (t + 1) % TABS.length), [])

  useEffect(() => { document.title = pageTitle() }, [])


  return (
    <div className="lp" data-theme={theme}>
      <header className="nav" data-stuck={stuck}>
        <div className="nav-in">
          <Link to="/" aria-label={BRAND.name}><Wordmark size={20} onDark={theme === 'dark'} /></Link>
          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#parts">Parts</a>
            <a href="#builds">Builds</a>
          </nav>
          <div className="nav-sp" />
          <button
            className="theme-btn"
            onClick={flipTheme}
            aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'}
          >
            {theme === 'light' ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            )}
          </button>
          <AccountMenu compact />
          <Link className="btn btn-primary btn-sm" to="/app">Open the editor</Link>
        </div>
      </header>

      {/* ---- hero ---- */}
      <section className="hero">
        {/*
          * The bench, turning slowly behind everything.
          *
          * Muted, looping, and not a control: it carries no information, so
          * there is nothing to give anyone a way to play or pause. It is
          * decoration, and it is marked as such.
          */}
        <div className="hero-vid" aria-hidden="true">
          <video
            src="/clips/clip-bg.webm"
            poster="/clips/clip-bg.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            tabIndex={-1}
          />
        </div>
        <Glyphs />
        <div className="lpw">
          <Rise>
            <Link className="pill" to="/app?start=lab9-blinker">
              <b>New</b> 555 breadboard labs
              <span className="chev" aria-hidden="true">›</span>
            </Link>

            <h1>Run it <em>before you build it.</em></h1>
            <p className="hero-sub">
              Lay out a board in 3D, wire it pin to pin, and switch it on.
            </p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" to="/app">
                Start building<span className="arr" aria-hidden="true" />
              </Link>
              <a className="btn btn-ghost btn-lg" href="#features">See how it works</a>
            </div>
          </Rise>

          <Rise delay={90}>
            <div className="lp-shot">
              <div className="lp-shot-bar" aria-hidden="true"><i /><i /><i /></div>
              <div className="lp-shot-body">
                <Reel
                  names={TABS.map((t) => t.clip)}
                  at={tab}
                  onEnded={onEnded}
                  seen={seen}
                  onSeen={onSeen}
                />
                <div className="lp-shot-tabs">
                  {TABS.map((t, i) => (
                    <button key={t.label} data-on={i === tab} onClick={() => setTab(i)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Rise>
        </div>
      </section>

      {/* ---- builds ---- */}
      <Showcase />

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
