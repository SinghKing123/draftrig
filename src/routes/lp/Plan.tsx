import { useEffect, useState } from 'react'
import { Dim, Leader, Swing, fitBox, type Bounds, type Frame } from './Paper'

/**
 * The hero: three real rooms, drawn live.
 *
 * This replaces a screenshot, and the reason is worth keeping. A still
 * of the editor is the weakest evidence the editor works — it is a
 * frozen frame of a moving thing, it cannot be poked, and a mock-up
 * would look identical. A plan that sets itself out in front of you,
 * shell first, then the furniture, then the dimensions, then the
 * figures, is the product doing its job at the size of a hero image
 * and in a few kilobytes of SVG.
 *
 * All three rooms are the templates the editor ships, at their real
 * dimensions, with the figures the solver returns for them. The home
 * theatre's 53 mm is the back row clearing the front headrest with the
 * riser at 300; the same number falls out of the sightline bench
 * further down the page, because it is the same arithmetic.
 */

type Kind = 'soft' | 'sel' | 'live' | 'ghost'

interface Box {
  x: number
  y: number
  w: number
  d: number
  n?: string
  k?: Kind
}

interface DimSpec {
  a: [number, number]
  b: [number, number]
  label: string
  /** Push the figure off the line, in viewBox units. */
  off?: number
}

interface Note {
  at: [number, number]
  to: [number, number]
  text: string
  anchor?: 'start' | 'end'
}

interface Room {
  id: string
  tab: string
  w: number
  d: number
  /** What the sheet has to hold: the room plus every figure off it. */
  bounds: Bounds
  boxes: Box[]
  door?: { h: [number, number]; len: number; a0: number; a1: number }
  dims: DimSpec[]
  notes?: Note[]
  reads: { k: string; v: string; live?: boolean }[]
  bar: { name: string; count: string; live: string }
  note: string
}

const CLS: Record<Kind, string> = {
  soft: 'box-soft',
  sel: 'box-sel',
  live: 'box-live',
  ghost: 'box-ghost',
}

/* ------------------------------------------------------------------ */
/* The rooms                                                           */
/* ------------------------------------------------------------------ */

/** Four seats in a row, centred on `cx`, as four boxes. */
function row(n: number, cx: number, y: number, pitch: number, w: number, d: number): Box[] {
  return Array.from({ length: n }, (_, i) => ({
    x: cx + (i - (n - 1) / 2) * pitch - w / 2,
    y,
    w,
    d,
  }))
}

