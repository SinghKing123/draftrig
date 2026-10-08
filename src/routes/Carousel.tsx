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

type Panel =
  | { kind: 'clip'; name: string }
  | { kind: 'still'; src: string; alt: string }

const PANELS: Panel[] = [
  { kind: 'clip', name: 'clip-assemble' },
  { kind: 'clip', name: 'clip-wire' },
  { kind: 'clip', name: 'clip-run' },
  { kind: 'clip', name: 'clip-builds' },
  { kind: 'still', src: '/slides/sketch.jpg', alt: 'A sketch open beside the board running it' },
  { kind: 'still', src: '/slides/bom.jpg', alt: 'The bill of materials, priced by part' },
]

const N = PANELS.length

/** How far panel `i` sits from the front, the short way round the ring. */
function offset(i: number, at: number): number {
  let d = i - at
  if (d > N / 2) d -= N
  if (d < -N / 2) d += N
  return d
}

export function Carousel() {
  const [at, setAt] = useState(0)
  const vids = useRef<(HTMLVideoElement | null)[]>([])
  const drag = useRef<{ x: number; moved: boolean } | null>(null)

  const go = useCallback((step: number) => setAt((n) => (n + step + N) % N), [])

  /* Only the panel in front plays. A deck of six all decoding at once is
     six decoders for one thing anybody is looking at. */
  useEffect(() => {
    vids.current.forEach((v, i) => {
      if (!v) return
      if (i === at) void v.play().catch(() => {})
      else v.pause()
    })
  }, [at])

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
        aria-label="What the editor does, six panels"
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
        onPointerLeave={() => {
          drag.current = null
        }}
      >
        {PANELS.map((p, i) => {
          const d = offset(i, at)
          const near = Math.abs(d) <= 1
          return (
            <div
              className="lp-car-panel"
              key={p.kind === 'clip' ? p.name : p.src}
              data-at={d === 0}
              aria-hidden={d !== 0}
              style={{ ['--d' as string]: d }}
            >
              <div className="lp-shot-bar" aria-hidden="true"><i /><i /><i /></div>
              <div className="lp-shot-body">
                {p.kind === 'clip' ? (
                  <video
                    ref={(el) => {
                      vids.current[i] = el
                    }}
                    poster={`/clips/${p.name}.jpg`}
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-hidden="true"
                  >
                    {near && <source src={`/clips/${p.name}.webm`} type="video/webm" />}
                    {near && <source src={`/clips/${p.name}.mp4`} type="video/mp4" />}
                  </video>
                ) : (
                  <img src={p.src} alt={d === 0 ? p.alt : ''} loading="lazy" />
                )}
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
              key={p.kind === 'clip' ? p.name : p.src}
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
