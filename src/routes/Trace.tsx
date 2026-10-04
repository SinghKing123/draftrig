import { useEffect, useRef, useState } from 'react'

/**
 * The same circuit, drawn and built.
 *
 * One figure, not two sections. A manual always plates the schematic beside
 * the pictorial because they are the same object seen two ways, and that is
 * also the product's whole argument: the thing you draw and the thing that
 * runs are one document. Splitting them into a diagram section and a gallery
 * section is what would make this page a brochure again.
 *
 * The drawing is the half that can move. It waits until somebody scrolls to
 * it, traces itself in the order a person would wire it, and only once the
 * loop is closed does current start running. Everything is SVG and CSS: a
 * canvas would be a second renderer on a page already carrying video, for a
 * drawing that is four line segments.
 *
 * What is drawn matches `led.jpg` exactly — a supply, a resistor and an LED,
 * nothing else. A switch in the drawing that is not on the board beside it
 * would make the caption a lie, and the caption is the point.
 */

/** Cropped to the drawing rather than to round numbers. */
const VIEW = '52 44 548 244'

/** How long the whole trace takes, ms, and how much of it one wire gets. */
const DRAW = 1900
const STEP = DRAW / 5

type Seg = { d: string; len: number; at: number; cls: string }

/*
 * Lengths are the straight-line sums of each path, rounded up. They only have
 * to be at least the true length — a dash array longer than its path just
 * means the line is fully hidden before it draws.
 */
const SEGS: Seg[] = [
  { d: 'M 96 196 L 96 96 L 210 96', len: 220, at: 0, cls: 'live' },
  { d: 'M 282 96 L 380 96', len: 104, at: 1, cls: 'live' },
  { d: 'M 452 96 L 540 96 L 540 196', len: 196, at: 2, cls: 'live' },
  { d: 'M 540 232 L 540 262 L 96 262 L 96 232', len: 520, at: 3, cls: 'return' },
]

const PARTS = [
  { at: 0, x: 96, y: 214, kind: 'cell' as const, ref: 'B1', val: '5 V' },
  { at: 1, x: 246, y: 96, kind: 'res' as const, ref: 'R1', val: '330 Ω' },
  { at: 2, x: 416, y: 96, kind: 'led' as const, ref: 'D1', val: 'red' },
]

function Glyph({ kind }: { kind: string }) {
  switch (kind) {
    case 'cell':
      return (
        <g>
          <line x1="-17" y1="-18" x2="17" y2="-18" />
          <line x1="-9" y1="-8" x2="9" y2="-8" />
          <line x1="-17" y1="2" x2="17" y2="2" />
          <line x1="-9" y1="12" x2="9" y2="12" />
        </g>
      )
    case 'res':
      return <path d="M -36 0 L -24 0 L -19 -11 L -9 11 L 1 -11 L 11 11 L 21 -11 L 26 0 L 36 0" />
    default:
      return (
        <g>
          <path d="M -13 -14 L 13 0 L -13 14 Z" className="ink-fill" />
          <line x1="13" y1="-14" x2="13" y2="14" />
          <line x1="1" y1="-20" x2="14" y2="-33" className="ray" />
          <line x1="13" y1="-16" x2="26" y2="-29" className="ray" />
        </g>
      )
  }
}

export function Trace() {
  const root = useRef<HTMLElement>(null)
  const [on, setOn] = useState(false)

  // Starts when it is looked at, once. A circuit that has already drawn
  // itself by the time it arrives has not drawn itself at all.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return setOn(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true)
          io.disconnect()
        }
      },
      { rootMargin: '-12% 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="mn-fig" id="figure-2" ref={root} data-on={on}>
      <div className="mn-rule-head">
        <h2>Drawn and built are one document.</h2>
        <p>
          The panel on the right is a photograph of this circuit in the editor
          <span className="mn-dot" aria-hidden="true" />
          every part solved, not animated
        </p>
      </div>

      <figure className="mn-plate mn-plate-pair">
        <div className="mn-mount">
          <div className="mn-pair">
          <div className="mn-draw">
            <svg
              viewBox={VIEW}
              role="img"
              aria-label="A 5 volt supply, a 330 ohm resistor and a red LED wired in one loop"
            >
              <g className="mn-wires">
                {SEGS.map((s) => (
                  <path
                    key={s.d}
                    d={s.d}
                    className={`seg ${s.cls}`}
                    style={{
                      strokeDasharray: s.len,
                      strokeDashoffset: on ? 0 : s.len,
                      transitionDelay: `${s.at * STEP}ms`,
                      transitionDuration: `${STEP * 1.7}ms`,
                    }}
                  />
                ))}
              </g>

              {/* The current, once the loop is closed. One dash per branch, so
                  it reads as flow rather than as a marquee round a border. */}
              <g className="mn-flow">
                {SEGS.map((s, i) => (
                  <path
                    key={s.d}
                    d={s.d}
                    className="flow"
                    style={{
                      animationDelay: `${DRAW + i * 150}ms`,
                      strokeDasharray: `30 ${s.len}`,
                    }}
                  />
                ))}
              </g>

              <g className="mn-sym">
                {PARTS.map((p) => (
                  <g
                    key={p.ref}
                    transform={`translate(${p.x} ${p.y})`}
                    className="sym"
                    style={{ transitionDelay: `${p.at * STEP + STEP * 0.6}ms` }}
                  >
                    <Glyph kind={p.kind} />
                    <text
                      className="ref"
                      x={p.kind === 'cell' ? 30 : 0}
                      y={p.kind === 'cell' ? -4 : -30}
                      style={{ textAnchor: p.kind === 'cell' ? 'start' : 'middle' }}
                    >
                      {p.ref}
                    </text>
                    <text
                      className="val"
                      x={p.kind === 'cell' ? 30 : 0}
                      y={p.kind === 'cell' ? 13 : 34}
                      style={{ textAnchor: p.kind === 'cell' ? 'start' : 'middle' }}
                    >
                      {p.val}
                    </text>
                  </g>
                ))}
              </g>
            </svg>
            <span className="mn-pair-tag">Schematic</span>
          </div>

          <div className="mn-shot">
            <img
              src="/presets/led.jpg"
              alt="The same circuit built on a breadboard in the editor"
              loading="lazy"
              width={860}
              height={538}
            />
            <span className="mn-pair-tag">Pictorial</span>
            </div>
          </div>
        </div>

        <figcaption>
          <b>Fig.&nbsp;2&#8209;1</b>
          <span>One supply, one resistor, one LED — as drawn, and as built.</span>
        </figcaption>
      </figure>
    </section>
  )
}