const ROOMS: Room[] = [
  {
    id: 'desk',
    tab: 'Desk setup',
    w: 3400,
    d: 2600,
    bounds: { x0: -760, y0: -560, x1: 3620, y1: 3160 },
    boxes: [
      { x: 500, y: 760, w: 2000, d: 1400, k: 'soft', n: 'Rug' },
      { x: 1000, y: 0, w: 1400, d: 700, k: 'sel', n: 'Desk' },
      { x: 1130, y: 130, w: 560, d: 190 },
      { x: 1740, y: 130, w: 560, d: 190 },
      { x: 1360, y: 860, w: 680, d: 680, n: 'Chair' },
      { x: 2460, y: 120, w: 216, d: 463, n: 'PC' },
      { x: 0, y: 1200, w: 240, d: 900, n: 'Shelf' },
      { x: 2460, y: 700, w: 306, d: 52, k: 'live' },
      { x: 3386, y: 900, w: 14, d: 146, k: 'live' },
      { x: 3000, y: 2150, w: 382, d: 354, k: 'soft' },
    ],
    door: { h: [300, 2600], len: 826, a0: 0, a1: -90 },
    dims: [
      { a: [0, -430], b: [3400, -430], label: '3400' },
      { a: [1000, -150], b: [2400, -150], label: '1400' },
      { a: [-430, 0], b: [-430, 2600], label: '2600', off: -36 },
      { a: [300, 2990], b: [1126, 2990], label: '826 clear' },
    ],
    reads: [
      { k: 'Room', v: '3.4 × 2.6 m' },
      { k: 'Desk', v: '1400 × 700' },
      { k: 'Door clearance', v: '826 mm', live: true },
      { k: 'Walkway behind', v: '1060 mm', live: true },
      { k: 'Total draw', v: '820 W' },
      { k: 'On the socket', v: '3.6 A of 13' },
    ],
    bar: { name: 'Desk setup', count: '14 parts · 9 connections · 152 kg', live: '820 W · 3.6 A of a 13 A socket' },
    note: 'Every block on this drawing is a part out of the catalogue, at the size it ships.',
  },
  {
    id: 'cinema',
    tab: 'Home theatre',
    w: 4800,
    d: 6600,
    bounds: { x0: -1900, y0: -600, x1: 6300, y1: 7200 },
    boxes: [
      { x: 400, y: 4100, w: 4000, d: 2100, k: 'soft', n: 'Riser +300' },
      { x: 1070, y: 10, w: 2660, d: 40, k: 'sel', n: '120 in' },
      { x: 2180, y: 90, w: 440, d: 180 },
      { x: 520, y: 90, w: 280, d: 300 },
      { x: 4000, y: 90, w: 280, d: 300 },
      { x: 40, y: 2900, w: 230, d: 300 },
      { x: 4530, y: 2900, w: 230, d: 300 },
      { x: 40, y: 5500, w: 230, d: 300 },
      { x: 4530, y: 5500, w: 230, d: 300 },
      ...row(3, 2400, 3250, 880, 800, 900),
      ...row(4, 2400, 4750, 880, 800, 900),
      { x: 2290, y: 3340, w: 220, d: 200, k: 'ghost' },
      { x: 4240, y: 1200, w: 434, d: 396, k: 'live', n: 'AVR' },
    ],
    door: { h: [4100, 6600], len: 826, a0: 180, a1: 270 },
    dims: [
      { a: [0, -430], b: [4800, -430], label: '4800' },
      { a: [-460, 0], b: [-460, 6600], label: '6600', off: -36 },
      { a: [5260, 0], b: [5260, 3440], label: '3450 throw', off: 42 },
      { a: [1070, 7000], b: [3730, 7000], label: '2660 image' },
    ],
    notes: [
      { at: [655, 240], to: [-620, 900], text: '7 speakers, 6 Ω' },
      { at: [400, 5150], to: [-620, 4700], text: 'riser, +300' },
      { at: [2400, 3440], to: [-620, 2700], text: 'projector' },
    ],
    reads: [
      { k: 'Room', v: '4.8 × 6.6 × 2.5 m' },
      { k: 'Screen', v: '120 in, 16:9' },
      { k: 'Throw', v: '3.45 m at 1.30:1' },
      { k: 'Image brightness', v: '16 fL', live: true },
      { k: 'Back row sightline', v: 'clears by 53 mm', live: true },
      { k: 'Total draw', v: '550 W of 3.0 kW' },
      { k: 'Speakers', v: '7, 6 Ω at the amp' },
    ],
    bar: { name: 'Home theatre', count: '26 parts · 31 connections · 486 kg', live: '550 W · 2.4 A of a 13 A socket' },
    note: 'Seven seats, seven speakers and a riser. The back row clears the front headrest by 53 mm.',
  },
  {
    id: 'studio',
    tab: 'Studio',
    w: 3600,
    d: 3000,
    bounds: { x0: -760, y0: -560, x1: 3820, y1: 3560 },
    boxes: [
      { x: 700, y: 900, w: 1800, d: 1300, k: 'soft', n: 'Rug' },
      { x: 1050, y: 0, w: 1500, d: 750, k: 'sel', n: 'Desk' },
      { x: 1080, y: 90, w: 173, d: 208 },
      { x: 2347, y: 90, w: 173, d: 208 },
      { x: 1300, y: 80, w: 560, d: 190 },
      { x: 1870, y: 80, w: 560, d: 190 },
      { x: 1700, y: 320, w: 102, d: 102, k: 'live' },
      { x: 1480, y: 430, w: 500, d: 290 },
      { x: 1510, y: 900, w: 680, d: 680, n: 'Chair' },
      { x: 200, y: 0, w: 600, d: 50 },
      { x: 2800, y: 0, w: 600, d: 50 },
      { x: 0, y: 1100, w: 50, d: 600 },
      { x: 3550, y: 1100, w: 50, d: 600 },
      { x: 2950, y: 2350, w: 553, d: 460, n: 'Rack' },
      { x: 180, y: 2500, w: 382, d: 354, k: 'soft' },
    ],
    door: { h: [3600, 1200], len: 826, a0: -90, a1: -180 },
    dims: [
      { a: [0, -430], b: [3600, -430], label: '3600' },
      { a: [200, -150], b: [800, -150], label: '600' },
      { a: [-430, 0], b: [-430, 3000], label: '3000', off: -36 },
      { a: [1050, 3390], b: [2550, 3390], label: '1500 desk' },
    ],
    reads: [
      { k: 'Room', v: '3.6 × 3.0 × 2.4 m' },
      { k: 'Treatment', v: '4 panels, 1.44 m²' },
      { k: 'RT60 at 500 Hz', v: '0.38 s', live: true },
      { k: 'Monitors', v: '1.2 m apart, 60°', live: true },
      { k: 'Total draw', v: '470 W' },
      { k: 'On the socket', v: '2.0 A of 13' },
    ],
    bar: { name: 'Studio', count: '19 parts · 24 connections · 118 kg', live: '470 W · 2.0 A of a 13 A socket' },
    note: 'The panels are placed where the first reflection lands, which is a thing the room can be asked.',
  },
]

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const WALL = 110

