import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The product panel, as a stack you cycle through.
 *
 * One thing per panel, and the two either side of it sitting smaller and
 * behind, so it reads as a deck rather than a slideshow. No labels and no
 * tabs: the panels are pictures of a tool doing something, and a caption
 * explaining each one is a caption nobody reads.
 *
 * Moved by the arrows, the dots, a drag, or the left and right keys once
 * the deck has focus. Keys are bound to the element rather than the window
 * because the arrow keys belong to the page until somebody has said they
 * are working with this.
 *
 * Only three panels are ever loaded — the one in front and its neighbours —
 * and only the one in front is decoded. The rest are a poster each until
 * their turn comes round.
 */

interface Panel {
  src: string
  alt: string
}

/*
 * Six pictures of the same size, in one order.
 *
 * It used to be four video clips at 1280x720 mixed with screenshots and
 * preset renders at 16:10, so every press changed the shape of the thing
 * being looked at, and a clip that opened on an empty bench opened the page
 * on a black panel. These are one set shot together by
 * tools/shoot-slides.mjs: 1728 by 1080, every one.
 *
 * The room leads. The deck is the first thing anyone sees and it was all
 * boards, which is the half of the editor every competitor also does.
 */
const PANELS: Panel[] = [
  { src: '/slides/setup.jpg', alt: 'A desk with two monitors, a tower and a heater, wired to one socket' },
  { src: '/slides/sign.jpg', alt: 'An LED sign of forty-eight matrix modules, lit' },
  { src: '/slides/board.jpg', alt: 'An eight-bit machine across four breadboards' },
  { src: '/slides/editor.jpg', alt: 'The editor, with the build list open and a monitor selected' },
  { src: '/slides/rack.jpg', alt: 'A shop rack in aluminium extrusion' },
  { src: '/slides/bom.jpg', alt: 'The bill of materials, priced by part' },
]

const N = PANELS.length

/** How long a panel holds the front before the deck moves on. */
const DWELL = 4200

/** How far panel `i` sits from the front, the short way round the ring. */
function offset(i: number, at: number): number {
  let d = i - at
  if (d > N / 2) d -= N
  if (d < -N / 2) d += N
  return d
}

export function Carousel() {
  const [at, setAt] = useState(0)
  const drag = useRef<{ x: number; moved: boolean } | null>(null)

  /*
   * True while somebody is looking at this one on purpose.
   *
   * The deck moves itself along, which is fine until it takes a bill of
   * materials off the screen while it is being read. Pointing at it or
   * tabbing into it holds it until they leave.
   */
  const hold = useRef(false)

  const go = useCallback((step: number) => setAt((n) => (n + step + N) % N), [])

  /*
   * A picture has no end of its own, so it is given one.
   *
   * Counted down rather than set once, so that holding the deck pauses the
   * dwell instead of only deferring the jump that was already scheduled.
   */
  useEffect(() => {
    let left = DWELL
    const id = window.setInterval(() => {
      if (hold.current) return
      left -= 250
      if (left <= 0) {
        window.clearInterval(id)
        go(1)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [at, go])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(1)
    }
  }

  return (
    <div className="lp-car">
      <div
        className="lp-car-stage"
        tabIndex={0}
        role="group"
        aria-label="What the editor does, six pictures"
        onKeyDown={onKey}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d || d.moved) return
          const dx = e.clientX - d.x
          if (Math.abs(dx) > 48) {
            d.moved = true
            go(dx < 0 ? 1 : -1)
          }
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerEnter={() => {
          hold.current = true
        }}
        onPointerLeave={() => {
          drag.current = null
          hold.current = false
        }}
        onFocus={() => {
          hold.current = true
        }}
        onBlur={() => {
          hold.current = false
        }}
      >
        {PANELS.map((p, i) => {
          const d = offset(i, at)
          const near = Math.abs(d) <= 1
          return (
            <div
              className="lp-car-panel"
              key={p.src}
              data-at={d === 0}
              aria-hidden={d !== 0}
              style={{ ['--d' as string]: d }}
            >
              <div className="lp-shot-bar" aria-hidden="true"><i /><i /><i /></div>
              <div className="lp-shot-body">
                <img
                  src={p.src}
                  alt={d === 0 ? p.alt : ''}
                  width={1728}
                  height={1080}
                  loading={near ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="lp-car-nav">
        <button className="lp-car-arrow" onClick={() => go(-1)} aria-label="Previous panel">
          ‹
        </button>
        <div className="lp-car-dots">
          {PANELS.map((p, i) => (
            <button
              key={p.src}
              data-on={i === at}
              onClick={() => setAt(i)}
              aria-label={`Panel ${i + 1} of ${N}`}
              aria-current={i === at}
            />
          ))}
        </div>
        <button className="lp-car-arrow" onClick={() => go(1)} aria-label="Next panel">
          ›
        </button>
      </div>
    </div>
  )
}
