import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Reveal, Tally, useInView, useScrolled } from '@/ui/motion'
import { CrewSpot } from '@/ui/CrewSpot'
import { ModelCredits } from '@/ui/ModelCredits'
import { Showcase } from './Showcase'
import { Walk } from './Walk'
import { Trace } from './Trace'
import { Find } from './Find'
import { BuildWall } from './BuildWall'

/**
 * The front page.
 *
 * PRODUCT.md records a standing preference, set by the user and unchanged
 * since: the category convention, played straight, with plyxl.com and
 * nootles.com named as the craft bar. The job here is not a concept. It is
 * to execute that convention at the level those two execute it, which turns
 * out to be a much harder brief than inventing something.
 *
 * What those pages actually do, and what this one now does:
 *
 *   - The page arrives. Nothing is static on load: the headline assembles,
 *     the figures land, the first screenshot settles into place. All of it
 *     through one grammar, in `ui/motion.tsx`.
 *   - Density. Short sections, close together, each with something in it to
 *     look at. The old page had eleven screens and four things on them.
 *   - The product is the imagery, at full size, shot properly. Not a
 *     thumbnail in a frame beside three paragraphs.
 *   - The character has one home — a row along one band, every figure doing
 *     a different job — instead of being tucked into six corners.
 *
 * What was removed and why, so it does not come back:
 *
 *   - The socket panel with the appliances you clicked. See `Walk.tsx`.
 *   - The flat SVG vignettes of a desk and a bench. They were drawings of
 *     the product standing in for photographs of it, on a page whose whole
 *     argument is that the thing is real.
 *   - Rig scattered across five sections, twice in front of the text.
 */

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/*
 * There was a selection box around the word "build" here.
 *
 * The editor's own chrome — a blue rectangle, four corner handles and a
 * dimension badge — drawn around one word of the headline. The idea was
 * that the page says what the product is in the same gesture as it says
 * what the page is about.
 *
 * It did not survive contact with anybody who had not used the editor.
 * Without that context a blue box with handles around a word reads as a
 * text field, a spellcheck error or a rendering fault, and the badge under
 * it reads as a tooltip that failed to go away. The first thing a visitor
 * sees should not be a thing they have to work out.
 *
 * The headline is a headline now. Kept here as a note so it does not get
 * reinvented.
 */

/**
 * The two counts on this page, read from the thing they count.
 *
 * Both of these were typed in. The page said 172 parts in two places while
 * the catalogue held 194, because the number was copied out of a document
 * that was written when it was true. A figure a reader can check in ten
 * seconds by opening the editor is the worst kind to get wrong, and the
 * only way to not get it wrong again is to never write it down.
 *
 * The import is the same module the search below already pulls in, so this
 * costs nothing that was not already being paid.
 */
function useCounts(): { parts: number | null; builds: number | null } {
  const [n, setN] = useState<{ parts: number | null; builds: number | null }>({
    parts: null,
    builds: null,
  })
  useEffect(() => {
    let live = true
    void Promise.all([import('@/parts/catalog'), import('@/io/starters')]).then(
      ([cat, starters]) => {
        if (!live) return
        setN({ parts: cat.allParts().length, builds: starters.STARTERS.length })
      },
    )
    return () => {
      live = false
    }
  }, [])
  return n
}

/**
 * The first screenshot, settling into the page.
 *
 * It starts tipped back a few degrees and slightly small, and comes upright
 * as it enters. That is the one piece of three-dimensional movement on the
 * page and it is spent here on purpose: this is the moment the reader first
 * sees the actual product, and a thing that rights itself in front of you
 * reads as being presented rather than as having always been there.
 *
 * The perspective lives on the wrapper rather than the element, so the tilt
 * is a real projection and not a squash.
 */
function Showpiece({ parts, builds }: { parts: number | null; builds: number | null }) {
  const [ref, seen] = useInView<HTMLDivElement>('-4% 0px -10% 0px')
  return (
    <div className="showpiece" ref={ref} data-on={seen || undefined}>
      <div className="showpiece-frame">
        <img
          src="/shots/cine-ui-room.jpg"
          alt="The Draftrig editor, with a room laid out in it: a desk, two screens, a tower and the wiring between them"
          width={1440}
          height={900}
          decoding="async"
        />
      </div>
      {/*
        * A caption, not a stat row.
        *
        * This was three cells of big figure over small label, and the third
        * cell's figure was the words "No account" — a sentence set at two
        * rem in a slot the reader reads as a number. The moment a
        * non-number sits in that row the row is a template being filled in
        * rather than three facts being stated.
        *
        * As one line it is a caption under a photograph, which is what it
        * always was. Both counts are still counted rather than typed, and
        * each holds its place with a dash until it arrives so nothing
        * under it moves.
        */}
      <p className="showpiece-cap">
        {parts === null ? <span className="showpiece-wait">—</span> : <Tally to={parts} />} parts
        <span className="showpiece-dot" aria-hidden="true" />
        {builds === null ? <span className="showpiece-wait">—</span> : <Tally to={builds} />} builds
        <span className="showpiece-dot" aria-hidden="true" />
        no account
      </p>
    </div>
  )
}

