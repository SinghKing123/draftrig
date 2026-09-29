import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { useAuth } from '@/auth/AuthProvider'
import { Reveal } from '@/ui/Reveal'
import { PartSearch } from './demos'
import { BUILDS } from './gallery'

/*
 * The board on the front page pulls in three.js, the part catalog and the
 * solver. None of that may be part of reading the page, so it is a chunk of
 * its own that is fetched the first time the section holding it comes near the
 * viewport — and never at all for somebody who does not scroll that far.
 */
const LiveBoard = lazy(() => import('./LiveBoard'))

/** Mounts its child once, the first time it is close to being seen. */
function WhenSeen({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || seen) return
    // A screen of margin, so it is loaded and running by the time it arrives
    // rather than starting up under somebody's eyes.
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setSeen(true),
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  return (
    <div className="live-slot" ref={box}>
      {seen ? <Suspense fallback={<div className="live-wait" />}>{children}</Suspense> : <div className="live-wait" />}
    </div>
  )
}

const BUILD_CATEGORIES = ['structural', 'panel', 'fastener', 'motion']

interface Stats { parts: number; electronics: number; build: number }

/**
 * Counts read from the catalog itself, so the page can never claim more parts
 * than exist. Fetched after first paint; the catalog is a hundred kilobytes
 * and the hero should not wait for it.
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

const Tick = () => <span className="tick">✓</span>

export function Landing() {
  const stats = useCatalogStats()
  const stuck = useStuck()
  const hero = BUILDS[0]

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="site">
      <header className="site-header" data-stuck={stuck}>
        <div className="wrap">
          <Link to="/" aria-label={BRAND.name}><Wordmark size={24} /></Link>
          <nav className="site-nav">
            <a href="#builds">Builds</a>
            <a href="#parts">Parts</a>
            <a href="#simulate">Simulation</a>
            <a href="#how">How it works</a>
          </nav>
          <div className="header-actions">
            <AccountMenu compact />
            <Link className="cta primary small" to="/app">Open the editor</Link>
          </div>
        </div>
      </header>

      {/* ---------------- hero ---------------- */}

      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Build the circuit before you buy the parts.</h1>
            <p className="lead">
              Draftrig is a workbench in your browser. Lay the board out in 3D, wire it
              terminal to terminal, and switch it on — with a solver behind it that works
              out the real voltages, not an animation of them.
            </p>
            <div className="hero-actions">
              <Link className="cta primary" to="/app">Start building</Link>
              <a className="cta ghost" href="#builds">See what it makes</a>
            </div>
            <p className="hero-fine">Free, and it runs without an account.</p>
          </div>

          <figure className="hero-figure">
            <img
              src={hero.img}
              alt={`${hero.name}: ${hero.note}`}
              width={1500}
              height={1125}
              fetchPriority="high"
            />
            <figcaption className="figure-tag">
              <b>{hero.name}</b> · built in Draftrig, not rendered elsewhere
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ---------------- figures ---------------- */}

      <div className="stats">
        <div className="stat">
          <b className="num">{stats ? stats.parts : '—'}</b>
          <span>parts in the library</span>
        </div>
        <div className="stat">
          <b className="num">3D</b>
          <span>every part, to scale in millimetres</span>
        </div>
        <div className="stat">
          <b className="num">0</b>
          <span>downloads or plugins to install</span>
        </div>
        <div className="stat">
          <b>Free</b>
          <span>to design as much as you like</span>
        </div>
      </div>

      {/* ---------------- builds ---------------- */}

      <section className="band" id="builds">
        <div className="wrap">
          <Reveal>
            <div className="sec-head">
              <span className="eyebrow">Made with Draftrig</span>
              <h2>Circuits you can open and take apart.</h2>
              <p>
                Every one of these is a starter in the editor. Open it, pull a wire out,
                change a resistor and watch what it does to the rest.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="build-grid">
              {BUILDS.map((b) => (
                <a className="build-card" key={b.id} href={`/app?start=${b.id}`}>
                  <div className="pic">
                    <img src={b.img} alt={`${b.name}: ${b.note}`} loading="lazy" />
                  </div>
                  <div className="body">
                    <h3>{b.name}</h3>
                    <p>{b.note}</p>
                    <div className="meta">
                      <span className="num">{b.parts} parts</span>
                      <span className="num">{b.wires} connections</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- parts ---------------- */}

      <section className="band sand" id="parts">
        <div className="wrap">
          <div className="split flip">
            <Reveal delay={80}><PartSearch /></Reveal>
            <Reveal>
              <div>
                <span className="eyebrow">The library</span>
                <h2>One resistor. Every value.</h2>
                <p className="lead">
                  Parts are described rather than drawn, so a resistor is not a hundred
                  models — it is one part that takes a value, a tolerance and a wattage,
                  and looks like the thing you would be sent.
                </p>
                <ul className="points">
                  <li><Tick /><p>{stats ? `${stats.electronics} electronic parts` : 'Electronic parts'}: passives, semiconductors, boards, sensors and displays.</p></li>
                  <li><Tick /><p>{stats ? `${stats.build} for the structure` : 'Structural stock'}: extrusion, sheet, stock and the fasteners to join them.</p></li>
                  <li><Tick /><p>Search by value, package or part number — <span className="mono">10k</span>, <span className="mono">2020</span>, <span className="mono">NE555</span>.</p></li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- simulation ---------------- */}

      <section className="band" id="simulate">
        <div className="wrap">
          <div className="split">
            <Reveal>
              <div>
                <span className="eyebrow">It actually runs</span>
                <h2>A solver, not a cartoon.</h2>
                <p className="lead">
                  Draftrig builds a netlist from what you wired and solves it the way a
                  circuit simulator does. Put the wrong resistor in and the LED is dim
                  because the current really is lower, not because something decided it
                  should look that way.
                </p>
                <ul className="points">
                  <li><Tick /><p>Real component curves, so a diode has a forward drop and a wire has resistance.</p></li>
                  <li><Tick /><p>Microcontrollers run a program and drive their pins from it.</p></li>
                  <li><Tick /><p>Displays light up from the data actually arriving on the bus.</p></li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={80}><WhenSeen><LiveBoard /></WhenSeen></Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- bill of materials ---------------- */}

      <section className="band sand">
        <div className="wrap">
          <div className="split">
            <Reveal>
              <div>
                <span className="eyebrow">Before you order</span>
                <h2>It knows what the build costs.</h2>
                <p className="lead">
                  The BOM generator reads the bench and totals it: every part, its
                  manufacturer number where the catalog knows one, and the wire measured
                  between the terminals it actually runs between.
                </p>
                <ul className="points">
                  <li><Tick /><p>The hook-up wire counted by colour and length, which is the thing everyone forgets to order.</p></li>
                  <li><Tick /><p>Mass and cost for the whole build, updating as you change it.</p></li>
                  <li><Tick /><p>Download it as a CSV and paste it straight into an order.</p></li>
                </ul>
                <p style={{ marginTop: 26 }}>
                  <Link className="arrow-link" to="/app?start=bench-clock">Open this build <span>→</span></Link>
                </p>
              </div>
            </Reveal>
            <Reveal delay={80}>
              <figure className="shot">
                <img
                  src="/feature-bom.jpg"
                  alt="The bill of materials for the bench clock, listing parts, part numbers, wire by colour, mass and cost"
                  loading="lazy"
                />
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- how ---------------- */}

      <section className="band" id="how">
        <div className="wrap">
          <Reveal>
            <div className="sec-head centred">
              <h2>Three steps, and nothing to install.</h2>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="steps">
              <div className="step">
                <h3>Place the parts</h3>
                <p>
                  Drag them out of the library onto the bench. Everything is to scale in
                  millimetres, so what fits on screen fits on the desk.
                </p>
              </div>
              <div className="step">
                <h3>Wire it up</h3>
                <p>
                  Click a terminal, click another. Terminals are named as you hover them,
                  so you are wiring D13 to a resistor rather than one grey dot to another.
                </p>
              </div>
              <div className="step">
                <h3>Switch it on</h3>
                <p>
                  Press run. Probe any terminal to put it on the scope, read the current
                  through a part, and find the mistakes while they are still free.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- closer ---------------- */}

      <section className="band tight">
        <div className="wrap">
          <Reveal>
            <div className="closer">
              <h2>Build it twice. The first time is free.</h2>
              <p>
                Open the editor and put something together. There is nothing to install and
                no account to make, and your work saves in the browser until you want it
                somewhere else.
              </p>
              <div className="hero-actions">
                <Link className="cta onink" to="/app">Open the editor</Link>
                <a className="cta ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.28)' }} href="#builds">
                  Look at the builds again
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function Footer() {
  const accounts = useAuth().enabled
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-top">
          <div>
            <Wordmark size={22} />
            <p>{BRAND.description}</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/app">Editor</Link>
            <a href="#builds">Builds</a>
            <a href="#parts">Parts</a>
            <a href="#how">How it works</a>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <Link to="/projects">Your projects</Link>
            {/* The header's account menu already hides itself when accounts
                are off; this link did not, and was the one route left that
                led a visitor to a sign-in page that cannot sign anyone in. */}
            {accounts && <Link to="/signin">Sign in</Link>}
            <a href={`mailto:${BRAND.support}`}>Contact</a>
          </div>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <span className="grow" />
          <span>Built in the browser. No plugins, no installs.</span>
        </div>
      </div>
    </footer>
  )
}
