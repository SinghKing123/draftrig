/**
 * The page's drawing kit.
 *
 * Everything on the front page that shows the product is drawn with
 * these: a frame that maps millimetres onto a viewBox, a dimension with
 * ticks and a figure, a door swing, and hatching. No section renders an
 * image of the editor, so these are the whole of the page's visual
 * vocabulary and they are deliberately small.
 *
 * The one rule worth stating: nothing here scales a stroke. Plans are
 * drawn by mapping every millimetre coordinate into viewBox units in
 * JavaScript rather than by wrapping a group in `transform="scale()"`,
 * because a scaled group takes the stroke widths and the type with it.
 * A 4.8 m room and a 1.4 m desk would then be drawn with different
 * line weights, which is exactly backwards: the line weight belongs to
 * the drawing, not to the thing drawn.
 */

/* ------------------------------------------------------------------ */
/* Mapping millimetres onto the sheet                                  */
/* ------------------------------------------------------------------ */

export interface Frame {
  /** Plan x in millimetres to viewBox units. */
  X: (mm: number) => number
  /** Plan y in millimetres to viewBox units. */
  Y: (mm: number) => number
  /** A length in millimetres to viewBox units. */
  L: (mm: number) => number
  /** The viewBox, ready to spread onto an `<svg>`. */
  box: { viewBox: string; width: number; height: number }
}

/** Everything the drawing has to contain, in millimetres. */
export interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Fit a millimetre box into a viewBox, centred.
 *
 * It takes the bounds rather than the room, because the room is never
 * the thing that has to fit. A 3.4 m room with a dimension struck 460
 * off its left wall and a door opening measured 390 below it needs 4.3
 * metres of sheet, and a symmetric margin around the room either
 * wastes a third of the frame or clips a figure. Giving the extents
 * explicitly is the difference between a drawing that fills its plate
 * and one that floats in it.
 *
 * `flipY` is for sections, where height runs up off the floor rather
 * than down the sheet.
 */
export function fitBox(
  b: Bounds,
  { vw = 1200, vh = 660, flipY = false }: { vw?: number; vh?: number; flipY?: boolean } = {},
): Frame {
  const bw = b.x1 - b.x0
  const bh = b.y1 - b.y0
  const s = Math.min(vw / bw, vh / bh)
  const ox = (vw - bw * s) / 2
  const oy = (vh - bh * s) / 2
  return {
    X: (mm) => ox + (mm - b.x0) * s,
    Y: (mm) => (flipY ? oy + (b.y1 - mm) * s : oy + (mm - b.y0) * s),
    L: (mm) => mm * s,
    box: { viewBox: `0 0 ${vw} ${vh}`, width: vw, height: vh },
  }
}

/**
 * A leader: a line from a thing in the drawing out to a note in the
 * margin, with the short horizontal shoulder the note sits on.
 *
 * A deep room in a wide plate leaves half the sheet empty, and this is
 * what a draughtsman puts there.
 */
