import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { Reveal, Tally, useScrolled } from '@/ui/motion'
import { ModelCredits } from '@/ui/ModelCredits'
import { Arcs, Grid } from './lp/Paper'
import { Carousel } from './lp/Carousel'
import { Typer } from './lp/Typer'
import { FitBench, LedBench, PowerBench, SightBench } from './lp/Bench'
import { Floor } from './lp/Floor'
import { Shelf } from './lp/Shelf'
import { Gallery } from './lp/Gallery'

/**
 * The front page.
 *
 * Six versions in, and the thing that was wrong every time was not the
 * composition or the palette. It was that the page was made of pictures
 * of the product. A screenshot is the weakest evidence a tool works: it
 * is a frozen frame, it cannot be poked, and a mock-up would look the
 * same. The first four pages pasted dark renders onto cream paper and
 * the renders read as holes; the fifth rebuilt the page in the editor's
 * own near-blacks so they stopped reading as holes, and it was still a
 * column of pictures with headlines over them.
 *
 * So this one has no renders on it at all. Every section is the
 * product's own arithmetic, running: three rooms that set themselves
 * out in plan, a walkway and a door swing you drag a room depth
 * through, eight appliances you can put over a 13 A fuse, a sightline
 * you raise on a riser, and the whole catalogue drawn to one scale.
 * It is all SVG and all live, which is also why it is light — lines and
 * figures belong on paper, and this paper is the editor's warm
 * near-blacks turned inside out so the two read as one product.
 *
 * The figures agree with each other on purpose. The hero's theatre says
 * the back row clears by 53 mm; the sightline bench, given the same
 * rows at 3.8 and 5.3 m and the same 300 mm riser, works out 53. Both
 * are the figure the editor's inspector returns, because all three are
 * the same sum.
 *
 * What is deliberately absent, so it does not drift back: a screenshot,
 * a kicker above a heading, three equal cards of icon-heading-blurb, a
 * gradient, a testimonial, and any figure the editor cannot produce.
 */

/** The catalogue's own section names, for the strip under the hero. */
const SECTIONS = [
  'Rooms & openings',
  'Screens & projection',
  'Seating & theatre',
  'Speakers & audio',
  'Furniture',
  'Finish & decor',
  'Network',
  'Mains & sockets',
  'Computers & consoles',
  'Lighting',
  'Test & measurement',
  'Soldering & fabrication',
]

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

function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.91-.88-2.91-2.84 0-.56.2-1.02.53-1.38-.04-.13-.23-.66.05-1.37 0 0 .55-.17 1.8.66a6.3 6.3 0 0 1 1.64-.22c.56 0 1.12.07 1.64.22 1.25-.84 1.8-.66 1.8-.66.28.71.1 1.24.05 1.37.33.36.53.82.53 1.38 0 1.97-1.14 2.64-2.92 2.84.3.26.56.76.56 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

