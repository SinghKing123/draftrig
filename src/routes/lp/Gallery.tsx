/**
 * Twelve builds the editor ships, as the editor renders them.
 *
 * The rest of the page is line drawing, which shows how a figure is
 * arrived at and says nothing about what the thing looks like once it
 * is built. These are the other half: real frames out of the viewport,
 * weighted towards the electronics, because that is the half of the
 * product a page about rooms stops showing.
 *
 * Every caption is read off the registry by `tools/probe-builds.ts` —
 * open the starter and count. Part and connection counts only: the
 * span of a build is the span of its placements, which understates it
 * by the size of whatever sits at the edge, and a number that is
 * nearly right is worse here than no number.
 */

interface Shot {
  id: string
  name: string
  shot: string
  parts: number
  conns: number
  /** Watts, for the builds that are actually on the mains. */
  w?: number
  alt: string
}

const SHOTS: Shot[] = [
  {
    id: 'eight-bit',
    name: 'Eight-bit machine',
    shot: '/presets/eight-bit.jpg',
    parts: 83,
    conns: 238,
    alt: 'Four breadboards carrying a clock, six chained shift registers and thirty-two lamps, wired up in Draftrig',
  },
  {
    id: 'control-cabinet',
    name: 'Control cabinet',
    shot: '/presets/control-cabinet.jpg',
    parts: 53,
    conns: 50,
    alt: 'A DIN-rail control cabinet in Draftrig, with terminals and cable between them',
  },
  {
    id: 'desk-terminal',
    name: 'Desk terminal',
    shot: '/presets/desk-terminal.jpg',
    parts: 51,
    conns: 43,
    alt: 'A desk terminal build in Draftrig: a display, a keyboard matrix and the board driving them',
  },
  {
    id: 'matrix',
    name: 'LED matrix',
    shot: '/presets/matrix.jpg',
    parts: 37,
    conns: 65,
    alt: 'Thirty LEDs in five rows on perfboard, chased from a microcontroller',
  },
  {
    id: 'studio-desk',
    name: 'Studio desk',
    shot: '/presets/studio-desk.jpg',
    parts: 36,
    conns: 45,
    w: 16,
    alt: 'A studio desk in Draftrig: an ultrawide on an arm, monitors at ear height, a microphone and a rack on the wall',
  },
  {
    id: 'cnc-router',
    name: 'CNC router frame',
    shot: '/presets/cnc.jpg',
    parts: 35,
    conns: 22,
    alt: 'An extrusion CNC router frame in Draftrig, with its gantry and lead screws',
  },
  {
    id: 'control-stack',
    name: 'Three-tier control stack',
    shot: '/presets/control-stack.jpg',
    parts: 33,
    conns: 49,
    alt: 'Three stacked boards in Draftrig with cable running between the tiers',
  },
  {
    id: 'home-theatre',
    name: 'Home theatre',
    shot: '/presets/home-theatre.jpg',
    parts: 29,
    conns: 50,
    w: 660,
    alt: 'A home theatre in Draftrig: a 120 inch screen, a ceiling projector, two rows of seating on a riser and seven speakers',
  },
  {
    id: 'quadcopter',
    name: 'Quadcopter',
    shot: '/presets/quadcopter.jpg',
    parts: 26,
    conns: 37,
    alt: 'A quadcopter frame in Draftrig with four motors, speed controllers and a flight board',
  },
  {
    id: 'bench-clock',
    name: 'Bench clock',
    shot: '/presets/bench-clock.jpg',
    parts: 17,
    conns: 41,
    alt: 'A seven-segment bench clock on perfboard in Draftrig, wired to its driver',
  },
  {
    id: 'logic-bench',
    name: 'Shift register',
    shot: '/presets/logic-bench.jpg',
    parts: 12,
    conns: 33,
    alt: 'A shift register on a breadboard in Draftrig with its output LEDs',
  },
  {
    id: 'blink555',
    name: '555 blinker',
    shot: '/presets/blink555.jpg',
    parts: 10,
    conns: 16,
    alt: 'A 555 astable on a breadboard in Draftrig, driving an LED',
  },
]

export function Gallery() {
  return (
    <div className="dr-gal">
      {SHOTS.map((s) => (
        <figure className="dr-gal-item" key={s.id}>
          <img src={s.shot} alt={s.alt} width={860} height={538} loading="lazy" decoding="async" />
          <figcaption>
            <strong>{s.name}</strong>
            <span className="m">
              {s.parts} parts · {s.conns} conn{s.w ? ` · ${s.w} W` : ''}
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
