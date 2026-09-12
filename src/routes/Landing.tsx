import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { AccountMenu } from '@/ui/AccountMenu'
import { Reveal } from '@/ui/Reveal'
import { LedDemo, PartSearch } from './demos'
import { BuildCarousel, BuildStage, Turntable } from './gallery'

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

/** What the solver gets right, checked against theory. */
const PROOF: [string, string][] = [
  ['RC after one time constant', '63.2 %'],
  ['555 astable, 10k / 68k / 1 µF', 'within 15 %'],
  ['Red LED, 5 V through 220 Ω', '13 to 15 mA'],
  ['10 mH across 10 V', 'di/dt = 1000 A/s'],
  ['1 m of 24 AWG', '84 mΩ, not zero'],
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
            <a href="#builds">Builds</a>
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
          <h1>
            Build it twice.<br />The first time is free.
          </h1>
          <p className="lede">Wire it up and switch it on before you order anything.</p>
          <div className="actions">
            <Link className="cta primary" to="/app">Open the editor</Link>
            <a className="cta ghost" href="#builds">See the builds</a>
          </div>
          <p className="micro">Free. No account.</p>
        </div>
        <div className="wrap wide">
          <BuildStage />
        </div>
      </header>

      {/* ---------------- builds ---------------- */}
      <section className="band dark" id="builds">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">Builds</span>
              <h2>Open any of them.</h2>
            </div>
          </Reveal>
        </div>
        <Reveal delay={60}>
          <div className="wrap wide"><BuildCarousel /></div>
        </Reveal>
      </section>

      {/* ---------------- turntable ---------------- */}
      <section className="band dark tall">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">CNC router</span>
              <h2>Spin it.</h2>
            </div>
          </Reveal>
          <Reveal delay={60}><Turntable /></Reveal>
        </div>
      </section>

      {/* ---------------- it runs ---------------- */}
      <section className="band tint">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">Live</span>
              <h2>It runs.</h2>
            </div>
          </Reveal>
          <Reveal delay={60}><LedDemo /></Reveal>
        </div>
      </section>

      {/* ---------------- it checks ---------------- */}
      <section className="band">
        <div className="wrap">
          <Reveal>
            <div className="sec-head mid">
              <span className="kicker">Checks</span>
              <h2>It checks.</h2>
            </div>
          </Reveal>
          <Reveal delay={60}>
            <figure className="shot flat">
              <img src="/feature-checks.jpg" alt="Four problems found in a small-form-factor build" loading="lazy" />
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ---------------- parts ---------------- */}
      <section className="band tint" id="parts">
        <div className="wrap">
          <div className="split wide">
            <Reveal>
              <div>
                <span className="kicker">Library</span>
                <h2 className="sec-title">One resistor. Every value.</h2>
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
              <p className="body">Modified nodal analysis, the method SPICE uses.</p>
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
              <h2>Go and build something.</h2>
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
            <a href="#parts">Parts</a>
            <a href="#solver">Solver</a>
          </div>
          <div className="foot-col">
            <h4>Builds</h4>
            <Link to="/app?start=motion-sim">Motion rig</Link>
            <Link to="/app?start=cnc">CNC router</Link>
            <Link to="/app?start=rover">Rover</Link>
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
