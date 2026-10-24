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

/** Two square eyes, which is as much face as 80 dots will carry. */
const eyes = (row: number): Dot[] => [
  [2, row], [3, row], [2, row + 1], [3, row + 1],
  [6, row], [7, row], [6, row + 1], [7, row + 1],
]

/**
 * The faces.
 *
 * Shut is the blink, and it is a single row rather than an empty grid: a
 * matrix with nothing lit reads as switched off, not as blinking.
 */
const FACES: Record<string, Dot[]> = {
  idle: [...eyes(2), [3, 5], [4, 6], [5, 6], [6, 5]],
  shut: [[2, 3], [3, 3], [6, 3], [7, 3], [3, 5], [4, 6], [5, 6], [6, 5]],
  happy: [
    [2, 2], [3, 2], [2, 3], [3, 3], [6, 2], [7, 2], [6, 3], [7, 3],
    [2, 5], [7, 5], [3, 6], [4, 6], [5, 6], [6, 6],
  ],
  think: [
    ...eyes(2),
    [5, 6], [6, 6], [7, 6],
  ],
  oops: [
    [2, 2], [3, 3], [3, 2], [2, 3], [6, 2], [7, 2], [6, 3], [7, 3],
    [3, 6], [4, 5], [5, 5], [6, 6],
  ],
}

export type Mood = keyof typeof FACES

interface Props {
  size?: number
  mood?: Mood
  /** Still, for a screenshot or a reel frame. */
  still?: boolean
  className?: string
}

/* The matrix, in the module's own coordinates. */
const DOT_X = 31.2
const DOT_Y = 14.6
const PITCH = 6.4
const DOT_R = 2.1

export function Rig({ size = 120, mood = 'idle', still = false, className }: Props) {
  const lit = new Set(FACES[mood].map(([c, r]) => `${c},${r}`))
  const blink = FACES.shut.map(([c, r]) => `${c},${r}`)
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

      {/* ---- arms: cable, into a 2.54 mm header ---- */}
      <g className="rig-arm rig-arm-l">
        <path d="M28 77 C 15 85, 11 97, 15 109" stroke="#33302B" strokeWidth="4.4" strokeLinecap="round" />
        <rect x="9" y="107" width="12" height="8" rx="1.8" fill="#1E6FFF" />
        <rect x="11.4" y="114" width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
        <rect x="16.8" y="114" width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
      </g>
      <g className="rig-arm rig-arm-r">
        <path d="M92 77 C 105 85, 109 97, 105 109" stroke="#33302B" strokeWidth="4.4" strokeLinecap="round" />
        <rect x="99" y="107" width="12" height="8" rx="1.8" fill="#1E6FFF" />
        <rect x="101.4" y="114" width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
        <rect x="106.8" y="114" width="1.8" height="3.4" rx="0.8" fill="#C9A227" />
      </g>

      {/* ---- neck ---- */}
      <rect x="54" y="60" width="12" height="13" rx="2" fill="#7E838B" />

      {/* ---- the head: an 8x8 matrix module in its frame ---- */}
      <g className="rig-head">
        <rect x="20" y="8" width="80" height="58" rx="8" fill="#191714" />
        <rect x="20.8" y="8.8" width="78.4" height="56.4" rx="7.2" stroke="#36332D" strokeWidth="1.6" />
        {/* The panel the dots are behind. */}
        <rect x="25" y="13" width="70" height="48" rx="4.5" fill="#0E0D0B" />
        <g filter="url(#rig-glow)">{dots}</g>
        {/* Two mounting screws, because the real module has four. */}
        <circle cx="25.5" cy="62.5" r="1.7" fill="#3C3932" />
        <circle cx="94.5" cy="62.5" r="1.7" fill="#3C3932" />
      </g>

    </svg>
  )
}
