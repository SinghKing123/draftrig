import { Rig } from './Rig'

/**
 * Rig at work, in scenes rather than in poses.
 *
 * A mascot standing on a white ground holding a prop is a sticker. These put
 * him inside a build: a desk with two lit monitors and a tower humming under
 * it, a bench with a board in a vice and a spool of solder on a holder, a
 * frame of extrusion half bolted together. The scene is the point and he is
 * the figure in it, which is how you read what the section is about before
 * you read the heading.
 *
 * Every object here exists in the catalogue at roughly its real proportion:
 * 2020 extrusion is square and slotted, a 13 A plate is 86 mm across with
 * its earth pin on top, a desk is 740 mm to the top. Getting those right
 * costs nothing and is the difference between a drawing of a workshop and a
 * drawing by somebody who has been in one.
 *
 * Rig himself is the same component as everywhere else, nested as an inner
 * `<svg>` and placed with a transform, so there is exactly one of him to fix
 * when he changes.
 */

/* Shared material. The scenes are lit from the top left, like the renders. */
const WOOD = '#E3C590'
const WOOD_EDGE = '#C7A670'
const DARK = '#2A2724'
const ALU = '#B9BDC4'
const ALU_HI = '#D8DBE0'
const FLOOR = '#CFCABF'

/** The ground every scene stands on, so they sit at the same height. */
const Ground = ({ y = 216 }: { y?: number }) => (
  <path d={`M0 ${y} H360`} stroke={FLOOR} strokeWidth="1.5" strokeDasharray="1 0" opacity="0.7" />
)

/* ------------------------------------------------------------------ */

/**
 * The setup, with him playing on it.
 *
 * Two monitors, a tower, a desk, and the lead from the tower back to a
 * double socket on the wall — which is the build the front page opens with
 * and the one the socket demo is doing arithmetic about. The screens are lit
 * and a band drifts down them; the tower's LED breathes; his thumbs move.
 * Nothing else does.
 */
export function RigDesk({ className }: { className?: string }) {
  return (
    <svg
      className={`scene scene-desk${className ? ` ${className}` : ''}`}
      viewBox="0 58 360 168"
      fill="none"
      role="img"
      aria-label="Rig playing a console at a desk with two monitors, wired back to a wall socket"
    >
      <defs>
        <linearGradient id="sc-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E9AD6" />
          <stop offset="1" stopColor="#3F6DAC" />
        </linearGradient>
        <clipPath id="sc-a"><rect x="180" y="82" width="64" height="42" rx="2" /></clipPath>
        <clipPath id="sc-b"><rect x="258" y="88" width="64" height="36" rx="2" /></clipPath>
      </defs>

      <Ground />

      {/* ---- the wall socket, and the lead back to the tower ---- */}
      <g>
        <rect x="6" y="150" width="30" height="32" rx="3" fill="#F4F2ED" stroke="#CFC9BD" strokeWidth="1.2" />
        <rect x="12" y="157" width="7" height="4" rx="1" fill={DARK} />
        <rect x="23" y="157" width="7" height="4" rx="1" fill={DARK} />
        <rect x="17.5" y="166" width="7" height="4" rx="1" fill={DARK} />
        <circle cx="21" cy="177" r="1.4" fill="#B9B3A6" />
      </g>
      <path
        d="M21 182 C 21 200, 30 209, 62 211 L 282 211 C 304 211, 311 206, 312 198"
        stroke="#4A463F"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* ---- the desk ---- */}
      <g>
        <rect x="146" y="138" width="206" height="9" rx="2" fill={WOOD} />
        <rect x="146" y="145" width="206" height="3" rx="1.5" fill={WOOD_EDGE} />
        <rect x="154" y="147" width="9" height="69" rx="2" fill={DARK} />
        <rect x="336" y="147" width="9" height="69" rx="2" fill={DARK} />
      </g>

      {/* ---- the tower, under it ---- */}
      <g>
        <rect x="298" y="150" width="34" height="66" rx="3" fill="#33302C" />
        <rect x="302" y="155" width="26" height="2" rx="1" fill="#4A463F" />
        <rect x="302" y="160" width="26" height="2" rx="1" fill="#4A463F" />
        <circle className="sc-led" cx="315" cy="206" r="2.6" fill="#1E6FFF" />
      </g>

      {/* ---- two monitors, lit ---- */}
      <g>
        <rect x="176" y="78" width="72" height="50" rx="3.5" fill={DARK} />
        <rect x="180" y="82" width="64" height="42" rx="2" fill="url(#sc-screen)" />
        <g clipPath="url(#sc-a)">
          <rect className="sc-band" x="180" y="82" width="64" height="7" fill="#FFFFFF" opacity="0.07" />
        </g>
        <rect x="207" y="128" width="10" height="9" fill="#55514A" />
        <rect x="194" y="136" width="36" height="3.5" rx="1.75" fill="#55514A" />
      </g>
      <g>
        <rect x="254" y="84" width="72" height="44" rx="3.5" fill={DARK} />
        <rect x="258" y="88" width="64" height="36" rx="2" fill="url(#sc-screen)" />
        <g clipPath="url(#sc-b)">
          <rect className="sc-band sc-band-2" x="258" y="88" width="64" height="6" fill="#FFFFFF" opacity="0.06" />
        </g>
        <rect x="285" y="128" width="10" height="9" fill="#55514A" />
        <rect x="272" y="136" width="36" height="3.5" rx="1.75" fill="#55514A" />
      </g>

      {/*
        * Him, last, so he is in front of the desk rather than beside it.
        * Drawn before it he read as a second object that happened to share
        * the frame; drawn after it he is sitting at his own setup.
        */}
      <g transform="translate(52 92) scale(0.82)">
        <Rig size={120} act="game" mood="happy" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The bench, with him soldering at it.
 *
 * He stands behind the bench and the bench top is drawn over his shins,
 * which is the whole trick that makes him be at it rather than in front of
 * it. A spool of solder on its holder, a board clamped upright in a vice,
 * and the iron in his hand with the tip hot.
 */
export function RigBench({ className }: { className?: string }) {
  return (
    <svg
      className={`scene scene-bench${className ? ` ${className}` : ''}`}
      viewBox="0 54 360 172"
      fill="none"
      role="img"
      aria-label="Rig soldering a board held in a vice on a workbench"
    >
      <Ground />

      {/* Behind the bench, so the top crosses his shins. */}
      <g transform="translate(112 62) scale(0.86)">
        <Rig size={120} act="solder" mood="think" />
      </g>

      {/* ---- the bench ---- */}
      <g>
        <rect x="34" y="168" width="292" height="11" rx="2.5" fill={WOOD} />
        <rect x="34" y="177" width="292" height="3.5" rx="1.75" fill={WOOD_EDGE} />
        <rect x="46" y="180" width="10" height="36" rx="2" fill={DARK} />
        <rect x="304" y="180" width="10" height="36" rx="2" fill={DARK} />
        <rect x="52" y="196" width="256" height="4" rx="2" fill="#4A463F" opacity="0.55" />
      </g>

      {/* ---- a spool of solder on its holder ---- */}
      <g>
        <path d="M268 168 V146" stroke={ALU} strokeWidth="3" strokeLinecap="round" />
        <circle cx="268" cy="140" r="17" fill="#E6E3DC" stroke="#C9C4BA" strokeWidth="1.4" />
        <circle cx="268" cy="140" r="10" fill="#9AA0A8" />
        <circle cx="268" cy="140" r="3.2" fill="#F4F2ED" />
        <path d="M253 144 C 240 152, 236 160, 238 168" stroke="#9AA0A8" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* ---- a vice, with a board stood up in it ---- */}
      <g>
        <rect x="62" y="150" width="22" height="18" rx="1.5" fill="#1C7A4B" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={67 + i * 6} cy={155} r="1.1" fill="#0E4A2C" />
        ))}
        {[0, 1, 2].map((i) => (
          <circle key={`b${i}`} cx={67 + i * 6} cy={162} r="1.1" fill="#0E4A2C" />
        ))}
        <rect x="56" y="160" width="34" height="9" rx="2" fill={ALU} />
        <rect x="58" y="162" width="30" height="2.4" rx="1.2" fill={ALU_HI} />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The frame, with him bolting it together.
 *
 * 2020 extrusion drawn the way the profile actually reads from the side —
 * square, with the slot running its length — and a corner bracket with two
 * screws in it where the rails meet. He is tightening the second one.
 */
