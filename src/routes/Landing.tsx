import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { Reveal } from '@/ui/Reveal'
import { LedDemo, PartSearch } from './demos'
import { IconBox, IconList, IconScope, IconSpark, IconWire, IconZap } from '@/ui/Icons'

const BUILD_CATEGORIES = ['structural', 'panel', 'fastener', 'motion']

interface Stats { parts: number; electronics: number; build: number }

/**
 * Counts read from the catalog itself, so the page can never claim more parts
 * than exist. Fetched after first paint, since the catalog is a hundred
 * kilobytes and the hero should not wait for it.
 */
function useCatalogStats(): Stats | null {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    let live = true
    import('@/parts/catalog').then((m) => {
      if (!live) return
      const parts = m.allParts()
      setStats({
        parts: parts.length,
        electronics: parts.filter((p) => !BUILD_CATEGORIES.includes(p.category)).length,
        build: parts.filter((p) => BUILD_CATEGORIES.includes(p.category)).length,
      })
    })
    return () => {
      live = false
    }
  }, [])
  return stats
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

/** Small features, under the three that get a picture of their own. */
const SECONDARY = [
  { icon: <IconWire />, title: 'Wires with resistance', body: 'Length and gauge decide the drop, so a long thin run gets flagged.' },
  { icon: <IconScope />, title: 'Scope on any pin', body: 'Click a terminal to watch it charge, switch or sag.' },
  { icon: <IconList />, title: 'Costs that add up', body: 'Weight and price total while you work, per part and per build.' },
  { icon: <IconSpark />, title: 'An assistant', body: 'Describe a build and get one, using only parts that exist.' },
  { icon: <IconZap />, title: 'Runs in real time', body: 'Press space. Current flows, LEDs light, displays come up.' },
  { icon: <IconBox />, title: 'Yours to keep', body: 'Saved as you go, in your browser. No account needed.' },
]

const PROOF: [string, string][] = [
  ['RC after one time constant', '63.2 %'],
  ['555 astable, 10k / 68k / 1 µF', 'within 15 %'],
  ['Red LED, 5 V through 220 Ω', '13 to 15 mA'],
  ['10 mH across 10 V', 'di/dt = 1000 A/s'],
  ['1 m of 24 AWG', 'modelled, not ignored'],
]

