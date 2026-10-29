import { Link } from 'react-router-dom'
import { Marquee } from '@/ui/motion'
import { GALLERY } from '@/io/gallery'

/**
 * The photographs, drifting past.
 *
 * Two rows, moving opposite ways at different speeds. Opposite because two
 * rows travelling together read as one wide thing sliding, which is a far
 * weaker effect than two planes passing — and because the counter-motion is
 * what makes the band feel like depth rather than like a slideshow.
 *
 * Every frame is a photograph of a build that ships with the editor, taken
 * by `tools/shoot-cine.mjs` from inside the running app. None of them is a
 * mock-up and none is a stock image, which is the only reason a band of
 * pictures earns this much of the page.
 *
 * They are links. A strip of pictures somebody cannot open is a screensaver;
 * each of these loads the build in it.
 *
 * The names and the notes come from `io/gallery.ts` and not from here. This
 * section and the wall of clips below it each used to carry their own list,
 * and the lists disagreed: one called a build "Message board" and the other
 * "LED message board", one "Shop rack" and the other "Extrusion rack".
 */

interface Frame {
  id: string
  src: string
  /** Wide frames are shot at a different aspect and get a wider tile. */
  wide?: boolean
}

const ROW_A: Frame[] = [
  { id: 'room-setup', src: '/shots/cine-room.jpg', wide: true },
  { id: 'arcade', src: '/shots/cine-arcade.jpg' },
  { id: 'ps5-stand', src: '/shots/cine-stand.jpg' },
  { id: 'message-board', src: '/shots/cine-board.jpg', wide: true },
  { id: 'shop-rack', src: '/shots/cine-rack.jpg' },
]

const ROW_B: Frame[] = [
  { id: 'eight-bit', src: '/shots/cine-eightbit.jpg' },
  { id: 'control-cabinet', src: '/shots/cine-cabinet.jpg' },
  { id: 'bench-clock', src: '/shots/cine-clock.jpg' },
  { id: 'quadcopter', src: '/shots/cine-quad.jpg' },
  { id: 'logic-bench', src: '/shots/cine-bench.jpg' },
]

function Tile({ f }: { f: Frame }) {
  const b = GALLERY[f.id]
  return (
    <Link className="show-tile" to={`/app?start=${f.id}`} data-wide={f.wide || undefined}>
      <span className="show-pic">
        {/*
          * No alternative text, on purpose.
          *
          * The name is right underneath it in text that is already read.
          * Describing the picture as well makes every tile announce itself
          * twice — "Room setup, Room setup, a desk on one wall" — which is
          * noise, not access.
          */}
        <img src={f.src} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="show-meta">
        <span className="show-name">{b.name}</span>
        <span className="show-note">{b.note}</span>
      </span>
    </Link>
  )
}

export function Showcase() {
  return (
    <section className="show" id="builds">
      <div className="lpw show-head center">
        <h2>Everything here was built in it.</h2>
      </div>

      <Marquee seconds={72} className="show-row">
        {ROW_A.map((f) => (
          <Tile key={f.id} f={f} />
        ))}
      </Marquee>

      <Marquee seconds={88} reverse className="show-row">
        {ROW_B.map((f) => (
          <Tile key={f.id} f={f} />
        ))}
      </Marquee>
    </section>
  )
}