export function RigFrame({ className }: { className?: string }) {
  const rail = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx="2" fill={ALU} />
      {w > h ? (
        <rect x={x + 3} y={y + h / 2 - 1.6} width={w - 6} height="3.2" rx="1.6" fill="#8D929A" />
      ) : (
        <rect x={x + w / 2 - 1.6} y={y + 3} width="3.2" height={h - 6} rx="1.6" fill="#8D929A" />
      )}
    </>
  )
  return (
    <svg
      className={`scene scene-frame${className ? ` ${className}` : ''}`}
      viewBox="0 56 360 170"
      fill="none"
      role="img"
      aria-label="Rig tightening a corner bracket on a frame of aluminium extrusion"
    >
      <Ground />

      {/* The frame: two uprights, a top rail, a shelf. */}
      <g>
        {rail(170, 66, 11, 150)}
        {rail(316, 66, 11, 150)}
        {rail(170, 66, 157, 11)}
        {rail(176, 166, 145, 8)}
      </g>

      {/* Corner brackets where they meet, two screws each. */}
      {[
        [181, 77],
        [303, 77],
      ].map(([bx, by]) => (
        <g key={`${bx}`}>
          <path d={`M${bx} ${by} h15 v4 h-11 v11 h-4 z`} fill="#8D929A" />
          <circle cx={bx + 7} cy={by + 2} r="1.6" fill="#5F646C" />
          <circle cx={bx + 2} cy={by + 8} r="1.6" fill="#5F646C" />
        </g>
      ))}

      {/* A couple of loose T-nuts on the floor, because there always are. */}
      <rect x="86" y="208" width="9" height="5" rx="1" fill="#8D929A" />
      <rect x="100" y="210" width="9" height="5" rx="1" fill="#8D929A" />

      {/* Last, and at the upright, so the jaw of the spanner lands on the
          joint he is tightening rather than on air a hand's width from it. */}
      <g transform="translate(100 92) scale(0.82)">
        <Rig size={120} act="wrench" mood="idle" />
      </g>
    </svg>
  )
}
