import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { IconBox, IconChip, IconScope, IconZap, IconList, IconFrame } from '@/ui/Icons'
const BUILD_CATEGORIES = ['structural', 'panel', 'fastener', 'motion']

interface Stats { parts: number; electronics: number; build: number }

/**
 * Real counts, read from the catalog itself so the page can never claim more
 * parts than exist — but fetched after first paint. The catalog is a hundred
 * kilobytes of part definitions and the hero should not wait for it.
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

export function Landing() {
  const stats = useCatalogStats()
  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="site">
      <nav className="site-nav">
        <div className="wrap">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Wordmark size={24} />
          </Link>
          <div className="links">
            <a className="navlink" href="#what">What it does</a>
            <a className="navlink" href="#simulation">Simulation</a>
            <a className="navlink" href="#how">How it works</a>
          </div>
          <div className="spacer" />
          <AccountMenu compact />
          <Link className="cta primary small" to="/app">Open the editor</Link>
        </div>
      </nav>

      {/* ---------------- hero ---------------- */}
      <header className="hero">
        <div className="wrap">
          <div className="inner">
            <div className="eyebrow">
              <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 9, background: 'var(--volt-dim)' }}>
                <IconZap size={10} />
              </span>
              Runs in the browser. <b>No install.</b>
            </div>

            <h1 className="headline">
              Build it twice.<br />
              <em>The first time is free.</em>
            </h1>

            <p className="subhead">
              {BRAND.description}
            </p>

            <div className="hero-actions">
              <Link className="cta primary" to="/app">Start building — no account needed</Link>
              <a className="cta ghost" href="#what">See what it does</a>
            </div>
            <p className="hero-note">Free to use. Your work saves in the browser until you make an account.</p>
          </div>

          <ProductShot />
        </div>
      </header>

      {/* ---------------- the problem ---------------- */}
      <section className="band tint">
        <div className="wrap">
          <div className="grid c2" style={{ gap: 48, alignItems: 'center' }}>
            <div>
              <div className="kicker">The problem</div>
              <h2 className="sec-title">The parts arrive. Then you find out.</h2>
              <p className="sec-sub" style={{ marginBottom: 26 }}>
                Every build has the same failure mode: you commit money to a design you have only
                checked in your head. The mistakes are cheap on screen and expensive in a box.
              </p>
              <ul className="pain">
                <li><span className="x">✕</span><span>The resistor was the wrong value, and the LED lasted about a second.</span></li>
                <li><span className="x">✕</span><span>The bracket does not line up with the extrusion, and the holes are already drilled.</span></li>
                <li><span className="x">✕</span><span>The supply sags under load and the microcontroller browns out.</span></li>
                <li><span className="x">✕</span><span>You are three parts short and the order takes another week.</span></li>
              </ul>
            </div>
            <div className="card" style={{ padding: 30 }}>
              <div className="kicker" style={{ color: 'var(--ok)' }}>The idea</div>
              <h3 style={{ fontSize: 21, lineHeight: 1.3, marginBottom: 14, fontWeight: 640 }}>
                A twin of your build, before the build.
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.68, color: 'var(--tx-2)' }}>
                Lay the whole thing out in 3D — the circuit and the frame it lives in. Power it up and
                watch what actually happens: real current, real voltage drop, real heat. Then get a
                parts list with the price at the bottom.
              </p>
              <p style={{ fontSize: 15.5, lineHeight: 1.68, color: 'var(--tx-2)', marginTop: 14 }}>
                If it fails on screen, it cost you nothing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- what it does ---------------- */}
      <section className="band" id="what">
        <div className="wrap">
          <div className="sec-head center">
            <div className="kicker">Both halves</div>
            <h2 className="sec-title">Most tools do the circuit. Or the CAD. Not both.</h2>
            <p className="sec-sub">
              A real build is wires <em>and</em> the thing holding them. Twinbench treats them as one
              document, because that is how they fail — together.
            </p>
          </div>

          <div className="grid c3">
            <Feature icon={<IconChip />} title="Electronics that behave">
              Resistors, LEDs, transistors, MOSFETs, 555s, logic, op-amps, regulators, motor drivers
              and microcontrollers. Parts load each other down exactly as they would on your bench.
            </Feature>
            <Feature icon={<IconBox />} title="Structure, not decoration">
              T-slot extrusion with a true profile, plywood that shows its laminations, sheet metal,
              lumber, brackets and fasteners — cut to any size, with honest mass.
            </Feature>
            <Feature icon={<IconZap />} title="Wires you can see working">
              Every wire is modelled as a real conductor with resistance from its length and gauge.
              Current animates along it, and an undersized run gets flagged.
            </Feature>
            <Feature icon={<IconScope />} title="An oscilloscope, built in">
              Click any terminal to probe it. Watch a capacitor charge, a 555 oscillate, or a supply
              sag when the motor kicks in.
            </Feature>
            <Feature icon={<IconList />} title="A bill of materials that adds up">
              Every part carries its own mass and price. The parts list writes itself, and tells you
              what the build weighs and what it costs before you order.
            </Feature>
            <Feature icon={<IconFrame />} title="Checks that catch real mistakes">
              LED over its current limit. Resistor past its power rating. Electrolytic in backwards.
              You get told, in words, with the part named.
            </Feature>
          </div>
        </div>
      </section>

      {/* ---------------- credibility ---------------- */}
      <section className="band tint" id="simulation">
        <div className="wrap">
          <div className="grid c2" style={{ gap: 48, alignItems: 'center' }}>
            <div>
              <div className="kicker">Under the hood</div>
              <h2 className="sec-title">It is a real solver, not an animation.</h2>
              <p className="sec-sub" style={{ marginBottom: 20 }}>
                Twinbench runs modified nodal analysis — the same method SPICE uses. Non-linear parts
                are solved by Newton-Raphson each timestep; capacitors and inductors by
                backward-Euler companion models.
              </p>
              <p className="sec-sub">
                Which means the numbers are the numbers. An RC charges to 63.2 % in exactly one time
                constant. A 555 lands within a few percent of the frequency the datasheet formula
                predicts. A battery sags under load because its internal resistance is modelled, not
                assumed away.
              </p>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontSize: 'var(--fs-sm)', color: 'var(--tx-3)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                Verified against theory
              </div>
              <Row k="RC after one time constant" v="63.2 %" />
              <Row k="555 astable, 10k / 68k / 1µF" v="within 15 % of 1.44/((R1+2R2)C)" />
              <Row k="Red LED on 5 V through 220 Ω" v="13–15 mA" />
              <Row k="Inductor across 10 V, 10 mH" v="di/dt = 1000 A/s" />
              <Row k="Wire drop, 1 m of 24 AWG" v="modelled, not ignored" last />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- how ---------------- */}
      <section className="band" id="how">
        <div className="wrap">
          <div className="grid c2" style={{ gap: 56 }}>
            <div>
              <div className="kicker">How it works</div>
              <h2 className="sec-title">Three steps, no manual.</h2>
              <p className="sec-sub">
                The editor opens empty with a few finished builds you can pull apart. That is usually
                the fastest way in.
              </p>
            </div>
            <div className="steps">
              <div className="step">
                <div className="n" />
                <div>
                  <h3>Place the parts</h3>
                  <p>
                    Search the library and click. Parts drop onto the bench and snap to a 2.54 mm
                    grid — or straight into a breadboard hole.
                  </p>
                </div>
              </div>
              <div className="step">
                <div className="n" />
                <div>
                  <h3>Wire it up</h3>
                  <p>
                    Switch to Wire mode and click two terminals. Breadboard columns behave like
                    breadboard columns; a switch's paired pins are already joined inside.
                  </p>
                </div>
              </div>
              <div className="step">
                <div className="n" />
                <div>
                  <h3>Power it on</h3>
                  <p>
                    Press space. Current flows, LEDs light, the scope traces, and anything that would
                    have let out the magic smoke says so.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- stats ---------------- */}
      <section className="band tint">
        <div className="wrap">
          <div className="stats">
            <div className="stat"><b>{stats ? stats.parts : '—'}</b><span>parts in the library</span></div>
            <div className="stat"><b>{stats ? stats.electronics : '—'}</b><span>electronic</span></div>
            <div className="stat"><b>{stats ? stats.build : '—'}</b><span>structural</span></div>
            <div className="stat"><b>∞</b><span>variants — every part is parametric</span></div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 'var(--fs-lg)', color: 'var(--tx-3)' }}>
            Parts are generated from parameters rather than fixed models, so one resistor definition
            covers every value, tolerance and package. The library grows every week.
          </p>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="band">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 className="sec-title" style={{ maxWidth: 620, margin: '0 auto 16px' }}>
            Find the mistake while it is still free.
          </h2>
          <p className="sec-sub" style={{ maxWidth: 520, margin: '0 auto 30px' }}>
            Open the editor and put something together. Nothing to install, nothing to sign up for.
          </p>
          <Link className="cta primary" to="/app">Open {BRAND.name}</Link>
        </div>
      </section>

      <footer className="site-foot">
        <div className="wrap">
          <div className="row">
            <Wordmark size={20} />
            <div style={{ flex: 1 }} />
            <Link to="/app">Editor</Link>
            <Link to="/projects">Projects</Link>
            <a href="#what">What it does</a>
          </div>
          <p style={{ marginTop: 22, fontSize: 'var(--fs-md)' }}>
            {BRAND.name} — {BRAND.tagline} · © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 18px',
        borderBottom: last ? 'none' : '1px solid var(--line)', fontSize: 'var(--fs-lg)',
      }}
    >
      <span style={{ color: 'var(--tx-2)' }}>{k}</span>
      <span style={{ color: 'var(--tx-0)', fontFamily: 'var(--mono)', fontSize: 'var(--fs-md)', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

/**
 * The hero screenshot. If the image has not been generated yet the frame still
 * renders with a placeholder, so the page never shows a broken image.
 */
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
