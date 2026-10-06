/**
 * Schematic symbols, scrolling behind the hero.
 *
 * The symbols a circuit diagram is actually drawn from — not the interface
 * icons used elsewhere in the product, which are little pictures of parts.
 * These are the notation: a resistor is a zigzag, a capacitor is two plates,
 * a diode is a triangle against a bar.
 *
 * Rows run in opposite directions. One row travelling on its own reads as a
 * ticker; several going opposite ways read as a field the page is sitting on,
 * which is the job here. Each row is its list twice over and slides by
 * exactly half its own width, so the loop never seams.
 *
 * It sits behind live text, so it is drawn faintly and masked to nothing at
 * both edges. Contrast of the headline over it is what decides the opacity,
 * not how nice the pattern looks on its own.
 */

/** Every symbol is drawn in this box, so the row spacing is even. */
const W = 60
const H = 30

type Sym = { id: string; d: string; extra?: React.ReactNode }

/*
 * Drawn on one baseline at y = 15, entering at x = 0 and leaving at x = 60,
 * so a row of them reads as one continuous wire with parts along it.
 */
const SYMS: Sym[] = [
  // Resistor
  { id: 'r', d: 'M0 15h14l3-7 6 14 6-14 6 14 3-7h16' },
  // Capacitor
  { id: 'c', d: 'M0 15h26M26 6v18M34 6v18M34 15h26' },
  // Polarised capacitor
  { id: 'cp', d: 'M0 15h26M26 6v18M40 15h20', extra: <path d="M34 6a9 9 0 0 1 0 18" /> },
  // Inductor
  { id: 'l', d: 'M0 15h14M46 15h14', extra: <path d="M14 15a4 4 0 0 1 8 0 4 4 0 0 1 8 0 4 4 0 0 1 8 0 4 4 0 0 1 8 0" /> },
  // Diode
  { id: 'd', d: 'M0 15h22M22 7v16l14-8-14-8M36 7v16M36 15h24' },
  // LED
  {
    id: 'led',
    d: 'M0 15h22M22 7v16l14-8-14-8M36 7v16M36 15h24',
    extra: <><path d="M26 4 33 -3" /><path d="M33 5 40 -2" /></>,
  },
  // Ground
  { id: 'gnd', d: 'M30 0v14M20 14h20M24 19h12M27 24h6' },
  // Cell
  { id: 'bat', d: 'M0 15h24M24 5v20M32 9v12M32 15h28' },
  // Switch
  { id: 'sw', d: 'M0 15h18M42 15h18', extra: <><circle cx="20" cy="15" r="2" /><circle cx="40" cy="15" r="2" /><path d="M20 15 39 6" /></> },
  // Transistor, NPN
  {
    id: 'npn',
    d: 'M0 15h14M14 6v18M14 11 30 4M14 19 30 26M30 4v-6M30 26v6',
    extra: <path d="M24 22 30 26 26 20z" fill="currentColor" stroke="none" />,
  },
  // Op-amp
  { id: 'op', d: 'M0 9h16M0 21h16M16 2v26l24-13-24-13M40 15h20' },
  // Lamp
  { id: 'lamp', d: 'M0 15h16M44 15h16', extra: <><circle cx="30" cy="15" r="10" /><path d="M23 8 37 22M37 8 23 22" /></> },
  // Fuse
  { id: 'fu', d: 'M0 15h16M44 15h16M16 9h28v12H16z', extra: <path d="M16 15h28" /> },
  // Crystal
  { id: 'xt', d: 'M0 15h18M42 15h18M18 6v18M42 6v18M24 9h12v12H24z' },
  // Potentiometer
  {
    id: 'pot',
    d: 'M0 15h14l3-7 6 14 6-14 6 14 3-7h16',
    extra: <><path d="M30 -4v9" /><path d="M27 1 30 5 33 1" fill="currentColor" stroke="none" /></>,
  },
  // Speaker
  { id: 'spk', d: 'M0 15h18M18 9h8v12h-8zM26 9 38 2v26l-12-7' },
]

/**
 * Six rows, each a different slice of the set so none repeats a neighbour.
 *
 * Four of them, centred, only reached the lower half of the hero: the top
 * rows fell behind the headline, where the mask takes them out, and left the
 * space above it bare. Six fill the whole height, and the ones that land
 * under the words are hidden as before.
 */
const ROWS = [0, 3, 6, 9, 12, 14]

export function Glyphs() {
  return (
    <div className="glyphs" aria-hidden="true">
      {ROWS.map((from, r) => {
        const row = SYMS.slice(from).concat(SYMS.slice(0, from))
        const twice = [...row, ...row]
        return (
          <div className="glyph-row" key={from} data-rev={r % 2 === 1}>
            <div className="glyph-run" style={{ animationDuration: `${62 + r * 9}s` }}>
              {twice.map((s, i) => (
                <svg
                  key={`${s.id}-${i}`}
                  viewBox={`0 -6 ${W} ${H + 12}`}
                  width={W}
                  height={H + 12}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={s.d} />
                  {s.extra}
                </svg>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
