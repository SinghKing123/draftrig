import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BRAND, pageTitle } from '@/brand'
import { Wordmark } from '@/ui/Logo'
import { Reveal, useMedia, useScrolled } from '@/ui/motion'
import { ModelCredits } from '@/ui/ModelCredits'
import { Arcs, Grid } from './lp/Paper'
import { Typer } from './lp/Typer'
import { LeadBench, LedBench, PowerBench, SightBench } from './lp/Bench'
import { Floor } from './lp/Floor'
import { Screens } from './lp/Screens'
import { Library } from './lp/Library'
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
 * So the page opens with the editor running — the real meshes, the real
 * three.js, loading as you arrive — and everything under it is either
 * something you can move or something you can search. The screenshots
 * that remain are half a measure wide and behind a tab strip that names
 * the workspace each one is in, which makes them an index of the
 * product rather than a slideshow of it.
 *
 * The figures agree with each other on purpose. The sightline bench,
 * given the shipped theatre's rows at 3.8 and 5.3 m and its 300 mm
 * riser, works out 53 mm of headroom, because that is the figure the
 * editor's inspector returns for the same build.
 *
 * What is deliberately absent, so it does not drift back: a kicker
 * above a heading, three equal cards of icon-heading-blurb, a gradient,
 * a testimonial, a full-measure screenshot, and any figure the editor
 * cannot produce.
 */

/*
 * Wide enough for the room to be worth its download.
 *
 * The live scene is 26.2 MB of mesh, and on a phone that is most of a
 * minute and somebody's data. Below this it is not loaded at all —
 * not deferred, not a poster with a button, not there: the component
 * never mounts, so nothing asks for a single .glb.
 *
 * A width rather than a user-agent, which is also the behaviour
 * people expect from "request desktop site": that setting widens the
 * viewport, so asking for the desktop site asks for the room with it.
 *
 * What a phone gets instead is the section below, which is the editor
 * in six real frames and the whole catalogue to search. That is the
 * same argument made out of 1.3 MB.
 */
const WIDE = '(min-width: 900px)'

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

function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.91-.88-2.91-2.84 0-.56.2-1.02.53-1.38-.04-.13-.23-.66.05-1.37 0 0 .55-.17 1.8.66a6.3 6.3 0 0 1 1.64-.22c.56 0 1.12.07 1.64.22 1.25-.84 1.8-.66 1.8-.66.28.71.1 1.24.05 1.37.33.36.53.82.53 1.38 0 1.97-1.14 2.64-2.92 2.84.3.26.56.76.56 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

export function Landing() {
  const scrolled = useScrolled()
  const wide = useMedia(WIDE)

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
          * The product itself, above the fold, loading as the page
          * does — on a screen wide enough to be worth 26.2 MB. See
          * WIDE above, and the note in `Floor`.
          */}
        {wide && (
          <div id="floor">
            <Reveal now delay={520} className="dr-w">
              <Floor />
              <p className="dr-floor-note">Drag to orbit, click a part.</p>
            </Reveal>
          </div>
        )}
      </header>

      {/* ---- the editor, screen by screen, and the box it comes with ---- */}
      <section className="dr-sec dr-sec-floor" id="screens">
        <div className="dr-w dr-two">
          <Reveal className="dr-two-l">
            <h2>Workspaces</h2>
            <Screens />
          </Reveal>
          <Reveal delay={80} className="dr-two-r">
            <h2>Library</h2>
            <Library />
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

      {/* ---- four questions you can answer yourself, here ---- */}
      <section className="dr-sec" id="asked">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Solvers</h2>
          </Reveal>

          <div className="dr-bench">
            <LeadBench />
            <PowerBench />
            <SightBench />
            <LedBench />
          </div>
        </div>
      </section>

      {/* ---- twelve frames out of the viewport ---- */}
      <section className="dr-sec dr-sec-floor" id="built">
        <div className="dr-w">
          <Reveal className="dr-sec-head">
            <h2>Viewport</h2>
          </Reveal>
          <Reveal delay={60}>
            <Gallery />
          </Reveal>
        </div>
      </section>

      {/* ---- the close ---- */}
      <section className="dr-end">
        <Grid />
        <div className="dr-w">
          <Reveal>
            <h2>Open the editor</h2>
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
            <a href="#screens">Part library</a>
          </nav>

          <nav className="dr-foot-col">
            <h3>On this page</h3>
            {wide && <a href="#floor">The live floor</a>}
            <a href="#screens">Workspaces</a>
            <a href="#asked">Solvers</a>
            <a href="#built">Viewport</a>
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
