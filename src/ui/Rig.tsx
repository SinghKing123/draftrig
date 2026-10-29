/**
 * The crew, who are made of the things in the catalogue.
 *
 * A mascot for an engineering editor has one obvious trap, which is to be a
 * friendly animal holding a spanner — a character borrowed from somewhere
 * else and handed a prop so you know what the product is. These are built
 * the other way round: every piece of every one of them is a part the editor
 * actually has.
 *
 * There are four, and the rule that makes them different is the rule that
 * made the first one. The catalogue has four kinds of thing that light up
 * and four kinds of thing to build a body from, so:
 *
 *   Rig      8x10 LED matrix        amber    20x20 extrusion, one column
 *   Dot      128x64 OLED            white    a moulded enclosure, round
 *   Sixteen  16x2 character LCD     green    perfboard on a single post
 *   Seg      4-digit seven-segment  red      a breadboard, lying flat
 *
 * Which means each one's face works the way its own display works. The
 * matrix is a bitmap of lit dots. The OLED is a graphic panel, so it draws
 * shapes. The character panel can only put a character in a cell, so its
 * face is cells. The seven-segment can only light seven bars per digit, so
 * its eyes are digits. And each lights in the colour that part really
 * emits — none of which is a free choice.
 *
 * They do not share a skeleton. That was the first version and it was the
 * problem: one body with four heads bolted on reads as one robot wearing
 * four hats. So each has its own silhouette, and you can tell them apart
 * from across a room with the faces switched off:
 *
 *   Rig      tall and square, a column on a screwed-down plate
 *   Dot      small and round, a puck on two stubby legs, with an antenna
 *   Sixteen  lanky, a wide panel on a thin post over a weighted disc
 *   Seg      low and wide, four legs like a bench
 *
 * The arms are the one thing they share, because what a pair of hands is
 * doing has to read the same on all of them. Each body says where its
 * shoulders are and how far its arms reach, and the poses are fitted into
 * that rather than drawn four times.
 *
 * They are drawn at 120 x 150 and scale from there. There is no PNG: at a
 * tenth the size of one they can be recoloured, re-expressed and animated,
 * and they stay sharp on a display nobody has shipped yet.
 */

export type Model = 'rig' | 'dot' | 'sixteen' | 'seg'

/* ================================================================== */
/* Faces                                                              */
/* ================================================================== */

/** A lit dot, as [column, row] on the matrix's own grid. */
type Dot = [number, number]

const COLS = 10
const ROWS = 8

/**
 * Two square eyes, which is as much face as 80 dots will carry.
 *
 * `dx` slides them along the row. It is how one of them looks at
 * something: the pair moves, the mouth does not, which reads as a glance
 * rather than as the whole head turning.
 */
const eyes = (row: number, dx = 0): Dot[] => [
  [2 + dx, row], [3 + dx, row], [2 + dx, row + 1], [3 + dx, row + 1],
  [6 + dx, row], [7 + dx, row], [6 + dx, row + 1], [7 + dx, row + 1],
]

/**
 * The expressions.
 *
 * Shut is the blink, and it is a single row rather than an empty grid: a
 * matrix with nothing lit reads as switched off, not as blinking.
 */
const FACES: Record<string, (dx: number) => Dot[]> = {
  idle: (dx) => [...eyes(2, dx), [3, 5], [4, 6], [5, 6], [6, 5]],
  shut: (dx) => [[2 + dx, 3], [3 + dx, 3], [6 + dx, 3], [7 + dx, 3], [3, 5], [4, 6], [5, 6], [6, 5]],
  happy: (dx) => [...eyes(2, dx), [2, 5], [7, 5], [3, 6], [4, 6], [5, 6], [6, 6]],
  think: (dx) => [...eyes(2, dx), [5, 6], [6, 6], [7, 6]],
  oops: (dx) => [...eyes(2, dx), [3, 6], [4, 5], [5, 5], [6, 6]],
  scan: (dx) => [...eyes(2, dx)],
}