export function Landing() {
  const stats = useCatalogStats()
  const stuck = useStuck()

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="site">
      <nav className="site-nav" data-stuck={stuck}>
        <div className="wrap row">
          <Link to="/" aria-label={BRAND.name}><Wordmark size={26} /></Link>
          <div className="links">
            <a href="#build">What it does</a>
            <a href="#check">Checks</a>
            <a href="#parts">Parts</a>
            <a href="#solver">Solver</a>
          </div>
          <div className="grow" />
          <AccountMenu compact />
          <Link className="cta primary small" to="/app">Open the editor</Link>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="wrap">
          <div className="inner">
            <h1>
              Build it twice.<br />The first time is free.
            </h1>
            <p className="lede">
              A 3D bench for electronics and framing. Lay the whole thing out, wire it up, switch it
              on, and find out what it does before you order a single part.
            </p>
            <div className="actions">
              <Link className="cta primary" to="/app">Open the editor</Link>
              <a className="cta ghost" href="#build">See what it does</a>
            </div>
            <p className="micro">Free. Runs in the browser. No account, nothing to install.</p>
          </div>

          <ProductShot />
        </div>
      </header>

      {/* ---------------- what it does ---------------- */}
      <section className="band" id="build">
        <div className="wrap">
          <Reveal>
            <div className="sec-head">
              <span className="kicker">What it does</span>
              <h2>Most of a build is not the circuit.</h2>
              <p>Circuit, structure and the machine they go in, all in the same scene.</p>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <Row
              img="/feature-display.jpg"
              alt="A character LCD showing text, driven by a microcontroller"
              kicker="Electronics"
              title="Parts that behave like parts"
            >
              A character LCD driven over its actual HD44780 bus, not told what to show. Transistors,
              MOSFETs, 555s, logic, op-amps, regulators and motor drivers, each loading the ones
              around it the way it would on a bench.
            </Row>
          </Reveal>

          <Reveal delay={60}>
            <Row
              img="/feature-frame.jpg"
              alt="A 2020 aluminium extrusion frame with a plywood deck"
              kicker="Structure"
              title="The half that holds it up"
              flip
            >
              T-slot extrusion with a true profile, plywood that shows its laminations on the cut
              edge, sheet metal and lumber. Cut to any length, with real weight. Screws find tapped
              ends and T-nuts find slots.
            </Row>
          </Reveal>

          <Reveal delay={60}>
            <Row
              img="/feature-pc.jpg"
              alt="A gaming PC laid out with motherboard, graphics card and power supply"
              kicker="Computers"
              title="It fits here, or it does not fit"
            >
              Motherboards, processors, memory, graphics cards and supplies, with the sockets and
              slots keyed the way they are in life. DDR4 will not go in a DDR5 board, and the power
              budget is a number rather than a hope.
            </Row>
          </Reveal>
        </div>
      </section>

      {/* ---------------- checks ---------------- */}
      <section className="band tint" id="check">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">Checks</span>
              <h2>Mistakes are free here.</h2>
              <p>
                In the words you would use. This is a small form factor build being told four
                separate things, before anything was ordered.
              </p>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <figure className="shot flat">
              <img src="/feature-checks.jpg" alt="The checks panel listing four problems with a build" />
            </figure>
          </Reveal>

          <Reveal delay={110}>
            <div className="sec-head" style={{ marginTop: 72, marginBottom: 32 }}>
              <h3 className="sub-title">Try one yourself.</h3>
              <p>An LED with and without a resistor. The numbers come from the solver.</p>
            </div>
          </Reveal>
          <Reveal delay={140}><LedDemo /></Reveal>
        </div>
      </section>

      {/* ---------------- secondary features ---------------- */}
      <section className="band">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">And the rest</span>
              <h2 className="sec-title">The parts you notice later.</h2>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <div className="features">
              {SECONDARY.map((f) => (
                <div className="feature" key={f.title}>
                  <div className="ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- parts ---------------- */}
      <section className="band tint" id="parts">
        <div className="wrap">
          <div className="split wide">
            <Reveal>
              <div>
                <span className="kicker">The library</span>
                <h2 className="sec-title">One resistor. Every value.</h2>
                <p className="body">
                  The real catalog, running the real search. Parts are generated from parameters
                  rather than fixed models, so one resistor definition covers every value, tolerance
                  and package.
                </p>
                <div className="stats inline">
                  <div className="stat"><b>{stats ? stats.parts : '00'}</b><span>parts</span></div>
                  <div className="stat"><b>{stats ? stats.electronics : '00'}</b><span>electronic</span></div>
                  <div className="stat"><b>{stats ? stats.build : '00'}</b><span>structural</span></div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={80}><PartSearch /></Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- solver ---------------- */}
      <section className="band" id="solver">
        <div className="wrap split">
          <Reveal>
            <div>
              <span className="kicker">Under the hood</span>
              <h2 className="sec-title">Nothing here is an animation.</h2>
              <p className="body">
                Modified nodal analysis, the method SPICE uses. Non-linear parts are solved by
                Newton at every timestep, and capacitors and inductors use backward-Euler companion
                models. A battery sags under load because its internal resistance is modelled rather
                than assumed away.
              </p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="spec">
              <div className="head">Checked against theory</div>
              {PROOF.map(([k, v]) => (
                <div className="line" key={k}>
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="closer">
              <h2>Find out now, not when the box arrives.</h2>
              <p>Open the editor and put something together. Nothing to install, nothing to sign up for.</p>
              <Link className="cta primary" to="/app">Open the editor</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  )
}

/* ------------------------------------------------------------------ */

/** An alternating image and text row: the page's main unit. */
function Row({
  img, alt, kicker, title, children, flip,
}: {
  img: string
  alt: string
  kicker: string
  title: string
  children: React.ReactNode
  flip?: boolean
}) {
  return (
    <div className="frow" data-flip={!!flip}>
      <figure className="frow-img">
        <img src={img} alt={alt} loading="lazy" />
      </figure>
      <div className="frow-text">
        <span className="kicker">{kicker}</span>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Wordmark size={24} />
            <p>{BRAND.description}</p>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <Link to="/app">Editor</Link>
            <Link to="/projects">Projects</Link>
            <a href="#parts">Parts library</a>
            <a href="#solver">Solver</a>
          </div>
          <div className="foot-col">
            <h4>Start here</h4>
            <a href="#build">What it does</a>
            <a href="#check">Checks</a>
            <Link to="/app">Open a build</Link>
          </div>
          <div className="foot-col">
            <h4>Account</h4>
            <Link to="/signin">Sign in</Link>
            <a href={`mailto:${BRAND.support}`}>Contact</a>
          </div>
        </div>
        <div className="foot-base">
          <span>{BRAND.name} © {new Date().getFullYear()}</span>
          <span>{BRAND.domain}</span>
        </div>
      </div>
    </footer>
  )
}

/**
 * The hero: a frame and the electronics on it assembling themselves.
 *
 * A recording of the real editor rather than a live scene. A live one would
 * mean three.js, the part kernel and the catalog on a page most people scroll
 * past, which is most of a megabyte to show what a three hundred kilobyte
 * video shows at higher quality.
 *
 * Anyone who has asked for less motion gets the finished frame and no video at
 * all, and there is a button under it for people who would rather go and turn
 * the thing themselves.
 */
function ProductShot() {
  const [failed, setFailed] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(q.matches)
    const onChange = () => setReduced(q.matches)
    q.addEventListener('change', onChange)
    return () => q.removeEventListener('change', onChange)
  }, [])

  return (
    <figure className="shot stage">
      <div className="media">
      {failed || reduced ? (
        <img src="/assembly-poster.jpg" alt={`A frame built in ${BRAND.name} with a board and a display on it`} />
      ) : (
        <video
          src="/assembly.webm"
          poster="/assembly-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`A frame and its electronics being assembled in ${BRAND.name}`}
          onError={() => setFailed(true)}
        />
      )}
      </div>
      <figcaption>
        Aluminium extrusion, a board and a character display. Rendered in the editor, not a mock-up.
      </figcaption>
    </figure>
  )
}
