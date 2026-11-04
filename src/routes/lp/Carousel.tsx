import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A run of editor frames you can push through by hand.
 *
 * This replaced a set of plans that drew themselves. The plans were
 * nice and they were still line art: what belongs this high on the
 * page is the application, and enough different kinds of it that the
 * breadth is obvious without a sentence claiming breadth. So the
 * slides alternate — a rack, a matrix being wired, a desk, a cabinet —
 * and every one is the editor with its panels up.
 *
 * Built on scroll-snap rather than on transforms. The track is a real
 * scroller, so it has a trackpad, a touch drag, a scrollbar and
 * keyboard scrolling for nothing, and the arrows are a convenience
 * over the top rather than the only way through. The dots read the
 * scroll position instead of owning it, which is what keeps them
 * honest when you flick the track with a finger.
 */

interface Slide {
  src: string
  name: string
  spec: string
  mode: string
  alt: string
}

const SLIDES: Slide[] = [
  {
    src: '/shots/ui/car-1.jpg',
    name: 'Extrusion shop rack',
    spec: '116 parts',
    mode: 'Build',
    alt: 'A shop rack built from aluminium extrusion in the Draftrig editor, with the parts tree and inspector open',
  },
  {
    src: '/shots/ui/car-2.jpg',
    name: 'LED matrix',
    spec: '37 parts · 65 conn',
    mode: 'Wire',
    alt: 'An LED matrix on perfboard in Draftrig wire mode, its rows joined by coloured jumpers',
  },
  {
    src: '/shots/ui/car-3.jpg',
    name: 'Desk setup',
    spec: '12 parts · 26 conn',
    mode: 'Build',
    alt: 'A desk with monitors and a tower laid out in the Draftrig editor',
  },
  {
    src: '/shots/ui/car-4.jpg',
    name: 'Control cabinet',
    spec: '53 parts · 50 conn',
    mode: 'Wire',
    alt: 'A DIN-rail control cabinet in Draftrig wire mode with terminals joined by cable',
  },
  {
    src: '/shots/ui/car-5.jpg',
    name: 'Workbench',
    spec: '66 parts',
    mode: 'Build',
    alt: 'A workbench with a pegboard and drawers laid out in the Draftrig editor',
  },
  {
    src: '/shots/ui/car-6.jpg',
    name: 'Quadcopter',
    spec: '26 parts · 37 conn',
    mode: 'Build',
    alt: 'A quadcopter frame with motors and speed controllers in the Draftrig editor',
  },
  {
    src: '/shots/ui/car-7.jpg',
    name: 'LED message board',
    spec: '23 parts · 26 conn',
    mode: 'Build',
    alt: 'An LED message board on a stand in the Draftrig editor',
  },
  {
    src: '/shots/ui/car-8.jpg',
    name: 'Pi enclosure',
    spec: '29 parts',
    mode: 'Build',
    alt: 'A Raspberry Pi enclosure with its standoffs and lid in the Draftrig editor',
  },
]

export function Carousel() {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)

  /* The index is read off the scroll position rather than stored,
     because the track can be moved four ways and only one of them goes
     through these buttons. */
  const read = useCallback(() => {
    const el = track.current
    if (!el) return
    const slide = el.scrollWidth / SLIDES.length
    setAt(Math.round(el.scrollLeft / slide))
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        read()
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [read])

  const go = (i: number) => {
    const el = track.current
    if (!el) return
    const n = Math.max(0, Math.min(SLIDES.length - 1, i))
    el.scrollTo({ left: (el.scrollWidth / SLIDES.length) * n, behavior: 'smooth' })
  }

  return (
    <div className="dr-car">
      <div className="dr-car-track" ref={track}>
        {SLIDES.map((s, i) => (
          <figure className="dr-car-slide" key={s.src}>
            <img
              src={s.src}
              alt={s.alt}
              width={1600}
              height={1000}
              /* The first is the one on screen when the section arrives. */
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
            <figcaption className="dr-plate-bar">
              <strong>{s.name}</strong>
              <span className="m">{s.spec}</span>
              <span className="spacer" />
              <span className="m">{s.mode}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="dr-car-bar">
        <button type="button" className="dr-car-btn" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" />
          </svg>
        </button>
        <div className="dr-car-dots" role="tablist" aria-label="Screens">
          {SLIDES.map((s, i) => (
            <button
              key={s.src}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-label={s.name}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <span className="m dr-car-n">
          {String(at + 1).padStart(2, '0')} / {SLIDES.length}
        </span>
        <button
          type="button"
          className="dr-car-btn"
          onClick={() => go(at + 1)}
          disabled={at === SLIDES.length - 1}
          aria-label="Next"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3 L11 8 L6 13" />
          </svg>
        </button>
      </div>
    </div>
  )
}