/** One stroke weight, one size, drawn rather than borrowed. */
const ICONS = {
  solver: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  ),
  display: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="13" rx="2" /><path d="M8 21h8M12 17.5V21" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18l-5-6 5-6M15 6l5 6-5 6" />
    </svg>
  ),
  wire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M5 17c0-8 14-4 14-10" />
    </svg>
  ),
  frame: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" /><path d="M3 7l9 4.5L21 7M12 11.5V21" />
    </svg>
  ),
  bom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3.5h14v17l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" />
    </svg>
  ),
}

/*
 * What is in it: a term, and its specification.
 *
 * These were sentences. Sentences are the wrong form here — a reader
 * scanning a grid of six is not reading prose, they are looking for the
 * one that answers their question, and a sentence makes them read a
 * clause to find out it does not. So each is the name of the thing and
 * then the line a datasheet would carry: the method, the parts, the
 * units.
 */
const FEATURES = [
  {
    icon: ICONS.solver,
    title: 'Solver',
    spec: 'Modified nodal analysis, stepped continuously',
  },
  {
    icon: ICONS.display,
    title: 'Displays',
    spec: 'HD44780 and SSD1306, decoded off the bus',
  },
  {
    icon: ICONS.code,
    title: 'Sketches',
    spec: 'Uno · Nano · ESP32 · ESP8266, real pin maps',
  },
  {
    icon: ICONS.wire,
    title: 'Wiring',
    spec: 'Pin to pin, routed, length in mm',
  },
  {
    icon: ICONS.frame,
    title: 'Structure',
    spec: '2020 extrusion, panels, fasteners, T-nuts',
  },
  {
    icon: ICONS.bom,
    title: 'Bill of materials',
    spec: 'Priced, weighed, CSV',
  },
]

