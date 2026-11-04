import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Reveal, Tally, useMedia, REDUCED } from '@/ui/motion'
import { CrewSpot } from '@/ui/CrewSpot'
import { BuildClip, Dim } from './Film'

/**
 * The top of the page: a floor, a headline standing on it, and the product
 * building itself underneath.
 *
 * The brief for this page has been the same since it was set: the category
 * convention, played straight, at the craft level of plyxl.com and
 * nootles.com. What those two have that the old version of this page did
 * not is that their first screen is a *place* — a sky with clouds in it, a
 * canvas with a cast standing on it — rather than a paragraph centred on a
 * flat colour. The characters stand in that place at different depths, and
 * the whole thing moves as you move.
 *
 * Draftrig's place is not a sky. It is the thing every drawing in this
 * product starts on: a floor, ruled in millimetres, running away to a
 * horizon. Built in CSS rather than in three.js, because the marketing
 * routes deliberately do not load a 3D engine — a rotated plane with a
 * repeating gradient on it is a real perspective projection and costs
 * nothing.
 *
 * Three things move, all from one rAF loop writing two custom properties:
 *
 *   The floor drifts towards you, slowly, so the scene is alive before the
 *   reader has done anything.
 *   The layers part on scroll, at different rates: horizon slowest, floor
 *   next, figures fastest, which is what makes it read as depth rather
 *   than as a parallax effect.
 *   The scene leans a degree or two towards the pointer, which is the
 *   cheapest way to say "this is a space you are looking into".
 *
 * All of it stops dead under prefers-reduced-motion, where the scene is a
 * still floor and nothing drifts.
 */

export function Hero({ parts, builds }: { parts: number | null; builds: number | null }) {
  const stage = useRef<HTMLDivElement | null>(null)
  const still = useMedia(REDUCED)

  useEffect(() => {
    const el = stage.current
    if (!el || still) return

    let raf = 0
    let px = 0
    let py = 0
    let tx = 0
    let ty = 0

    const onMove = (e: PointerEvent) => {
      // −1 … 1 across the viewport, from the centre.
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }

    const frame = (now: number) => {
      // Ease towards the pointer rather than tracking it: a scene that
      // snaps to the cursor reads as a gadget, one that follows it reads
      // as mass.
      px += (tx - px) * 0.055
      py += (ty - py) * 0.055
      const y = window.scrollY
      el.style.setProperty('--px', px.toFixed(4))
      el.style.setProperty('--py', py.toFixed(4))
      el.style.setProperty('--sy', String(Math.min(1, y / 700)))
      el.style.setProperty('--drift', String((now / 1000) % 60))
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(frame)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [still])

  return (
    <header className="stage" ref={stage}>
      {/* The place. Drawn, not photographed: a floor in perspective, a
          horizon, and the air above it. */}
      <div className="stage-floor" aria-hidden="true">
        <div className="stage-grid" />
      </div>
      <div className="stage-sky" aria-hidden="true" />

      <div className="lpw stage-copy">
        <h1>
          <Reveal now delay={60} as="span" className="hero-line">
            Plan it before
          </Reveal>
          <Reveal now delay={150} as="span" className="hero-line">
            you build it.
          </Reveal>
        </h1>

        <Reveal now delay={260} as="p" className="stage-sub">
          Draw your room, drop in the stuff you own, and find out what fits — before
          you buy any of it.
        </Reveal>

        <Reveal now delay={340} className="stage-cta">
          <Link className="btn btn-primary btn-lg" to="/projects">
            Start building<span className="arr" aria-hidden="true" />
          </Link>
          <a className="btn btn-ghost btn-lg" href="#builds">
            Look around first
          </a>
        </Reveal>

        <Reveal now delay={420} as="p" className="stage-facts">
          <span>
            {parts === null ? '—' : <Tally to={parts} />} things to place
          </span>
          <span>
            {builds === null ? '—' : <Tally to={builds} />} rooms to steal
          </span>
          <span>Free, no sign-up</span>
        </Reveal>
      </div>

      {/* Two of the crew, standing on the floor at different depths. They
          move at different rates, which is the whole reason there are two. */}
      <div className="stage-cast" aria-hidden="true">
        <CrewSpot who="rig" act="solder" mood="happy" size={132} look={1} bare className="cast-l" />
        <CrewSpot who="dot" act="point" mood="idle" size={116} look={1} flip bare className="cast-r" />
      </div>

      {/*
        * The product, moving, on the floor it was drawn on.
        *
        * It overlaps the hero rather than following it: the page's first
        * screen ends with the top of this panel already in it, so the
        * reader is inside the product before they have decided to scroll.
        */}
      <div className="lpw stage-piece">
        <div className="piece-frame">
          <BuildClip clip="clip-setup" alt="A desk being built in Draftrig, one part at a time" />
          {/*
            * Drawn over the picture, the way the editor draws them. These
            * are the measurements the thing in the frame actually has, and
            * they are the reason to use this instead of a drawing program,
            * so they go on the photograph rather than in a paragraph under
            * it.
            */}
          <Dim label="1600 mm" from={[17, 86]} to={[83, 86]} />
          <Dim label="740 mm" from={[88, 44]} to={[88, 88]} flip />
          <span className="chip chip-b mono">820 W · 3.6 A of a 13 A socket</span>
        </div>
      </div>
    </header>
  )
}
