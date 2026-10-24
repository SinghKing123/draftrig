/**
 * Rig, who is made of the things in the catalogue.
 *
 * A mascot for an engineering editor has one obvious trap, which is to be a
 * friendly animal holding a spanner — a character borrowed from somewhere
 * else and handed a prop so you know what the product is. Rig is built the
 * other way round: every piece of him is a part the editor actually has. The
 * head is an 8x8 LED matrix module, of which the catalogue has one and the
 * front page has forty-eight. The body is 20x20 aluminium extrusion, drawn
 * with the T-slot down the middle the way the real profile reads from the
 * front. The arms are cable, ending in a 2.54 mm header plug. He stands on a
 * foot plate with two M5 screws in it.
 *
 * Which means his face works the way the real part works: a grid of dots,
 * dark until they are lit, lit in the amber this codebase uses everywhere
 * for energised. An expression is a list of coordinates — no new mechanism,
 * no illustration, the same bitmap the simulator pushes to a real module.
 *
 * He is drawn at 120 x 150 and scales from there. There is no PNG: at a
 * tenth the size of one he can be recoloured, re-expressed and animated,
 * and he stays sharp on a display nobody has shipped yet.
 */

/** A lit dot, as [column, row] on the 8-high grid. */
type Dot = [number, number]

const COLS = 10
const ROWS = 8

/**
 * Two square eyes, which is as much face as 80 dots will carry.
 *
 * `dx` slides them along the row. It is how he looks at something: the pair
 * moves, the mouth does not, which is what reads as a glance rather than as
 * the whole head turning.
 */
const eyes = (row: number, dx = 0): Dot[] => [
  [2 + dx, row], [3 + dx, row], [2 + dx, row + 1], [3 + dx, row + 1],
  [6 + dx, row], [7 + dx, row], [6 + dx, row + 1], [7 + dx, row + 1],
]

/**
 * The faces.
 *
 * Shut is the blink, and it is a single row rather than an empty grid: a
 * matrix with nothing lit reads as switched off, not as blinking.
 */
const FACES: Record<string, (dx: number) => Dot[]> = {
  idle: (dx) => [...eyes(2, dx), [3, 5], [4, 6], [5, 6], [6, 5]],
  shut: (dx) => [[2 + dx, 3], [3 + dx, 3], [6 + dx, 3], [7 + dx, 3], [3, 5], [4, 6], [5, 6], [6, 5]],
  happy: (dx) => [
    ...eyes(2, dx),
    [2, 5], [7, 5], [3, 6], [4, 6], [5, 6], [6, 6],
  ],
  think: (dx) => [...eyes(2, dx), [5, 6], [6, 6], [7, 6]],
  oops: (dx) => [
    ...eyes(2, dx),
    [3, 6], [4, 5], [5, 5], [6, 6],
  ],
  /* Reading the catalogue: a bar sweeping the width of the panel, which is
     the one face that is an animation rather than an expression. */
  scan: (dx) => [...eyes(2, dx)],
}

export type Mood = keyof typeof FACES

/**
 * What he is doing with his hands.
 *
 * A mascot that stands with its arms down in every placement is a sticker
 * repeated, and reads as the same drawing pasted four times. Each of these
 * is a different pair of arms and a real object out of the catalogue, so
 * the section he is standing in is the thing he is working on.
 */
export type Act = 'idle' | 'solder' | 'game' | 'plug' | 'wrench'

const CABLE = '#33302B'
const ARM_W = 4.4

/** A 2.54 mm header on the end of a lead, which is how his arms terminate. */
const Header = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect x={x} y={y} width="12" height="8" rx="1.8" fill="#1E6FFF" />
    <rect x={x + 2.4} y={y + 7} width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
    <rect x={x + 7.8} y={y + 7} width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
  </>
)

const ARMS: Record<Act, () => JSX.Element> = {
  /* Hanging. The only pose where the arms sway with his breathing. */
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
        {/* A scrap of perfboard, holes and all. */}
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
        {/* Handle, ferrule, tip. */}
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

  /* A plug on a short lead, held out: the socket demo's own subject. */
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

  /* A spanner on a T-nut, rocking a few degrees: tightening, not waving. */
  wrench: () => (
    <>
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        <Header x={9} y={107} />
      </g>
      <g className="rig-turn">
        <path d="M92 77 C 99 84, 98 93, 94 98" stroke={CABLE} strokeWidth={ARM_W} strokeLinecap="round" />
        {/* Jaw to the right of him, clear of the body, so the tool reads as
            a tool rather than as a grey stub behind a post. */}
        <g fill="#AFB4BC">
          <rect x="84" y="96.4" width="21" height="5.2" rx="2.6" />
          <path d="M104 94 h8 v3.2 h-5 v4.6 h5 v3.2 h-8 a5.5 5.5 0 0 1 0 -11 z" />
        </g>
      </g>
    </>
  ),
}

