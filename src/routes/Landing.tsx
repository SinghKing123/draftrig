import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { Reveal } from '@/ui/Reveal'
import { LedDemo, PartSearch } from './demos'
import { IconBox, IconChip, IconList, IconScope, IconSpark, IconZap } from '@/ui/Icons'

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

const FEATURES = [
  {
    icon: <IconChip />,
    title: 'A real solver',
    body: 'Modified nodal analysis, the method SPICE uses. Non-linear parts solved by Newton at every timestep.',
  },
  {
    icon: <IconZap />,
    title: 'Parts that snap',
    body: 'Leads find breadboard holes. Screws find tapped ends. T-nuts find slots. Drag it close and it lands.',
  },
  {
    icon: <IconList />,
    title: 'Working displays',
    body: 'A 16x2 LCD driven over its actual HD44780 bus. Seven-segment digits with real multiplexing.',
  },
  {
    icon: <IconBox />,
    title: 'Structure as well',
    body: 'T-slot extrusion with a true profile, plywood, sheet metal and lumber, cut to any size.',
  },
  {
    icon: <IconScope />,
    title: 'Scope on any pin',
    body: 'Click a terminal to watch it. See a capacitor charge, or a rail sag when a motor starts.',
  },
  {
    icon: <IconSpark />,
    title: 'Assistant built in',
    body: 'Describe a build and get one, using only parts that exist. Every wire is checked before it is placed.',
  },
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
            <a href="#features">Features</a>
            <a href="#check">Checks</a>
            <a href="#parts">Parts</a>
            <a href="#start">Getting started</a>
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
            <span className="eyebrow">
              <em>Free</em>
              Runs in the browser. Nothing to install.
            </span>

            <h1>
              Design it, wire it,<br />
              <span className="accent">then switch it on.</span>
            </h1>

            <p className="lede">
              A 3D bench for electronics and framing. Put the whole build together, run it, and find
              out what it does before you order anything.
            </p>

            <div className="actions">
              <Link className="cta primary" to="/app">Start building</Link>
              <a className="cta ghost" href="#check">See a check</a>
            </div>

            <div className="facts">
              <span><i />No account needed</span>
              <span><i />Saves as you go</span>
              <span><i />Works offline</span>
            </div>
          </div>

          <ProductShot />
        </div>
      </header>

      {/* ---------------- features ---------------- */}
      <section className="band" id="features">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">What it does</span>
              <h2>Everything on one bench.</h2>
              <p>Circuit and structure in the same scene, running against the same physics.</p>
            </div>
          </Reveal>
          <Reveal delay={70}>
            <div className="features">
              {FEATURES.map((f) => (
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

      {/* ---------------- interactive check ---------------- */}
      <section className="band tint" id="check">
        <div className="wrap">
          <Reveal>
            <div className="sec-head">
              <span className="kicker">Try it here</span>
              <h2>An LED, with and without a resistor.</h2>
              <p>Switch between the two and watch the numbers. They come from the solver, not from a mock-up.</p>
            </div>
          </Reveal>
          <Reveal delay={70}><LedDemo /></Reveal>
        </div>
      </section>

      {/* ---------------- solver ---------------- */}
      <section className="band">
        <div className="wrap split">
          <Reveal>
            <div>
              <span className="kicker">Under the hood</span>
              <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 36px)' }}>Checked against theory.</h2>
              <p style={{ marginTop: 14, fontSize: 17, color: 'var(--ink-2)' }}>
                Capacitors and inductors use backward-Euler companion models. A battery sags under
                load because its internal resistance is modelled rather than assumed away.
              </p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="spec">
              <div className="head">Solver results</div>
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

      {/* ---------------- parts ---------------- */}
      <section className="band tint" id="parts">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">The library</span>
              <h2>Search it right now.</h2>
              <p>
                The real catalog running the real search. Parts are generated from parameters, so one
                resistor covers every value, tolerance and package.
              </p>
            </div>
          </Reveal>
          <Reveal delay={70}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}><PartSearch /></div>
          </Reveal>

          <Reveal delay={130}>
            <div className="stats" style={{ marginTop: 44 }}>
              <div className="stat"><b>{stats ? stats.parts : '00'}</b><span>parts in the library</span></div>
              <div className="stat"><b>{stats ? stats.electronics : '00'}</b><span>electronic</span></div>
              <div className="stat"><b>{stats ? stats.build : '00'}</b><span>structural</span></div>
              <div className="stat"><b>∞</b><span>variants, all parametric</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- getting started ---------------- */}
      <section className="band" id="start">
        <div className="wrap split">
          <Reveal>
            <div>
              <span className="kicker">Getting started</span>
              <h2 style={{ fontSize: 'clamp(26px, 3.2vw, 36px)' }}>Three steps.</h2>
              <p style={{ marginTop: 14, fontSize: 17, color: 'var(--ink-2)' }}>
                The editor shows you round the first time you open it, then offers finished builds you
                can take apart.
              </p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="steps">
              <Step n="1" title="Place the parts">
                Search and click. Parts snap to a 2.54 mm grid, or straight into a breadboard hole.
              </Step>
              <Step n="2" title="Wire it up">
                Click two terminals. Breadboard columns behave like breadboard columns.
              </Step>
              <Step n="3" title="Switch it on">
                Press space. Current flows, LEDs light, and anything about to fail says so.
              </Step>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <Reveal>
            <div className="closer">
              <h2>Build it twice.<br />The first time is free.</h2>
              <p>Open the editor and put something together. Nothing to install, nothing to sign up for.</p>
              <Link className="cta primary" to="/app">Start building</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <Wordmark size={22} />
            <div className="grow" />
            <Link to="/app">Editor</Link>
            <Link to="/projects">Projects</Link>
            <a href="#features">Features</a>
            <a href="#parts">Parts</a>
          </div>
          <p className="fine">
            {BRAND.name} © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <div className="n">{n}</div>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  )
}

/** Falls back to an empty frame if the screenshot has not been generated. */
function ProductShot() {
  const [failed, setFailed] = useState(false)
  return (
    <div className="shot">
      <div className="bar">
        <i /><i /><i />
        <span className="addr">{BRAND.domain}/app</span>
      </div>
      {failed ? (
        <div className="fallback">The editor</div>
      ) : (
        <img src="/hero.png" alt={`The ${BRAND.name} editor with a circuit running`} onError={() => setFailed(true)} />
      )}
    </div>
  )
}
