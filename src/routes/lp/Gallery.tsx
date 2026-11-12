import { Link } from 'react-router-dom'
/**
 * Twelve builds the editor ships, as the editor renders them.
 *
 * The rest of the page is line drawing, which shows how a figure is
 * arrived at and says nothing about what the thing looks like once it
 * is built. These are the other half: real frames out of the viewport,
 * weighted towards the electronics, because that is the half of the
 * product a page about rooms stops showing.
 *
 * Each frame carries its name and nothing else. It used to carry a
 * part and connection count under the name, at a size that was legible
 * on the machine it was designed on and not on anybody else's. A
 * figure too small to read is not a smaller figure, it is a texture,
 * and the name is the only thing a reader wants from a thumbnail.
 */

interface Shot {
  id: string
  name: string
  shot: string
  alt: string
}

const SHOTS: Shot[] = [
  {
    id: 'eight-bit',
    name: 'Eight-bit machine',
    shot: '/presets/eight-bit.jpg',
    alt: 'Four breadboards carrying a clock, six chained shift registers and thirty-two lamps, wired up in Draftrig',
  },
  {
    id: 'control-cabinet',
    name: 'Control cabinet',
    shot: '/presets/control-cabinet.jpg',
    alt: 'A DIN-rail control cabinet in Draftrig, with terminals and cable between them',
  },
  {
    id: 'desk-terminal',
    name: 'Desk terminal',
    shot: '/presets/desk-terminal.jpg',
    alt: 'A desk terminal build in Draftrig: a display, a keyboard matrix and the board driving them',
  },
  {
    id: 'matrix',
    name: 'LED matrix',
    shot: '/presets/matrix.jpg',
    alt: 'Thirty LEDs in five rows on perfboard, chased from a microcontroller',
  },
  {
    id: 'studio-desk',
    name: 'Studio desk',
    shot: '/presets/studio-desk.jpg',
    alt: 'A studio desk in Draftrig: an ultrawide on an arm, monitors at ear height, a microphone and a rack on the wall',
  },
  {
    id: 'cnc-router',
    name: 'CNC router frame',
    shot: '/presets/cnc.jpg',
    alt: 'An extrusion CNC router frame in Draftrig, with its gantry and lead screws',
  },
  {
    id: 'control-stack',
    name: 'Three-tier control stack',
    shot: '/presets/control-stack.jpg',
    alt: 'Three stacked boards in Draftrig with cable running between the tiers',
  },
  {
    id: 'home-theatre',
    name: 'Home theatre',
    shot: '/presets/home-theatre.jpg',
    alt: 'A home theatre in Draftrig: a 120 inch screen, a ceiling projector, two rows of seating on a riser and seven speakers',
  },
  {
    id: 'quadcopter',
    name: 'Quadcopter',
    shot: '/presets/quadcopter.jpg',
    alt: 'A quadcopter frame in Draftrig with four motors, speed controllers and a flight board',
  },
  {
    id: 'bench-clock',
    name: 'Bench clock',
    shot: '/presets/bench-clock.jpg',
    alt: 'A seven-segment bench clock on perfboard in Draftrig, wired to its driver',
  },
  {
    id: 'logic-bench',
    name: 'Shift register',
    shot: '/presets/logic-bench.jpg',
    alt: 'A shift register on a breadboard in Draftrig with its output LEDs',
  },
  {
    id: 'blink555',
    name: '555 blinker',
    shot: '/presets/blink555.jpg',
    alt: 'A 555 astable on a breadboard in Draftrig, driving an LED',
  },
]

export function Gallery() {
  return (
    <div className="dr-gal">
      {SHOTS.map((s) => (
        // Each frame opens the build in it: the editor on a computer, the
        // build sheet on a phone.
        <Link className="dr-gal-item" key={s.id} to={`/app?start=${s.id}`}>
          <img src={s.shot} alt={s.alt} width={860} height={538} loading="lazy" decoding="async" />
          <span className="dr-gal-cap">
            <strong>{s.name}</strong>
          </span>
        </Link>
      ))}
    </div>
  )
}