/** A rectangle as a path, so it can carry pathLength and be drawn on. */
function rp(f: Frame, x: number, y: number, w: number, d: number): string {
  const [x0, y0, x1, y1] = [f.X(x), f.Y(y), f.X(x + w), f.Y(y + d)]
  return `M${x0} ${y0} H${x1} V${y1} H${x0} Z`
}

function Shell({ f, w, d }: { f: Frame; w: number; d: number }) {
  const inner = rp(f, 0, 0, w, d)
  const outer = rp(f, -WALL, -WALL, w + WALL * 2, d + WALL * 2)
  return (
    <>
      {/*
        * The wall thickness, poched the way a plan poches it.
        *
        * No `data-fade` on this one, and the reason is worth a line: the
        * fade animation lands on `opacity: 1`, which beat the 5% this
        * rule used to set and painted every wall as a solid black slab.
        * The tint now lives in the fill colour, where an animation on
        * opacity cannot reach it.
        */}
      <path className="hatch" d={`${outer} ${inner}`} fillRule="evenodd" />
      <path className="wall" d={outer} pathLength={1} data-draw style={{ ['--i' as string]: 0 }} />
      <path className="wall" d={inner} pathLength={1} data-draw style={{ ['--i' as string]: 1 }} />
    </>
  )
}

function Plan({ r }: { r: Room }) {
  const f = fitBox(r.bounds)
  return (
    <svg className="dr-ink" {...f.box} fill="none" role="img" aria-label={`Plan of the ${r.tab.toLowerCase()}`}>
      <Shell f={f} w={r.w} d={r.d} />

      {r.boxes.map((b, i) => {
        const bw = f.L(b.w)
        const bd = f.L(b.d)
        return (
          <g key={i} style={{ ['--i' as string]: i }} data-drop>
            <rect className={b.k ? CLS[b.k] : 'box'} x={f.X(b.x)} y={f.Y(b.y)} width={bw} height={bd} rx={2} />
            {/* A name only where there is room for one. A label wider than
                the thing it labels is a label for something else. */}
            {b.n && bw > 92 && bd > 26 && (
              <text
                className="tag"
                x={f.X(b.x) + bw / 2}
                y={f.Y(b.y) + bd / 2}
                fontSize={17}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {b.n}
              </text>
            )}
          </g>
        )
      })}

      {r.door && <Swing f={f} {...r.door} i={2} />}
      {r.dims.map((dm, i) => (
        <Dim key={dm.label} f={f} from={dm.a} to={dm.b} label={dm.label} off={dm.off} i={3 + i} />
      ))}
      {r.notes?.map((n, i) => (
        <Leader key={n.text} f={f} at={n.at} to={n.to} text={n.text} anchor={n.anchor} i={6 + i} />
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

const DWELL = 11000

/**
 * The three rooms, one at a time, with the readout beside whichever is
 * on the board.
 *
 * The plan is keyed on the room id so that choosing a tab remounts it
 * and the whole drawing replays. That is deliberate: the setting-out is
 * the content, so it should happen again for the room you asked for
 * rather than only for the one that happened to be first.
 *
 * It advances on its own, and stops advancing the moment you point at
 * it or tab into it. Something that keeps moving under a reader who has
 * started reading it is worse than something that never moved.
 */
export function Planner() {
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)

  useEffect(() => {
    if (held) return
    const t = setTimeout(() => setAt((i) => (i + 1) % ROOMS.length), DWELL)
    return () => clearTimeout(t)
  }, [at, held])

  const r = ROOMS[at]

  return (
    <div
      className="dr-plate"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="dr-plan-tabs" role="tablist" aria-label="Rooms" data-held={held || undefined}>
        {ROOMS.map((room, i) => (
          <button
            key={room.id}
            type="button"
            role="tab"
            aria-selected={i === at}
            style={{ ['--dr-dwell' as string]: `${DWELL}ms` }}
            onClick={() => setAt(i)}
          >
            {room.tab}
          </button>
        ))}
      </div>

      <div className="dr-planner">
        <div className="dr-plan-stage">
          {/* Keyed, so the drawing sets itself out again for each room. */}
          <Plan key={r.id} r={r} />
        </div>

        <div className="dr-panel">
          <div className="dr-panel-head">
            <span className="dot" aria-hidden="true" />
            {r.bar.name}
          </div>
          {r.reads.map((x) => (
            <div className="dr-read" key={x.k} data-live={x.live || undefined}>
              <span>{x.k}</span>
              <b>{x.v}</b>
            </div>
          ))}
          <p className="dr-panel-foot">{r.note}</p>
        </div>
      </div>

      <div className="dr-plate-bar">
        <strong>{r.bar.name}</strong>
        <span className="m">{r.bar.count}</span>
        <span className="spacer" />
        <span className="m m-live">{r.bar.live}</span>
      </div>
    </div>
  )
}