export type Mood = keyof typeof FACES

/* ================================================================== */
/* Hands                                                              */
/* ================================================================== */

/**
 * What they are doing with their hands.
 *
 * A mascot that stands with its arms down in every placement is a sticker
 * repeated, and reads as the same drawing pasted four times. Each of these
 * is a different pair of arms and a real object out of the catalogue, so
 * the section one of them stands in is the thing they are working on.
 *
 * Authored once, around a shoulder line at y = 77. Each body maps that onto
 * its own shoulders — see `SPECS[...].arm`.
 */
export type Act = 'idle' | 'solder' | 'game' | 'plug' | 'wrench' | 'carry' | 'point'

const CABLE = '#33302B'
const ARM_W = 4.4

/** A 2.54 mm header on the end of a lead, which is how the arms terminate. */
const Header = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect x={x} y={y} width="12" height="8" rx="1.8" fill="#1E6FFF" />
    <rect x={x + 2.4} y={y + 7} width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
    <rect x={x + 7.8} y={y + 7} width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
  </>
)

const ARMS: Record<Act, () => JSX.Element> = {
  /* Hanging. The only pose where the arms sway with the breathing. */
  idle: () => (
    <>
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={9} y={107} />
      </g>
      <g className="rig-arm rig-arm-r">
        <path d="M92 77 C 105 85, 109 97, 105 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={99} y={107} />
      </g>
    </>
  ),

  /*
   * An iron in the right hand, a board in the left, and the tip where the
   * two meet. The smoke is three puffs on one offset loop, which is enough
   * to read as rising without drawing a plume.
   */
  solder: () => (
    <>
      <g>
        <path d="M28 77 C 18 86, 20 97, 32 100" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <rect x="24" y="97" width="26" height="17" rx="2" fill="#1C7A4B" />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={28.5 + i * 4.3} cy={101.5} r="1" fill="#0E4A2C" />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={`b${i}`} cx={28.5 + i * 4.3} cy={108.5} r="1" fill="#0E4A2C" />
        ))}
      </g>
      <g>
        <path d="M92 77 C 98 86, 86 94, 72 96" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <g transform="rotate(-22 60 100)">
          <rect x="58" y="95.5" width="22" height="9" rx="3.5" fill="#B4452F" />
          <rect x="52" y="97.5" width="8" height="5" rx="1.5" fill="#8A8E96" />
          <path d="M52 100 L44 100" stroke="#C7CAD1" strokeWidth="3" strokeLinecap="round" />
          <circle className="rig-tip" cx="43" cy="100" r="2.6" fill="#FFB020" />
        </g>
      </g>
      <g className="rig-smoke" aria-hidden="true">
        <circle cx="45" cy="99" r="2.4" />
        <circle cx="48" cy="93" r="2" />
        <circle cx="45.5" cy="87" r="1.6" />
      </g>
    </>
  ),

  /*
   * Both hands forward on a pad. The thumbs are the only moving part, which
   * is the whole tell: a controller held still is a controller being held,
   * not one being used.
   */
  game: () => (
    <>
      <path d="M28 77 C 22 86, 30 93, 42 95" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
      <path d="M92 77 C 98 86, 90 93, 78 95" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
      <g>
        <path
          d="M44 92 h32 a7 7 0 0 1 7 7 v3 a6 6 0 0 1 -10 4.4 l-4 -3.4 h-18 l-4 3.4 a6 6 0 0 1 -10 -4.4 v-3 a7 7 0 0 1 7 -7 z"
          fill="#2E2B27"
        />
        <rect x="45.5" y="96.5" width="7.5" height="2.4" rx="1.2" fill="#8E8A82" />
        <rect x="48.4" y="93.6" width="2.4" height="8.2" rx="1.2" fill="#8E8A82" />
        <circle className="rig-btn-a" cx="70" cy="96.5" r="2" fill="#1E6FFF" />
        <circle className="rig-btn-b" cx="75" cy="100" r="2" fill="#FFB020" />
      </g>
    </>
  ),

  /* A plug on a short lead, held out. */
  plug: () => (
    <>
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={9} y={107} />
      </g>
      <g>
        <path d="M92 77 C 102 84, 104 94, 99 101" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <rect x="90" y="99" width="19" height="15" rx="3" fill="#F2EFE9" stroke="#C9C4BA" strokeWidth="1.2" />
        <rect x="95" y="94" width="3.4" height="6" rx="1" fill="#8E8A82" />
        <rect x="101" y="94" width="3.4" height="6" rx="1" fill="#8E8A82" />
        <rect x="97.6" y="104" width="4" height="7" rx="1" fill="#8E8A82" />
      </g>
    </>
  ),

  /*
   * Carrying a length of extrusion on one shoulder.
   *
   * The one pose that implies they were somewhere else a moment ago, which
   * is what stops a page of them reading as statues. The rail oversails on
   * both sides, because a figure carrying a two-metre section is the joke
   * of a two-metre section, not of a figure.
   */
  carry: () => (
    <>
      <g className="rig-haul">
        <path d="M28 77 C 20 84, 24 90, 34 90" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <path d="M92 77 C 98 83, 92 88, 80 88" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <g transform="rotate(-7 60 84)">
          <rect x="4" y="79" width="112" height="11" rx="2" fill="#B9BDC4" />
          <rect x="8" y="83" width="104" height="3.4" rx="1.7" fill="#8D929A" />
          <rect x="8" y="80.4" width="104" height="1.4" rx="0.7" fill="#D8DBE0" />
        </g>
      </g>
      <g className="rig-arm rig-arm-l">
        <path d="M30 92 C 22 100, 20 108, 23 116" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={17} y={114} />
      </g>
    </>
  ),

  /*
   * Pointing at whatever is beside them.
   *
   * Placed against a heading this reads as presenting it. The raised arm is
   * the only thing that moves, and barely — a mascot that waves is a mascot
   * asking for attention, and this one is giving it to something else.
   */
  point: () => (
    <>
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={9} y={107} />
      </g>
      <g className="rig-point">
        <path d="M92 77 C 104 74, 112 66, 114 56" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <circle cx="114.5" cy="53" r="4.4" fill="#1E6FFF" />
      </g>
    </>
  ),

  /* A spanner on a T-nut, rocking a few degrees: tightening, not waving. */
  wrench: () => (
    <>
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={9} y={107} />
      </g>
      <g className="rig-turn">
        <path d="M92 77 C 99 84, 98 93, 94 98" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <g fill="#AFB4BC">
          <rect x="84" y="96.4" width="21" height="5.2" rx="2.6" />
          <path d="M104 94 h8 v3.2 h-5 v4.6 h5 v3.2 h-8 a5.5 5.5 0 0 1 0 -11 z" />
        </g>
      </g>
    </>
  ),
}