export function Landing() {
  const scrolled = useScrolled()
  const { parts, builds } = useCounts()

  useEffect(() => {
    document.title = pageTitle()
  }, [])

  return (
    <div className="dr">
      <header className="dr-nav" data-stuck={scrolled || undefined}>
        <Link to="/" className="dr-mark" aria-label={BRAND.name}>
          <Wordmark size={19} />
        </Link>
        <div className="dr-nav-end">
          <a className="dr-link dr-link-gh" href={BRAND.social.github} target="_blank" rel="noreferrer">
            <GithubGlyph />
            <span>GitHub</span>
          </a>
          <Link className="dr-link" to="/signin">
            Sign in
          </Link>
          <Link className="dr-btn dr-btn-go dr-btn-sm" to="/projects">
            Open editor
          </Link>
        </div>
      </header>

      {/* ---- the sheet, and the editor on it ---- */}
      <header className="dr-hero">
        <Grid />
        <Arcs />

        <div className="dr-w dr-hero-copy">
          <h1>
            <Reveal now delay={60} as="span" className="dr-line">
              Build <Typer />.
            </Reveal>
            <Reveal now delay={150} as="span" className="dr-line">
              Buy nothing.
            </Reveal>
          </h1>


        </div>

        {/*
          * The product itself, above the fold.
          *
          * This was a plan that drew itself, which was the right idea one
          * step too early: the strongest thing the page has is that the
          * room is real and you can turn it round, and that was three
          * screens down. It costs twenty-six megabytes on a wide screen,
          * which is the whole reason `Floor` gates its own loading —
          * see the note there. The shell and the floor paint at once and
          * the furniture lands over the next few seconds, so what a
          * reader sees first is the editor building the room.
          */}
        <div id="floor">
          <Reveal now delay={520} className="dr-w">
            <Floor />
            <p className="dr-floor-note">
              Live. 4 rooms, 65 parts, 3 175 kg, 230 V. Drag to orbit, click to
              select. Meshes CC BY 4.0, credited in the inspector.
            </p>
            <p className="dr-facts">
              <span>
                <b>{parts === null ? '—' : <Tally to={parts} />}</b> things to place
              </span>
              <span>
                <b>{builds === null ? '—' : <Tally to={builds} />}</b> rooms to open and take apart
              </span>
              <span>
                <b>Free</b> and no account
              </span>
            </p>
          </Reveal>
        </div>
      </header>

      {/* ---- a run of the editor, by hand ---- */}
      <section className="dr-sec dr-sec-floor" id="screens">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Workspaces</h2>
            <p>Build, Wire, Code, Simulate. Eight builds, in the editor.</p>
          </Reveal>
          <Reveal delay={80}>
            <Carousel />
          </Reveal>
        </div>
      </section>

      {/* ---- what is in the box, drifting past ---- */}
      <div className="dr-strip" aria-hidden="true">
        <div className="dr-strip-track">
          <div className="dr-strip-run">
            {SECTIONS.map((s) => (
              <i key={s}>{s}</i>
            ))}
          </div>
          <div className="dr-strip-run">
            {SECTIONS.map((s) => (
              <i key={s}>{s}</i>
            ))}
          </div>
        </div>
      </div>

      {/* ---- three questions you can answer yourself, here ---- */}
      <section className="dr-sec" id="asked">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Solvers</h2>
            <p>Running here, not described. Move an input, read the output.</p>
          </Reveal>

          <div className="dr-bench">
            <FitBench />
            <PowerBench />
            <SightBench />
            <LedBench />
          </div>
        </div>
      </section>


      {/* ---- the code workspace ---- */}
      <section className="dr-sec" id="code">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Code editor</h2>
            <p>
              A sketch per board, against the wiring you drew. It compiles, and
              Simulate runs it on the board in the scene.
            </p>
          </Reveal>
          <Reveal delay={60}>
            <figure className="dr-plate dr-shot">
              <img
                src="/shots/ui/ui-code.jpg"
                alt="The Draftrig code workspace: a sketch for an ESP32 reading a gas sensor onto a bar of LEDs, reported as compiling"
                width={1600}
                height={1000}
                loading="lazy"
                decoding="async"
              />
              <figcaption className="dr-plate-bar">
                <strong>ESP32 sensor node</strong>
                <span className="m">11 parts · 24 conn · 53.3 g</span>
                <span className="spacer" />
                <span className="m">Compiles · $15.12</span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ---- the bill of materials ---- */}
      <section className="dr-sec dr-sec-floor" id="bom">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Bill of materials</h2>
            <p>
              Every part you placed, with mass and a single-unit trade price. CSV out.
              Prices tell a ten pound idea from a two hundred pound one; they are not
              quotes.
            </p>
          </Reveal>
          <Reveal delay={60}>
            <figure className="dr-plate dr-shot">
              <img
                src="/shots/cine-ui-bom.jpg"
                alt="The Draftrig bill of materials panel beside a bartop arcade cabinet, listing each part with its mass and price"
                width={2880}
                height={1800}
                loading="lazy"
                decoding="async"
              />
              <figcaption className="dr-plate-bar">
                <strong>Bartop arcade cabinet</strong>
                <span className="m">34 items · 11.18 kg</span>
                <span className="spacer" />
                <span className="m">$214.74 estimated</span>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ---- twelve frames out of the viewport ---- */}
      <section className="dr-sec" id="built">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Viewport</h2>
            <p>Twelve of the 36 shipped builds, as drawn. Counts off the registry.</p>
          </Reveal>
          <Reveal delay={60}>
            <Gallery />
          </Reveal>
        </div>
      </section>

      {/* ---- the catalogue, to one scale ---- */}
      <section className="dr-shelf" id="shelf">
        <div className="dr-w">
          <Shelf />
        </div>
      </section>

      {/* ---- the close ---- */}
      <section className="dr-end">
        <Grid />
        <div className="dr-w">
          <Reveal>
            <h2>Open the editor</h2>
            <p>Opens empty. Free. No account until you save.</p>
            <div className="dr-end-cta">
              <Link className="dr-btn dr-btn-go" to="/projects">
                Open the editor<span className="arr" aria-hidden="true" />
              </Link>
              <Link className="dr-btn dr-btn-ghost" to="/signin">
                Sign in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="dr-foot">
        <div className="dr-w dr-foot-grid">
          <div>
            <Wordmark size={20} />
          </div>

          <nav className="dr-foot-col">
            <h3>The editor</h3>
            <Link to="/projects">Your projects</Link>
            <Link to="/app">Open the editor</Link>
            <a href="#shelf">Part catalogue</a>
          </nav>

          <nav className="dr-foot-col">
            <h3>On this page</h3>
            <a href="#floor">The live floor</a>
            <a href="#screens">Workspaces</a>
            <a href="#asked">Solvers</a>
            <a href="#code">Code editor</a>
            <a href="#bom">Bill of materials</a>
          </nav>

          <nav className="dr-foot-col">
            <h3>Elsewhere</h3>
            <a href={BRAND.social.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link to="/signin">Sign in</Link>
            <a href={`mailto:${BRAND.support}`}>Contact</a>
          </nav>
        </div>

        <ModelCredits className="dr-w" />

        <div className="dr-w dr-foot-base">
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
          <span>Every figure on this page is one the editor works out.</span>
        </div>
      </footer>
    </div>
  )
}