export function Leader({
  f,
  at,
  to,
  text,
  i = 0,
  anchor = 'end',
}: {
  f: Frame
  at: [number, number]
  to: [number, number]
  text: string
  i?: number
  anchor?: 'start' | 'end'
}) {
  const shoulder = anchor === 'end' ? -46 : 46
  const [tx, ty] = [f.X(to[0]), f.Y(to[1])]
  return (
    <g style={{ ['--i' as string]: i }}>
      <path
        className="ext"
        d={`M${f.X(at[0])} ${f.Y(at[1])} L${tx} ${ty} h${shoulder}`}
        pathLength={1}
        data-draw
      />
      <circle className="pt-live" cx={f.X(at[0])} cy={f.Y(at[1])} r={4} data-fade style={{ ['--i' as string]: i }} />
      <text
        className="tag"
        x={tx + shoulder * 1.2}
        y={ty - 12}
        fontSize={17}
        textAnchor={anchor}
        data-fade
        style={{ ['--i' as string]: i }}
      >
        {text}
      </text>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/**
 * A dimension: a line, a tick at each end, and the figure on it.
 *
 * `pathLength={1}` on the line is what lets one CSS rule draw any
 * dimension on the page without measuring a path. See `[data-draw]`.
 */
export function Dim({
  f,
  from,
  to,
  label,
  cls = 'fig',
  i = 0,
  size = 17,
  /** Push the figure off the line, in viewBox units, perpendicular. */
  off = 0,
}: {
  f: Frame
  from: [number, number]
  to: [number, number]
  label: string
  cls?: string
  i?: number
  size?: number
  off?: number
}) {
  const [x1, y1] = [f.X(from[0]), f.Y(from[1])]
  const [x2, y2] = [f.X(to[0]), f.Y(to[1])]
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  /* The tick is a short bar across the end of the line, so it runs the
     other way round from the line itself. */
  const t = 9
  const tick = (x: number, y: number) =>
    vertical ? `M${x - t} ${y} H${x + t}` : `M${x} ${y - t} V${y + t}`

  return (
    <g style={{ ['--i' as string]: i }}>
      <path className="dim" d={`M${x1} ${y1} L${x2} ${y2}`} pathLength={1} data-draw />
      <path className="dim" d={tick(x1, y1)} pathLength={1} data-draw />
      <path className="dim" d={tick(x2, y2)} pathLength={1} data-draw />
      <text
        className={cls}
        x={vertical ? mx + off : mx}
        y={vertical ? my : my + off}
        fontSize={size}
        textAnchor="middle"
        dominantBaseline="central"
        data-fade
        style={{ ['--i' as string]: i }}
      >
        {label}
      </text>
    </g>
  )
}

/**
 * A door and the floor it needs.
 *
 * Angles are degrees in plan space, which has y running down the sheet,
 * so a negative angle opens up the page. The swing is the one piece of
 * construction geometry every reader recognises on sight, and it is
 * also a thing this product genuinely works out rather than decoration
 * borrowed from drawings.
 */
export function Swing({
  f,
  h,
  len,
  a0,
  a1,
  bad = false,
  i = 0,
}: {
  f: Frame
  h: [number, number]
  len: number
  a0: number
  a1: number
  bad?: boolean
  i?: number
}) {
  const at = (deg: number): [number, number] => {
    const r = (deg * Math.PI) / 180
    return [h[0] + Math.cos(r) * len, h[1] + Math.sin(r) * len]
  }
  const p0 = at(a0)
  const p1 = at(a1)
  const r = f.L(len)
  const sweep = a1 > a0 ? 1 : 0

  return (
    <g style={{ ['--i' as string]: i }}>
      <path
        className={bad ? 'swing swing-bad' : 'swing'}
        d={`M${f.X(p0[0])} ${f.Y(p0[1])} A${r} ${r} 0 0 ${sweep} ${f.X(p1[0])} ${f.Y(p1[1])}`}
        pathLength={1}
        data-draw
      />
      <path
        className={bad ? 'leaf swing-bad' : 'leaf'}
        d={`M${f.X(h[0])} ${f.Y(h[1])} L${f.X(p1[0])} ${f.Y(p1[1])}`}
        pathLength={1}
        data-draw
      />
    </g>
  )
}

/* ------------------------------------------------------------------ */
/* Page furniture                                                      */
/* ------------------------------------------------------------------ */

/**
 * A dimension over a photograph, in frame percentages.
 *
 * The plans are drawn in millimetres because they are drawings. A
 * render is a photograph of a thing, and the only coordinates it has
 * are its own edges, so these are given as percentages of the frame
 * and stay on what they measure at every width.
 */
export function ShotDim({
  label,
  from,
  to,
  under,
}: {
  label: string
  from: [number, number]
  to: [number, number]
  under?: boolean
}) {
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
  const angle = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI
  return (
    <span className="dr-shotdim" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
      </svg>
      <span className="tick" style={{ left: `${from[0]}%`, top: `${from[1]}%`, rotate: `${angle}deg` }} />
      <span className="tick" style={{ left: `${to[0]}%`, top: `${to[1]}%`, rotate: `${angle}deg` }} />
      <span className="lab" data-under={under || undefined} style={{ left: `${mid[0]}%`, top: `${mid[1]}%` }}>
        {label}
      </span>
    </span>
  )
}

/** The construction grid. Fills its positioned parent. */
export function Grid() {
  return <div className="dr-grid" aria-hidden="true" />
}

/**
 * Construction geometry over the grid: the struck radii, swings and
 * extension lines a plan carries while it is being set out rather than
 * once it is finished. Drawn in the viewBox of a 1440 x 900 sheet and
 * sliced, so the composition holds at any width.
 */
export function Arcs() {
  return (
    <svg
      className="dr-arcs"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="1180" cy="210" r="520" strokeWidth="1" />
      <circle cx="1180" cy="210" r="330" strokeWidth="1" strokeDasharray="5 7" />
      <circle cx="170" cy="760" r="430" strokeWidth="1" strokeDasharray="5 7" />
      <path d="M300 900 L300 620 A280 280 0 0 1 580 900" strokeWidth="1" strokeDasharray="4 6" />
      <path d="M0 300 H1440 M0 640 H1440" strokeWidth="1" strokeDasharray="2 10" />
      <path d="M980 0 V900 M1290 0 V900" strokeWidth="1" strokeDasharray="2 10" />
    </svg>
  )
}

/**
 * The editor's selection box, around a word.
 *
 * Tried once on the cream page and removed, correctly: a blue rectangle
 * with handles, alone on paper, reads as a stray box. It earns its place
 * here because the page it sits on is now made of the same drawing — a
 * selection next to four real dimensions is a selection, and the badge
 * carries a measurement the editor would actually print.
 */
export function Sel({
  children,
  size,
  above,
}: {
  children: string
  size: string
  /**
   * Hang the badge above the box rather than below it.
   *
   * The editor always puts it below, and so did this until the headline
   * became two short lines: on the first of them the badge dropped
   * straight onto the cap-height of the second. Above is the same
   * gesture and the only place there is room.
   */
  above?: boolean
}) {
  return (
    <span className="dr-sel" data-above={above || undefined}>
      {children}
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <b aria-hidden="true">{size}</b>
    </span>
  )
}