/* ================================================================== */
/* Heads                                                              */
/* ================================================================== */

/* ---- Rig: an 8x10 matrix, so the face is a bitmap ---- */

const DOT_X = 31.2
const DOT_Y = 14.6
const PITCH = 6.4
const DOT_R = 2.1

function MatrixHead({ mood, look, blink }: { mood: Mood; look: number; blink: boolean }) {
  const lit = new Set(FACES[mood](look).map(([c, r]) => `${c},${r}`))
  const shut = FACES.shut(look).map(([c, r]) => `${c},${r}`)

  const dots = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`
      const on = lit.has(key)
      const offOnBlink = blink && on && !shut.includes(key)
      const onAtBlink = blink && !on && shut.includes(key)
      dots.push(
        <circle
          key={key}
          cx={DOT_X + c * PITCH}
          cy={DOT_Y + r * PITCH}
          r={on ? DOT_R : DOT_R - 0.5}
          className={
            on
              ? offOnBlink ? 'rig-dot on rig-wink' : 'rig-dot on'
              : onAtBlink ? 'rig-dot rig-blink' : 'rig-dot'
          }
        />,
      )
    }
  }

  return (
    <>
      <rect x="20" y="8" width="80" height="58" rx="8" fill="#191714" />
      <rect x="20.8" y="8.8" width="78.4" height="56.4" rx="7.2" stroke="#36332D" strokeWidth="1.6" />
      <rect x="25" y="13" width="70" height="48" rx="4.5" fill="#0E0D0B" />
      <g filter="url(#rig-glow)">{dots}</g>
      {/* The scan bar is drawn rather than lit, because it crosses dots that
          are off and a dot cannot be half on. */}
      {mood === 'scan' && (
        <rect className="rig-scan" x="29" y="46" width="9" height="12" rx="2" fill="var(--rig-lit)" />
      )}
      <circle cx="25.5" cy="62.5" r="1.7" fill="#3C3932" />
      <circle cx="94.5" cy="62.5" r="1.7" fill="#3C3932" />
    </>
  )
}

/* ---- Dot: a graphic panel, so the face is drawn shapes ---- */

function dotFeatures(mood: Mood, look: number, shut: boolean) {
  const x = look * 3
  const lit = 'var(--rig-lit)'
  if (shut) {
    return (
      <>
        <rect x={40 + x} y={60} width="10" height="2.8" rx="1.4" fill={lit} />
        <rect x={66 + x} y={60} width="10" height="2.8" rx="1.4" fill={lit} />
      </>
    )
  }
  const eye =
    mood === 'happy' ? (
      <>
        <path d={`M${40 + x} 62 q5 -8 10 0`} stroke={lit} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d={`M${66 + x} 62 q5 -8 10 0`} stroke={lit} strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ) : mood === 'oops' ? (
      <>
        <circle cx={45 + x} cy={59} r="4" fill={lit} />
        <circle cx={71 + x} cy={59} r="4" fill={lit} />
      </>
    ) : mood === 'think' ? (
      <>
        <rect x={40 + x} y={54} width="10" height="10" rx="3.6" fill={lit} />
        <rect x={66 + x} y={59} width="10" height="3.6" rx="1.8" fill={lit} />
      </>
    ) : (
      <>
        <rect x={40 + x} y={53} width="10" height="13" rx="4.4" fill={lit} />
        <rect x={66 + x} y={53} width="10" height="13" rx="4.4" fill={lit} />
      </>
    )

  const mouth =
    mood === 'happy' ? 'M50 72 q10 7 20 0' :
    mood === 'oops' ? 'M50 74 q5 -5 10 0 q5 5 10 0' :
    mood === 'think' ? 'M56 73 h13' :
    'M52 72 q8 4 16 0'

  return (
    <>
      {eye}
      <path d={mouth} stroke={lit} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  )
}

/* ---- Sixteen: thirty-two character cells, and nothing else ---- */

const CELL_W = 3.6
const CELL_H = 8
const CELL_X = 22
const CELL_Y = 20
const CELL_GAP = 0.9

function Cell({ c, r }: { c: number; r: number }) {
  return (
    <rect
      x={CELL_X + c * (CELL_W + CELL_GAP)}
      y={CELL_Y + r * (CELL_H + 3.4)}
      width={CELL_W}
      height={CELL_H}
      rx="0.5"
      fill="var(--rig-lit)"
    />
  )
}

function sixteenCells(mood: Mood, look: number, shut: boolean): [number, number][] {
  const d = look * 2
  const pair: [number, number][] = [[4 + d, 0], [5 + d, 0], [10 + d, 0], [11 + d, 0]]
  if (shut) return pair
  const mouth: Record<string, [number, number][]> = {
    idle: [[6, 1], [7, 1], [8, 1], [9, 1]],
    happy: [[4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1]],
    think: [[9, 1], [10, 1]],
    oops: [[6, 1], [9, 1]],
    scan: [[7, 1], [8, 1]],
    shut: [[6, 1], [7, 1], [8, 1], [9, 1]],
  }
  return [...pair, ...(mouth[mood] ?? mouth.idle)]
}

/* ---- Seg: seven bars a digit, so the eyes are digits ---- */

const SEG_D: Record<string, { x: number; y: number; w: number; h: number }> = {
  a: { x: 2, y: 0, w: 9, h: 2.2 },
  b: { x: 10.8, y: 1.2, w: 2.2, h: 9 },
  c: { x: 10.8, y: 11.4, w: 2.2, h: 9 },
  d: { x: 2, y: 19.6, w: 9, h: 2.2 },
  e: { x: 0, y: 11.4, w: 2.2, h: 9 },
  f: { x: 0, y: 1.2, w: 2.2, h: 9 },
  g: { x: 2, y: 9.8, w: 9, h: 2.2 },
}

/** Which bars each expression lights, per eye. */
const SEG_FACE: Record<string, string> = {
  idle: 'abcdef',
  happy: 'cde',
  think: 'abfg',
  oops: 'abcdefg',
  scan: 'ad',
  shut: 'g',
}

function Digit({ x, y, on }: { x: number; y: number; on: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Object.entries(SEG_D).map(([k, r]) => (
        <rect
          key={k}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx="0.9"
          fill="var(--rig-lit)"
          opacity={on.includes(k) ? 1 : 0.1}
        />
      ))}
    </g>
  )
}

/* ================================================================== */
/* The four bodies                                                     */
/* ================================================================== */

/**
 * One of them, as geometry.
 *
 * `arm` is how the shared poses are fitted. The art is authored around a
 * shoulder line at y = 77, so `y` says where this body's shoulders really
 * are and `s` scales the reach. Sixteen's arms are long because Sixteen is
 * lanky; Seg's are short because Seg stands a hand off the ground and
 * longer ones would go through the floor.
 */
interface Spec {
  name: string
  /** For the alternative text. */
  head: string
  /** What this one's display emits. */
  lit: string
  arm: { y: number; s: number }
  Base: () => JSX.Element
  Body: () => JSX.Element
  Head: (p: { mood: Mood; look: number; blink: boolean }) => JSX.Element
}

const SPECS: Record<Model, Spec> = {
  /*
   * Rig. Tall and square: one column of 20x20 extrusion with the T-slot to
   * the front, a cross-bar for shoulders, and a plate with two screws in
   * it. The only one of the four whose outline is all right angles.
   */
  rig: {
    name: 'Rig',
    head: 'a dot-matrix face',
    lit: '#FFB020',
    arm: { y: 77, s: 1 },
    Base: () => (
      <>
        <ellipse className="rig-shadow" cx="60" cy="145" rx="31" ry="4.2" />
        <rect x="32" y="134" width="56" height="8" rx="2.5" fill="#2B2822" />
        <circle cx="39" cy="138" r="1.6" fill="#6E6A62" />
        <circle cx="81" cy="138" r="1.6" fill="#6E6A62" />
        <rect x="47" y="124" width="9" height="11" rx="1.5" fill="#787D85" />
        <rect x="64" y="124" width="9" height="11" rx="1.5" fill="#787D85" />
      </>
    ),
    Body: () => (
      <>
        <g className="rig-body">
          <rect x="44" y="79" width="32" height="47" rx="3" fill="url(#rig-alu)" />
          {/* The slot, and the two lips that make it read as one rather than
              as a dark stripe. */}
          <rect x="55" y="83" width="10" height="39" rx="1.6" fill="#60656D" />
          <rect x="57.4" y="85.5" width="5.2" height="34" rx="1" fill="#44484F" />
          <rect x="46.5" y="83" width="2" height="39" rx="1" fill="#E4E6EA" opacity="0.5" />
          <rect x="71.5" y="83" width="2" height="39" rx="1" fill="#71757D" opacity="0.6" />
          <circle className="rig-led" cx="60" cy="115" r="2.3" fill="#1E6FFF" />
        </g>
        <rect x="24" y="70" width="72" height="11" rx="3" fill="url(#rig-alu-bar)" />
        <rect x="27" y="74" width="66" height="2.4" rx="1.2" fill="#73777F" opacity="0.65" />
        <rect x="54" y="60" width="12" height="13" rx="2" fill="#7E838B" />
      </>
    ),
    Head: MatrixHead,
  },

  /*
   * Dot. Small and round, close to the ground: a moulded case on two stubby
   * legs, with a stalk antenna. Nothing on this one is a right angle, which
   * is the whole point of it standing next to Rig.
   */
  dot: {
    name: 'Dot',
    head: 'a small OLED face',
    lit: '#E8F4FF',
    arm: { y: 93, s: 0.78 },
    Base: () => (
      <>
        <ellipse className="rig-shadow" cx="60" cy="146" rx="27" ry="4" />
        <rect x="40" y="122" width="14" height="20" rx="7" fill="#2A2E35" />
        <rect x="66" y="122" width="14" height="20" rx="7" fill="#2A2E35" />
        <ellipse cx="47" cy="143" rx="9" ry="3.4" fill="#1C1F24" />
        <ellipse cx="73" cy="143" rx="9" ry="3.4" fill="#1C1F24" />
      </>
    ),
    Body: () => (
      <g className="rig-body">
        {/* Two halves of a moulded case, with the seam where the tool parts
            and a vent on the lower one. */}
        <rect x="29" y="82" width="62" height="44" rx="19" fill="#343941" />
        <path d="M29 104 h62 v3 a19 19 0 0 1 -19 19 h-24 a19 19 0 0 1 -19 -19 z" fill="#2A2E35" />
        <rect x="29" y="103.4" width="62" height="1.4" fill="#1C1F24" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="50" y={110 + i * 4.4} width="20" height="1.8" rx="0.9" fill="#1C1F24" />
        ))}
        <circle className="rig-led" cx="37" cy="97" r="2.3" fill="#1E6FFF" />
      </g>
    ),
    Head: ({ mood, look, blink }) => (
      <>
        {/* The antenna, which is half of this one's silhouette. */}
        <path d="M60 44 L60 30" stroke="#5A6069" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="60" cy="27" r="4.2" fill="#1E6FFF" />
        <rect x="26" y="42" width="68" height="44" rx="14" fill="#16181C" />
        <rect x="26.8" y="42.8" width="66.4" height="42.4" rx="13.4" stroke="#2C3037" strokeWidth="1.6" />
        <rect x="32" y="47" width="56" height="34" rx="9" fill="#07080A" />
        <g filter="url(#rig-glow)">
          <g className={blink ? 'rig-wink' : undefined}>{dotFeatures(mood, look, false)}</g>
          {blink && <g className="rig-blink">{dotFeatures(mood, look, true)}</g>}
        </g>
      </>
    ),
  },

  /*
   * Sixteen. Lanky: a wide, short display on a thin neck over a narrow
   * perfboard torso, one post, and a weighted disc so it does not fall
   * over. The arms are long because everything about this one is long.
   */
  sixteen: {
    name: 'Sixteen',
    head: 'a two-line character display for a face',
    lit: '#1B3B10',
    arm: { y: 62, s: 1.04 },
    Base: () => (
      <>
        <ellipse className="rig-shadow" cx="60" cy="144" rx="24" ry="3.6" />
        <ellipse cx="60" cy="139" rx="22" ry="6" fill="#2B2822" />
        <ellipse cx="60" cy="137" rx="22" ry="6" fill="#3A362E" />
        <rect x="56" y="96" width="8" height="42" rx="2" fill="#787D85" />
        <rect x="57.6" y="96" width="1.6" height="42" fill="#9BA0A9" opacity="0.7" />
      </>
    ),
    Body: () => (
      <g className="rig-body">
        {/* A strip of perfboard for a torso: FR-4, plated holes, and a
            ground pour down one edge the way a cut strip has. */}
        <rect x="46" y="58" width="28" height="40" rx="2" fill="#1C6B43" />
        <rect x="46" y="58" width="2.6" height="40" fill="#175837" />
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2, 3].map((c) => (
            <circle key={`${r}-${c}`} cx={53 + c * 5} cy={63 + r * 6} r="1.05" fill="#0E3F27" />
          )),
        )}
        <circle className="rig-led" cx="70" cy="93" r="2.1" fill="#1E6FFF" />
        <rect x="34" y="55" width="52" height="7" rx="2.5" fill="#8E939C" />
        <rect x="58" y="46" width="4" height="10" rx="1.4" fill="#7E838B" />
      </g>
    ),
    Head: ({ mood, look, blink }) => (
      <>
        {/* A wide, short module: the one head on the page that is more than
            twice as wide as it is tall. */}
        <rect x="14" y="12" width="92" height="34" rx="2.5" fill="#1C6B43" />
        <rect x="19" y="16" width="82" height="26" rx="1.5" fill="#8FBF3F" />
        {/* Every cell, faint, so the lit ones read as characters in a row of
            character positions rather than as free-floating blocks. */}
        {Array.from({ length: 2 }, (_, r) =>
          Array.from({ length: 16 }, (_, c) => (
            <rect
              key={`b${r}-${c}`}
              x={CELL_X + c * (CELL_W + CELL_GAP)}
              y={CELL_Y + r * (CELL_H + 3.4)}
              width={CELL_W}
              height={CELL_H}
              rx="0.5"
              fill="#1B3B10"
              opacity="0.12"
            />
          )),
        )}
        <g className={blink ? 'rig-wink' : undefined}>
          {sixteenCells(mood, look, false).map(([c, r]) => (
            <Cell key={`f${c}-${r}`} c={c} r={r} />
          ))}
        </g>
        {blink && (
          <g className="rig-blink">
            {sixteenCells(mood, look, true).map(([c, r]) => (
              <Cell key={`s${c}-${r}`} c={c} r={r} />
            ))}
          </g>
        )}
        <circle cx="16.5" cy="14.5" r="1.3" fill="#0E3F27" />
        <circle cx="103.5" cy="43.5" r="1.3" fill="#0E3F27" />
      </>
    ),
  },

  /*
   * Seg. Low and wide: a breadboard lying flat on four legs, like a bench,
   * with a small display on a short stalk. Half the height of Rig and
   * nearly twice as wide, which is what makes it unmistakable at a glance.
   */
  seg: {
    name: 'Seg',
    head: 'a seven-segment face',
    lit: '#FF4A3D',
    arm: { y: 102, s: 0.66 },
    Base: () => (
      <>
        <ellipse className="rig-shadow" cx="60" cy="146" rx="34" ry="4" />
        {[31, 47, 73, 89].map((x) => (
          <g key={x}>
            <rect x={x} y="124" width="6.5" height="18" rx="2" fill="#787D85" />
            <rect x={x - 1.5} y="141" width="9.5" height="3.4" rx="1.4" fill="#2B2822" />
          </g>
        ))}
      </>
    ),
    Body: () => (
      <g className="rig-body">
        {/* A breadboard the way it lies on a bench: the channel running
            along it, and the two fields of holes either side. */}
        <rect x="22" y="98" width="76" height="28" rx="3" fill="#EFEADF" />
        <rect x="22" y="109" width="76" height="6" fill="#DED7C8" />
        <rect x="22" y="111.4" width="76" height="1.2" fill="#CEC6B4" />
        {[0, 1].map((r) =>
          Array.from({ length: 12 }, (_, c) => (
            <rect
              key={`t${r}-${c}`}
              x={27 + c * 5.6}
              y={101 + r * 4.4}
              width="2"
              height="2"
              rx="0.4"
              fill="#C6BEAB"
            />
          )),
        )}
        {[0, 1].map((r) =>
          Array.from({ length: 12 }, (_, c) => (
            <rect
              key={`b${r}-${c}`}
              x={27 + c * 5.6}
              y={116 + r * 4.4}
              width="2"
              height="2"
              rx="0.4"
              fill="#C6BEAB"
            />
          )),
        )}
        <circle className="rig-led" cx="93" cy="104" r="2.1" fill="#1E6FFF" />
        <rect x="56" y="86" width="8" height="14" rx="2" fill="#7E838B" />
      </g>
    ),
    Head: ({ mood, look, blink }) => (
      <>
        <rect x="30" y="52" width="60" height="36" rx="3" fill="#171413" />
        <rect x="30.8" y="52.8" width="58.4" height="34.4" rx="2.4" stroke="#332C2A" strokeWidth="1.6" />
        <g filter="url(#rig-glow)">
          <g className={blink ? 'rig-wink' : undefined}>
            <Digit x={38 + look * 2} y={60} on={SEG_FACE[mood] ?? SEG_FACE.idle} />
            <Digit x={69 + look * 2} y={60} on={SEG_FACE[mood] ?? SEG_FACE.idle} />
          </g>
          {blink && (
            <g className="rig-blink">
              <Digit x={38 + look * 2} y={60} on={SEG_FACE.shut} />
              <Digit x={69 + look * 2} y={60} on={SEG_FACE.shut} />
            </g>
          )}
          {/* The colon, on only when this one is working something out. */}
          <circle cx="60" cy="66" r="1.7" fill="var(--rig-lit)" opacity={mood === 'think' ? 1 : 0.14} />
          <circle cx="60" cy="76" r="1.7" fill="var(--rig-lit)" opacity={mood === 'think' ? 1 : 0.14} />
        </g>
      </>
    ),
  },
}

/* ================================================================== */

interface Props {
  size?: number
  /** Which of the four this is. */
  model?: Model
  mood?: Mood
  /** What they are doing with their hands. */
  act?: Act
  /** Which way they are looking: -1 left, 0 ahead, 1 right. */
  look?: -1 | 0 | 1
  /** Still, for a screenshot or a reel frame. */
  still?: boolean
  className?: string
}

export function Rig({
  size = 120,
  model = 'rig',
  mood = 'idle',
  act = 'idle',
  look = 0,
  still = false,
  className,
}: Props) {
  const spec = SPECS[model]

  /*
   * The blink, which is most of the character.
   *
   * Both halves are in the document at once and the CSS swaps which one is
   * visible on one 5.4 s cycle. No state, no timer, nothing to clean up —
   * and nothing that re-renders a component five times a second to shut a
   * pair of eyes.
   */
  const blink = !still && mood === 'idle'

  /* The shared poses, fitted to this body. The art is authored around a
     shoulder line at y = 77; this maps that onto the real shoulders and
     scales the reach about them. */
  const { y: ay, s: as } = spec.arm
  const armFit = `translate(60 ${ay}) scale(${as}) translate(-60 -77)`

  return (
    <svg
      className={`rig rig-${model}${still ? ' rig-still' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size * 1.25}
      viewBox="0 0 120 150"
      fill="none"
      role="img"
      aria-label={`${spec.name}, a small robot with ${spec.head}`}
      style={{ ['--rig-lit' as string]: spec.lit }}
    >
      <defs>
        {/* The aluminium, lit from the top left the way the renders are. */}
        <linearGradient id="rig-alu" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D7D9DE" />
          <stop offset="0.45" stopColor="#B4B8C0" />
          <stop offset="1" stopColor="#8E939C" />
        </linearGradient>
        <linearGradient id="rig-alu-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9DBE0" />
          <stop offset="1" stopColor="#9BA0A9" />
        </linearGradient>
        {/* What a lit dot throws onto the panel around it. */}
        <filter id="rig-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.9" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <spec.Base />
      <spec.Body />

      <g transform={armFit}>{ARMS[act]()}</g>

      <g className="rig-head">
        <spec.Head mood={mood} look={look} blink={blink} />
      </g>
    </svg>
  )
}
