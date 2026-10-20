import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * A wall of builds putting themselves together, with code running over it.
 *
 * Six tiles, each a recording of a real document being assembled part by
 * part and then wired — the editor doing the building, not a screen capture
 * of somebody working. They are the same length and framed the same way,
 * because a grid whose tiles each do their own thing is a mess rather than
 * a wall.
 *
 * The code scrolling over them is real: it is lifted from the sketches
 * these boards are actually running in the clips underneath. Invented code
 * in a product shot is the sort of thing people notice, and this costs
 * nothing to get right.
 *
 * Nothing here autoplays until it is on screen. Six videos is six decoders,
 * and starting all of them on a page nobody has scrolled to yet is a cost
 * paid by every visitor whether they ever see this or not.
 */

/*
 * Shuffled, so every row is a machine, a circuit and something built.
 *
 * They were grouped by kind: assemblies along the top, machines in the
 * middle, boards at the bottom. Read that way the wall is three claims in
 * sequence, and the last row is still "and it does circuits" — which is the
 * impression the whole section exists to correct.
 *
 * Interleaved, no two neighbours are the same kind and no row can be read
 * as a category. A router frame next to an eight-bit machine next to a case
 * with a computer in it says one thing: all of this is the same editor.
 *
 * Twelve rather than nine, and half of them projects rather than frames or
 * breadboards: a quadcopter, a stack of boards, a pot that waters itself, a
 * thrust rig, a panel. The wall had been the same nine builds for a while
 * and most of them were either furniture or a circuit, which answers the
 * question "can it do a bench supply" and not the question "what would I
 * make with this".
 */
const TILES = [
  { id: 'grid-quadcopter', name: 'Quadcopter', note: 'Ten-inch airframe, four ESCs, IMU and radio' },
  { id: 'grid-eight-bit', name: 'Eight-bit machine', note: '83 parts, 238 wires' },
  { id: 'grid-pi-case', name: 'Pi enclosure', note: 'Panels, standoffs, heat-set inserts' },
  { id: 'grid-control-stack', name: 'Control stack', note: 'Three decks, shift register, 16x2 panel' },
  { id: 'grid-arcade', name: 'Bartop cabinet', note: '15mm ply, 15" panel, Pi 5, button loom' },
  { id: 'grid-thrust-rig', name: 'Thrust rig', note: 'Brushless motor on a load cell' },
  { id: 'grid-plant-watering', name: 'Plant watering', note: 'Soil probe, relay and a pump on an ESP32' },
  { id: 'grid-cnc-router', name: 'CNC router frame', note: '2020 extrusion, rails, leadscrews' },
  { id: 'grid-panel', name: 'Control panel', note: 'LCD, keypad and switches on one face' },
  { id: 'grid-esp-weather', name: 'Sensor node', note: 'ESP32, gas and humidity' },
  { id: 'grid-workbench', name: 'Workbench', note: 'Extrusion, casters, DIN rail' },
  { id: 'grid-rover', name: 'Four-wheel rover', note: 'Acrylic deck, gearmotors, wheels' },
]

/** Taken from the sketches the boards in these clips are running. */
const CODE = `const BARS = [25, 26, 27, 14, 12, 13]

function setup() {
  for (const p of BARS) pinMode(p, OUTPUT)
}

function* loop() {
  const raw = analogRead(34)
  const lit = Math.round((raw / 1023) * BARS.length)
  for (let i = 0; i < BARS.length; i++) {
    digitalWrite(BARS[i], i < lit ? HIGH : LOW)
  }
  yield delay(120)
}

const ROWS = [2, 3, 4, 5, 6, 7]

function setup() {
  for (const p of ROWS) pinMode(p, OUTPUT)
  lcd.begin(16, 2)
  lcd.print('DRAFTRIG')
}

function* loop() {
  for (const p of ROWS) {
    digitalWrite(p, HIGH)
    yield delay(60)
    digitalWrite(p, LOW)
  }
  lcd.setCursor(0, 1)
  lcd.print(millis() / 1000)
  yield delay(40)
}`

/**
 * Three columns of it, each starting at a different line.
 *
 * A single block is only as wide as its longest line, which is about a
 * third of the grid, so the code sat over the left-hand tiles and nowhere
 * else and read as a rendering fault rather than a layer.
 */
const COLUMNS = [0, 1, 2].map((n) => {
  const lines = CODE.split('\n')
  const at = Math.floor((lines.length * n) / 3)
  return lines.slice(at).concat(lines.slice(0, at)).join('\n')
})

/** A tile that only starts once it has been scrolled to. */
function Tile({ id, name, note }: { id: string; name: string; note: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (rows) => rows.forEach((r) => r.isIntersecting && (setNear(true), io.disconnect())),
      { rootMargin: '280px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="bw-tile" ref={host}>
      {near ? (
        <video
          src={`/grid/${id}.webm`}
          poster={`/grid/${id}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      ) : (
        <img src={`/grid/${id}.jpg`} alt="" loading="lazy" />
      )}
      <div className="bw-cap">
        <b>{name}</b>
        <span>{note}</span>
      </div>
    </div>
  )
}

export function BuildWall() {
  return (
    <section className="sec bw" id="builds">
      <div className="lpw">
        <div className="sec-head center">
          <h2>Code your Build</h2>
        </div>

        <div className="bw-grid">
          <div className="bw-code" aria-hidden="true">
            {COLUMNS.map((text, i) => (
              <pre key={i} style={{ animationDuration: `${46 + i * 13}s` }}>
                <code>{text + '\n\n' + text}</code>
              </pre>
            ))}
          </div>
          {TILES.map((t) => (
            <Tile key={t.id} {...t} />
          ))}
        </div>

        <div className="bw-cta">
          <Link className="btn btn-primary btn-lg" to="/app">
            Open the editor<span className="arr" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
