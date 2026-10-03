import { useEffect, useRef, useState } from 'react'

/**
 * A circuit that draws itself, and then runs.
 *
 * The page is otherwise all photographs, and a photograph of a dark 3D scene
 * is a rectangle: it sits there. This is the one thing on the page that is
 * drawn rather than filmed, so it can be line art on the page's own
 * background with no edge to it, and it can move in a way a video cannot —
 * it waits until somebody scrolls to it, traces itself in the order a person
 * would build it, and only then does current start to flow.
 *
 * Everything here is SVG and CSS. A canvas would be a second renderer on a
 * page that already carries three video decoders, for a drawing that is
 * forty line segments.
 *
 * Three things move, in sequence:
 *
 *   the strokes   dash offset, so each wire draws from source to load
 *   the parts     fade and lift in behind their own wire
 *   the current   a short dash travelling the path, once the trace is done
 */

/*
 * The viewbox, cropped to the drawing rather than to round numbers.
 *
 * Coordinates below are chosen for the circuit; this is the window onto them,
 * sized to what is actually drawn — including the widest symbol, the LED's
 * rays above the line, and the labels under it.
 */
const VIEW = '58 54 688 232'

/**
 * How long the whole trace takes, ms, and how much of it one wire gets.
 *
 * Slow enough to read as drawing rather than as a wipe, fast enough that
 * somebody who scrolls past is not waiting for it. Measured by watching it:
 * under about two seconds total it reads as a glitch.
 */
const DRAW = 2200
const STEP = DRAW / 7

type Seg = {
  /** The path, and the order it draws in. */
  d: string
  /** Its own length, so the dash animation does not need measuring at runtime. */
  len: number
  at: number
  cls: string
}

/*
 * A supply, a switch, a resistor, an LED and the return.
 *
 * The smallest circuit that is still a circuit: it has a source, a thing
 * that interrupts it, a thing that limits it and a thing that shows it
 * working. Anything less is a loop of wire; anything more is a diagram.
 *
 * Lengths are the straight-line sums of each path, rounded up. They only
 * have to be at least the true length — a dash array longer than its path
 * just means the line is fully hidden before it draws.
 */
const SEGS: Seg[] = [
  { d: 'M 96 196 L 96 120 L 170 120', len: 160, at: 0, cls: 'pos' },
  { d: 'M 236 120 L 300 120', len: 70, at: 1, cls: 'pos' },
  { d: 'M 366 120 L 430 120', len: 70, at: 2, cls: 'pos' },
  { d: 'M 496 120 L 560 120 L 560 196', len: 150, at: 3, cls: 'pos' },
  { d: 'M 560 232 L 560 262 L 96 262 L 96 232', len: 540, at: 4, cls: 'neg' },
  { d: 'M 626 120 L 690 120 L 690 262 L 596 262', len: 310, at: 5, cls: 'sense' },
  { d: 'M 430 120 L 430 72 L 626 72 L 626 120', len: 290, at: 6, cls: 'sense' },
]

/** The parts, in the order they appear. Drawn as symbols, not glyphs. */
const PARTS = [
  { at: 0, x: 96, y: 214, kind: 'cell' as const, label: '5 V' },
  { at: 1, x: 203, y: 120, kind: 'switch' as const, label: 'SW' },
  { at: 2, x: 333, y: 120, kind: 'res' as const, label: '330 Ω' },
  { at: 3, x: 463, y: 120, kind: 'led' as const, label: 'LED' },
  { at: 5, x: 596, y: 120, kind: 'chip' as const, label: 'MCU' },
]

function Symbol({ kind, label }: { kind: string; label: string }) {
  switch (kind) {
    case 'cell':
      return (
        <g>
          <line x1="-16" y1="-18" x2="16" y2="-18" />
          <line x1="-9" y1="-8" x2="9" y2="-8" />
          <line x1="-16" y1="2" x2="16" y2="2" />
          <line x1="-9" y1="12" x2="9" y2="12" />
          {/* Out to the side: the return leaves straight down from here, and
              centred the label sat on top of it. */}
          <text x="-30" y="30">{label}</text>
        </g>
      )
    case 'switch':
      return (
        <g>
          <circle cx="-16" cy="0" r="3" className="fill" />
          <circle cx="16" cy="0" r="3" className="fill" />
          <line x1="-16" y1="0" x2="13" y2="-16" />
          <text x="0" y="34">{label}</text>
        </g>
      )
    case 'res':
      return (
        <g>
          <path d="M -30 0 L -20 0 L -16 -10 L -8 10 L 0 -10 L 8 10 L 16 -10 L 20 0 L 30 0" />
          <text x="0" y="30">{label}</text>
        </g>
      )
    case 'led':
      return (
        <g>
          <path d="M -12 -13 L 12 0 L -12 13 Z" className="fill" />
          <line x1="12" y1="-13" x2="12" y2="13" />
          <line x1="2" y1="-18" x2="14" y2="-30" className="ray" />
          <line x1="12" y1="-14" x2="24" y2="-26" className="ray" />
          <text x="0" y="34">{label}</text>
        </g>
      )
    default:
      return (
        <g>
          <rect x="-26" y="-20" width="52" height="40" rx="4" />
          <line x1="-26" y1="-8" x2="-34" y2="-8" />
          <line x1="-26" y1="8" x2="-34" y2="8" />
          <line x1="26" y1="-8" x2="34" y2="-8" />
          <line x1="26" y1="8" x2="34" y2="8" />
          <text x="0" y="38">{label}</text>
        </g>
      )
  }
}

export function Trace() {
  const root = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)

  // Starts when it is looked at, once. A circuit that has already drawn
  // itself by the time it arrives on screen has not drawn itself at all.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return setOn(true)
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } },
      { rootMargin: '-12% 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="trace" id="work" ref={root} data-on={on}>
      <div className="trace-head">
        <h2>Draw it, switch it on.</h2>
        <p>Every part is solved, not animated. Open the switch and the light goes out.</p>
      </div>

      <svg className="trace-art" viewBox={VIEW} role="img" aria-label="A supply, a switch, a resistor and an LED, wired into a loop">
        <g className="trace-wires">
          {SEGS.map((s) => (
            <path
              key={s.d}
              d={s.d}
              className={`seg ${s.cls}`}
              style={{
                strokeDasharray: s.len,
                strokeDashoffset: on ? 0 : s.len,
                transitionDelay: `${s.at * STEP}ms`,
                transitionDuration: `${STEP * 1.6}ms`,
              }}
            />
          ))}
        </g>

        {/* The current, once the loop is closed. One dash per branch, so it
            reads as flow rather than as a marquee going round a border. */}
        <g className="trace-flow" style={{ transitionDelay: `${DRAW}ms` }}>
          {SEGS.filter((s) => s.cls !== 'sense').map((s, i) => (
            <path
              key={s.d}
              d={s.d}
              className="flow"
              style={{ animationDelay: `${DRAW + i * 180}ms`, strokeDasharray: `26 ${s.len}` }}
            />
          ))}
        </g>

        <g className="trace-parts">
          {PARTS.map((p) => (
            <g
              key={p.label}
              transform={`translate(${p.x} ${p.y})`}
              className="part"
              style={{ transitionDelay: `${p.at * STEP + STEP * 0.5}ms` }}
            >
              <Symbol kind={p.kind} label={p.label} />
            </g>
          ))}
        </g>
      </svg>
    </section>
  )
}
