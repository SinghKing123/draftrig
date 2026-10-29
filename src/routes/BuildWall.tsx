import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CrewSpot } from '@/ui/CrewSpot'
import { useMedia, REDUCED } from '@/ui/motion'
import { GALLERY } from '@/io/gallery'

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
 *
 * It leads on a room rather than a board. A desk with a tower under it, two
 * monitors on it and a heater beside it is the thing the editor does now
 * that nothing else in this category does at all, and it is also the
 * clearest answer to "what would I make with this". The thrust rig and the
 * rover came off to make room; the workbench and the bare sensor node went
 * earlier.
 */
/*
 * Ids only. The name and the note live in `io/gallery.ts`, because the
 * gallery above this section carried its own copies of both and the two
 * disagreed — this wall said "LED message board" and "Extrusion rack"
 * where the gallery said "Message board" and "Shop rack". Two adjacent
 * sections disagreeing about what the product's own example builds are
 * called is the kind of thing a reader notices and cannot unsee.
 */
const TILES = [
  'desk-setup',
  'eight-bit',
  'pi-case',
  'message-board',
  'arcade',
  'desk-terminal',
  'control-cabinet',
  'shop-rack',
  'panel',
  'quadcopter',
  'plant-watering',
  'cnc-router',
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
function Tile({ id }: { id: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  /*
   * A looping video is motion, and no stylesheet can stop one.
   *
   * The reduced-motion block in site-lp.css stops the marquees, the code
   * layer, the trace and the current. It cannot stop twelve `<video loop>`
   * elements, so somebody who asked for less motion was still being shown
   * twelve build animations running forever. The still is already here as
   * the poster; under the setting it is simply the whole tile.
   */
  const still = useMedia(REDUCED)

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

  const b = GALLERY[id]

  return (
    <div className="bw-tile" ref={host}>
      {near && !still ? (
        <video
          /* The clips are named after the starter they were recorded
             from, with one prefix. Deriving the path keeps the tile list a
             list of build ids rather than a second list of filenames. */
          src={`/grid/grid-${id}.webm`}
          poster={`/grid/grid-${id}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      ) : (
        <img src={`/grid/grid-${id}.jpg`} alt="" loading="lazy" />
      )}
      <div className="bw-cap">
        <b>{b.name}</b>
        <span>{b.note}</span>
      </div>
    </div>
  )
}

export function BuildWall() {
  return (
    <section className="sec bw" id="wall">
      <div className="lpw">
        <div className="sec-head center">
          <h2>Watch one go together.</h2>
        </div>

        <div className="bw-grid">
          <div className="bw-code" aria-hidden="true">
            {COLUMNS.map((text, i) => (
              <pre key={i} style={{ animationDuration: `${46 + i * 13}s` }}>
                <code>{text + '\n\n' + text}</code>
              </pre>
            ))}
          </div>
          {TILES.map((id) => (
            <Tile key={id} id={id} />
          ))}
        </div>

        {/*
          * Rig stands at the bottom of the page and nowhere else on it.
          *
          * He is the last thing before the footer because this is where the
          * page stops arguing and asks, and a character at the top of a
          * product page is a mascot wearing the hero. He is also built out
          * of the catalogue, so he belongs under a wall of builds rather
          * than over a headline.
          *
          * No speech bubble. The copy on this page says things once and
          * plainly, and a robot saying them again in a cartoon balloon is
          * the same sentence twice.
          */}
        <div className="bw-cta">
          <CrewSpot who="seg" size={104} act="wrench" mood="happy" bare />
          <Link className="btn btn-primary btn-lg" to="/projects">
            Try Draftrig<span className="arr" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