interface Props {
  size?: number
  mood?: Mood
  /** What he is doing with his hands. */
  act?: Act
  /** Which way he is looking: -1 left, 0 ahead, 1 right. */
  look?: -1 | 0 | 1
  /** Still, for a screenshot or a reel frame. */
  still?: boolean
  className?: string
}

/* The matrix, in the module's own coordinates. */
const DOT_X = 31.2
const DOT_Y = 14.6
const PITCH = 6.4
const DOT_R = 2.1

export function Rig({ size = 120, mood = 'idle', act = 'idle', look = 0, still = false, className }: Props) {
  const lit = new Set(FACES[mood](look).map(([c, r]) => `${c},${r}`))
  const blink = FACES.shut(look).map(([c, r]) => `${c},${r}`)
  const canBlink = !still && mood === 'idle'

  const dots = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`
      const on = lit.has(key)
      const offOnBlink = canBlink && on && !blink.includes(key)
      const onAtBlink = canBlink && !on && blink.includes(key)
      dots.push(
        <circle
          key={key}
          cx={DOT_X + c * PITCH}
          cy={DOT_Y + r * PITCH}
          r={on ? DOT_R : DOT_R - 0.5}
          className={
            on ? (offOnBlink ? 'rig-dot on rig-wink' : 'rig-dot on')
              : onAtBlink ? 'rig-dot rig-blink' : 'rig-dot'
          }
        />,
      )
    }
  }

  return (
    <svg
      className={`rig${still ? ' rig-still' : ''}${className ? ` ${className}` : ''}`}
      width={size}
      height={size * 1.25}
      viewBox="0 0 120 150"
      fill="none"
      role="img"
      aria-label="Rig, a small robot with a dot-matrix face"
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

      {/* ---- what he stands on ---- */}
      <ellipse className="rig-shadow" cx="60" cy="145" rx="31" ry="4.2" />
      <rect x="32" y="134" width="56" height="8" rx="2.5" fill="#2B2822" />
      <circle cx="39" cy="138" r="1.6" fill="#6E6A62" />
      <circle cx="81" cy="138" r="1.6" fill="#6E6A62" />

      {/* Two short posts down to the plate, so he is standing on something
          rather than growing out of it. */}
      <rect x="47" y="124" width="9" height="11" rx="1.5" fill="#787D85" />
      <rect x="64" y="124" width="9" height="11" rx="1.5" fill="#787D85" />

      {/* ---- the body: 20x20 extrusion, T-slot to the front ---- */}
      <g className="rig-body">
        <rect x="44" y="79" width="32" height="47" rx="3" fill="url(#rig-alu)" />
        {/* The slot, and the two lips that make it read as one. */}
        <rect x="55" y="83" width="10" height="39" rx="1.6" fill="#60656D" />
        <rect x="57.4" y="85.5" width="5.2" height="34" rx="1" fill="#44484F" />
        <rect x="46.5" y="83" width="2" height="39" rx="1" fill="#E4E6EA" opacity="0.5" />
        <rect x="71.5" y="83" width="2" height="39" rx="1" fill="#71757D" opacity="0.6" />

        {/* A power indicator, which is the one thing on him that is not amber. */}
        <circle className="rig-led" cx="60" cy="115" r="2.3" fill="#1E6FFF" />
      </g>

      {/* ---- shoulders: a cross-bar on the same profile ---- */}
      <rect x="24" y="70" width="72" height="11" rx="3" fill="url(#rig-alu-bar)" />
      <rect x="27" y="74" width="66" height="2.4" rx="1.2" fill="#73777F" opacity="0.65" />

      {ARMS[act]()}

      {/* ---- neck ---- */}
      <rect x="54" y="60" width="12" height="13" rx="2" fill="#7E838B" />

      {/* ---- the head: an 8x8 matrix module in its frame ---- */}
      <g className="rig-head">
        <rect x="20" y="8" width="80" height="58" rx="8" fill="#191714" />
        <rect x="20.8" y="8.8" width="78.4" height="56.4" rx="7.2" stroke="#36332D" strokeWidth="1.6" />
        {/* The panel the dots are behind. */}
        <rect x="25" y="13" width="70" height="48" rx="4.5" fill="#0E0D0B" />
          <g filter="url(#rig-glow)">{dots}</g>
        {/* The scan bar, drawn rather than lit, because it crosses dots that
            are off and a dot cannot be half on. */}
        {mood === 'scan' && (
          <rect className="rig-scan" x="29" y="46" width="9" height="12" rx="2" fill="#FFB020" />
        )}
        {/* Two mounting screws, because the real module has four. */}
        <circle cx="25.5" cy="62.5" r="1.7" fill="#3C3932" />
        <circle cx="94.5" cy="62.5" r="1.7" fill="#3C3932" />
      </g>

    </svg>
  )
}