/**
 * A 555 output, running.
 *
 * The shape the lab preset actually puts out — the period and the duty are
 * that circuit's — drawn at full width and panned on a loop. Two copies end
 * to end, translated by exactly half, which is what makes the loop seamless
 * without measuring anything. It is not live data, and the page does not say
 * it is.
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
  const scrolled = useScrolled()
  const accounts = useAuth().enabled
  const { parts, builds } = useCounts()

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="lp">
      {/* ---- navigation ---- */}
      <header className="nav" data-stuck={scrolled || undefined}>
        <div className="nav-pill">
          <Link to="/" className="nav-mark" aria-label={BRAND.name}>
            <Wordmark size={19} />
          </Link>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#builds">Builds</a>
            <a href="#inside">Inside</a>
            <a href="#parts">Parts</a>
          </nav>
          <div className="nav-end">
            <AccountMenu compact />
            <Link className="btn btn-primary btn-sm" to="/projects">
              Try Draftrig
            </Link>
          </div>
        </div>
      </header>

      {/* ---- hero ---- */}
      <section className="hero">
        <div className="lpw hero-copy">
          <Reveal now delay={40} as="p" className="hero-flag">
            <Link to="/app?start=lab9-blinker">
              <b>New</b>
              <span>555 breadboard labs</span>
              {/* Drawn, not typed. Every other mark on this page is a
                  stroked path at one weight, and a `›` is whatever the
                  reader's fallback font decides it is. */}
              <svg className="chev" viewBox="0 0 8 12" fill="none" aria-hidden="true">
                <path d="M2 1.5 L6.5 6 L2 10.5" stroke="currentColor" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Reveal>

          <h1>
            <Reveal now delay={110} as="span" className="hero-line">
              Run it before
            </Reveal>
            <Reveal now delay={190} as="span" className="hero-line">
              you build it.
            </Reveal>
          </h1>

          <Reveal now delay={300} as="p" className="hero-sub">
            3D layout, point-to-point wiring, and a solver that runs the circuit.
          </Reveal>

          <Reveal now delay={380} className="hero-cta">
            <Link className="btn btn-primary btn-lg" to="/projects">
              Try Draftrig<span className="arr" aria-hidden="true" />
            </Link>
            <a className="btn btn-ghost btn-lg" href="#how">
              See how it works
            </a>
          </Reveal>
        </div>

        {/*
          * Two of them, at opposite ends of the hero's floor.
          *
          * Not six in a row. Six figures side by side is a cast lineup, and
          * six copies of one figure is a lineup of the same drawing — which
          * is what this was, and it read as a borrowed arrangement with the
          * thing that made it work left out.
          *
          * Two, far apart, facing in, on the line the grid stops at. They
          * frame the headline and the action between them rather than
          * forming a band under it, and the other two stand further down
          * the page where there is something for them to be doing.
          */}
        <Reveal now delay={480} className="hero-floor">
          <CrewSpot who="rig" act="solder" mood="happy" size={124} look={1} className="hero-floor-l" />
          <CrewSpot who="dot" act="point" mood="idle" size={116} look={1} flip className="hero-floor-r" />
        </Reveal>
      </section>

      {/* ---- the product, full size ---- */}
      <Showpiece parts={parts} builds={builds} />

      {/* ---- how it works, driven by the scrollbar ---- */}
      <Walk />

      {/* ---- what people make ---- */}
      <Showcase />

      {/* ---- what is inside ---- */}
      <section className="sec inside" id="inside">
        <div className="lpw">
          <Reveal className="sec-head center">
            <h2>What is inside</h2>
          </Reveal>

          <ul className="feats">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} as="li" delay={i * 60} className="feat">
                <span className="feat-ico">{f.icon}</span>
                <h3>{f.title}</h3>
                <p className="mono">{f.spec}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- the drawn circuit beside the built one ---- */}
      <Trace />

      <Wave />

      {/* ---- build around a thing you already own ---- */}
      <section className="sec pair">
        <div className="lpw pair-grid">
          <Reveal className="pair-art">
            <img
              src="/shots/cine-stand.jpg"
              alt="A frame of aluminium extrusion built around an upright games console"
              width={1280}
              height={860}
              loading="lazy"
              decoding="async"
            />
            <span className="pair-tag mono">33 mm clear each side</span>
          </Reveal>
          <Reveal delay={90} className="pair-copy">
            <h2>Build around what you own.</h2>
            <dl className="spec">
              <div><dt>Console</dt><dd>Scanned model, 390 × 104 × 260 mm</dd></div>
              <div><dt>Frame</dt><dd>2020 extrusion, bolted</dd></div>
              <div><dt>Clearance</dt><dd>33 mm each side</dd></div>
              <div><dt>Shelf</dt><dd>Plywood, on brackets and T-nuts</dd></div>
            </dl>
            <Link className="btn btn-ghost" to="/app?start=ps5-stand">
              Open this stand<span className="arr" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---- the catalogue, searchable ---- */}
      <Find total={parts} />

      {/* ---- builds assembling themselves ---- */}
      <BuildWall />

      {/* ---- the close ---- */}
      <section className="sec end-wrap">
        <div className="lpw">
          <div className="end">
            <Reveal className="end-copy">
              <h2>The bench is open.</h2>
              <p>
                Build, wire and run without an account. An account keeps your work.
              </p>
              <div className="end-cta">
                <Link className="btn btn-primary btn-lg" to="/projects">
                  Try Draftrig<span className="arr" aria-hidden="true" />
                </Link>
                {accounts && (
                  <Link className="btn btn-ghost btn-lg" to="/signin">
                    Sign in
                  </Link>
                )}
              </div>
            </Reveal>
            <CrewSpot who="rig" act="point" mood="happy" size={132} look={-1} bare className="end-rig" />
          </div>
        </div>
      </section>

      {/* ---- footer ---- */}
      <footer className="foot">
        <div className="lpw foot-grid">
          <div className="foot-brand">
            <Wordmark size={20} />
          </div>

          <nav className="foot-col">
            <h3>The editor</h3>
            <Link to="/projects">Your projects</Link>
            <Link to="/app">Open the bench</Link>
            <a href="#parts">Part catalogue</a>
            <a href="#builds">Example builds</a>
          </nav>

          <nav className="foot-col">
            <h3>This page</h3>
            <a href="#how">How it works</a>
            <a href="#inside">What is inside</a>
            <a href="#builds">Built with it</a>
          </nav>

          <nav className="foot-col">
            <h3>Account</h3>
            {accounts && <Link to="/signin">Sign in</Link>}
            <a href={`mailto:${BRAND.support}`}>Contact</a>
          </nav>
        </div>

        <ModelCredits className="lpw" />

        <div className="lpw foot-base">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <span className="foot-note">Built in the open. Nothing here is a mock-up.</span>
        </div>
      </footer>
    </div>
  )
}
