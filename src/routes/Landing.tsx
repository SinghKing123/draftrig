import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { Reveal } from '@/ui/Reveal'
import { LedDemo, PartSearch } from './demos'
import { IconBox, IconChip, IconList, IconScope, IconZap } from '@/ui/Icons'

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

/** Adds a hairline to the nav once the page has moved. */
function useStuck(): boolean {
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return stuck
}

export function Landing() {
  const stats = useCatalogStats()
  const stuck = useStuck()

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="site">
      <nav className="nav" data-stuck={stuck}>
        <div className="wrap">
          <Link to="/" style={{ textDecoration: 'none' }}><Wordmark size={24} /></Link>
          <div className="links">
            <a href="#what">What it does</a>
            <a href="#check">Checks</a>
            <a href="#parts">Parts</a>
            <a href="#how">How it works</a>
          </div>
          <div className="grow" />
          <AccountMenu compact />
          <Link className="cta primary small" to="/app">Open the editor</Link>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="glow" />
        <div className="wrap">
          <div className="inner">
            <div className="rise" style={{ animationDelay: '0ms' }}>
              <div className="pill">
                <span className="tag">Free</span>
                Runs in the browser. Nothing to install.
              </div>
            </div>

            <h1 className="headline rise" style={{ animationDelay: '50ms' }}>
              Build it twice.<br />
              <span className="grad">The first time is free.</span>
            </h1>

            <p className="subhead rise" style={{ animationDelay: '110ms' }}>
              Lay out the circuit and the frame together in 3D. Switch the power on and watch what
              actually happens. Find the mistakes here, where they cost nothing.
            </p>

            <div className="rise" style={{ animationDelay: '170ms' }}>
              <div className="hero-actions">
                <Link className="cta primary" to="/app">Start building</Link>
                <a className="cta ghost" href="#check">See it catch a mistake</a>
              </div>
              <div className="hero-note">
                <span><i className="dot" /> No account needed</span>
                <span><i className="dot" /> Saves as you go</span>
                <span><i className="dot" /> Works offline</span>
              </div>
            </div>
          </div>

          <div className="rise" style={{ animationDelay: '240ms' }}><ProductShot /></div>
        </div>
      </header>

      {/* ---------------- the problem ---------------- */}
      <section className="band">
        <div className="wrap">
          <Reveal>
            <div className="sec-head center">
              <span className="kicker">The problem</span>
              <h2 className="sec-title">Every build fails the same way.</h2>
              <p className="sec-sub">
                You order the parts based on a design you only checked in your head. The box arrives.
                Then you find out the resistor was wrong, the bracket does not line up, and you are
                three components short of finishing.
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="bento">
              <Tile icon={<IconChip />} title="Electronics that behave" wide>
                Resistors, LEDs, transistors, MOSFETs, 555 timers, logic, op-amps, regulators, motor
                drivers and microcontrollers. Every part loads the ones around it exactly as it would
                on your bench.
              </Tile>
              <Tile icon={<IconBox />} title="Structure, not decoration" wide>
                T-slot extrusion with a true profile. Plywood that shows its laminations on the cut
                edge. Sheet metal, lumber, brackets and fasteners, cut to any size, with real weight.
              </Tile>
              <Tile icon={<IconZap />} title="Wires that carry current">
                Each wire is a real conductor. Its resistance comes from its own length and gauge, so
                a long thin run drops voltage and gets flagged.
              </Tile>
              <Tile icon={<IconScope />} title="A scope, built in">
                Click any terminal to watch it. See a capacitor charge or a supply sag the moment a
                motor starts.
              </Tile>
              <Tile icon={<IconList />} title="Costs that add up">
                Every part carries its own weight and price, so the parts list writes itself while
                you work.
              </Tile>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- interactive check ---------------- */}
      <section className="band line" id="check">
        <div className="wrap">
          <Reveal>
            <div className="sec-head">
              <span className="kicker">Try it here</span>
              <h2 className="sec-title">This is the mistake everyone makes once.</h2>
              <p className="sec-sub">
                An LED wired straight to 5 V with nothing to limit the current. Switch between the
                two versions and watch the numbers change. These are the figures the solver produces,
                not a mock-up.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}><LedDemo /></Reveal>
        </div>
      </section>

      {/* ---------------- solver credibility ---------------- */}
      <section className="band line" id="how">
        <div className="wrap">
          <div className="bento" style={{ gap: 40 }}>
            <div style={{ gridColumn: 'span 3' }}>
              <Reveal>
                <span className="kicker">Under the hood</span>
                <h2 className="sec-title">A real solver, not an animation.</h2>
                <p className="sec-sub" style={{ marginBottom: 18 }}>
                  Twinbench runs modified nodal analysis, the same method SPICE uses. Non-linear
                  parts are solved by Newton-Raphson at every timestep. Capacitors and inductors use
                  backward-Euler companion models.
                </p>
                <p className="sec-sub">
                  So the numbers are just the numbers. A battery sags under load because its internal
                  resistance is modelled rather than assumed away.
                </p>
              </Reveal>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <Reveal delay={100}>
                <div className="proof">
                  <div className="proof-head">Checked against theory</div>
                  <Proof k="RC after one time constant" v="63.2 %" />
                  <Proof k="555 astable, 10k / 68k / 1 µF" v="within 15 %" />
                  <Proof k="Red LED, 5 V through 220 Ω" v="13 to 15 mA" />
                  <Proof k="10 mH across 10 V" v="di/dt = 1000 A/s" />
                  <Proof k="1 m of 24 AWG" v="modelled, not ignored" />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- part search ---------------- */}
      <section className="band line" id="parts">
        <div className="wrap">
          <Reveal>
            <div className="sec-head center">
              <span className="kicker">The library</span>
              <h2 className="sec-title">Search it right now.</h2>
              <p className="sec-sub">
                This is the actual catalog, running the actual search. Parts are generated from
                parameters rather than fixed models, so one resistor definition covers every value,
                tolerance and package.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}><PartSearch /></div>
          </Reveal>

          <Reveal delay={140}>
            <div className="stats" style={{ marginTop: 48 }}>
              <div className="stat"><b>{stats ? stats.parts : '00'}</b><span>parts in the library</span></div>
              <div className="stat"><b>{stats ? stats.electronics : '00'}</b><span>electronic</span></div>
              <div className="stat"><b>{stats ? stats.build : '00'}</b><span>structural</span></div>
              <div className="stat"><b>∞</b><span>variants, all parametric</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- steps ---------------- */}
      <section className="band line">
        <div className="wrap">
          <div className="bento" style={{ gap: 40 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <Reveal>
                <span className="kicker">Getting started</span>
                <h2 className="sec-title">Three steps.</h2>
                <p className="sec-sub">
                  The editor walks you round the first time you open it, then offers a few finished
                  builds you can take apart.
                </p>
              </Reveal>
            </div>
            <div style={{ gridColumn: 'span 4' }}>
              <div className="steps">
                <Reveal delay={60}>
                  <Step n="1" title="Place the parts">
                    Search the library and click. Parts land on the bench and snap to a 2.54 mm grid,
                    or straight into a breadboard hole.
                  </Step>
                </Reveal>
                <Reveal delay={120}>
                  <Step n="2" title="Wire it up">
                    Switch to Wire mode and click two terminals. Breadboard columns behave like
                    breadboard columns. A switch's paired pins are already joined inside.
                  </Step>
                </Reveal>
                <Reveal delay={180}>
                  <Step n="3" title="Switch it on">
                    Press space. Current flows, LEDs light, the scope traces, and anything about to
                    fail tells you in plain words.
                  </Step>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- closing ---------------- */}
      <section className="band">
        <div className="wrap">
          <Reveal>
            <div className="closer">
              <h2 className="sec-title" style={{ maxWidth: 560, margin: '0 auto 16px' }}>
                Find the mistake while it is still free.
              </h2>
              <p className="sec-sub" style={{ maxWidth: 480, margin: '0 auto 30px' }}>
                Open the editor and put something together. Nothing to install, nothing to sign up for.
              </p>
              <Link className="cta primary" to="/app">Start building</Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <Wordmark size={20} />
            <div style={{ flex: 1 }} />
            <Link to="/app">Editor</Link>
            <Link to="/projects">Projects</Link>
            <a href="#what">What it does</a>
          </div>
          <p className="fine">{BRAND.name}. {BRAND.tagline} © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Tile({
  icon, title, children, wide,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'tile wide' : 'tile'}>
      <div className="ico">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

function Proof({ k, v }: { k: string; v: string }) {
  return (
    <div className="proof-row">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  )
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="stepcard">
      <div className="num">{n}</div>
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
      <div className="chrome">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="addr">{BRAND.domain}/app</span>
      </div>
      {failed ? (
        <div className="shot-fallback">The editor</div>
      ) : (
        <img src="/hero.png" alt={`The ${BRAND.name} editor with a circuit running`} onError={() => setFailed(true)} />
      )}
    </div>
  )
}
