import { Link } from 'react-router-dom'
import { Selected } from '@/ui/Selected'
import { RigStand } from '@/ui/RigStand'

/**
 * The section that says this is for rooms as well as for boards.
 *
 * Everything else on the page shows a thing on a bench. Somebody who wants
 * to plan where a desk goes, and whether the wall behind it carries what
 * they are about to plug into it, will not recognise themselves in a
 * breadboard. This is where they do.
 *
 * It leads on the picture because the picture is the argument. The numbers
 * under it are read off that build — they are what the editor says about it,
 * not what a designer thought would look convincing in a row of stats.
 *
 * Copy here follows ASD-STE100 as far as marketing prose can: one idea per
 * sentence, active voice, present tense, the same word for the same thing
 * every time. "Setup" is a setup throughout; it is never a rig, a
 * battlestation or a space.
 */

/**
 * Read off the room-setup build, not estimated.
 *
 * The first draft of this said 17 parts and 39 runs because they sounded
 * about right. They were not: it is 16 and 34. Numbers on a page nobody can
 * check are the easiest thing in the world to get wrong and the hardest for
 * a reader to catch, so these are the editor's own counts for that document
 * -- `Parts` and `Connections` as the status bar reports them.
 *
 * To re-check after changing the build, open /app?start=room-setup and read
 * the status bar, or in the console:
 *   const d = draftrig.doc.getState().doc
 *   d.order.length, d.connectionOrder.length
 */
const FACTS: { label: string; value: string }[] = [
  { label: 'Room', value: '4.6 × 3.4 m' },
  { label: 'Parts', value: '16' },
  { label: 'Sockets', value: '2' },
  { label: 'Cables', value: '34 runs' },
]

export function RoomShow() {
  return (
    <section className="sec sec-alt room-show" id="rooms">
      <RigStand act="carry" mood="idle" side="left" size={104} inset={12} />

      <div className="lpw">
        <div className="sec-head center">
          <h2>Plan the room, not just the board.</h2>
          <p>
            Put the walls in first. Then put the desk against one, the screens on it, and
            the tower below. Every cable goes where a cable goes.
          </p>
        </div>

        <div className="room-art">
          <Selected label="Room setup" dim="4600 × 3400 × 2400 mm">
            <img
              src="/slides/room-setup.jpg"
              alt="A room with a desk, two monitors, a tower, a television and a soundbar, all wired to two wall sockets"
              width={2360}
              height={1400}
              loading="lazy"
              decoding="async"
            />
          </Selected>
        </div>

        <dl className="room-facts">
          {FACTS.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="room-copy">
          <div>
            <h3>The room is a part</h3>
            <p>
              A room has a size, and the size is the constraint. Set the width, the depth and
              the ceiling. The floor is at zero, so everything you add stands at its real
              height.
            </p>
          </div>
          <div>
            <h3>The sockets are real</h3>
            <p>
              Put an outlet on the wall. Plug the desk into it. The solver adds up what you
              connected, and it tells you when one socket carries too much.
            </p>
          </div>
          <div>
            <h3>The cables have length</h3>
            <p>
              A lead runs from the port to the port, around what is in the way. You find out
              that 1.5 m does not reach before you buy the 1.5 m.
            </p>
          </div>
        </div>

        <div className="room-cta">
          <Link className="btn btn-primary btn-lg" to="/app?start=room-setup">
            Open this room<span className="arr" aria-hidden="true" />
          </Link>
          <Link className="btn btn-ghost btn-lg" to="/projects">
            Start an empty one
          </Link>
        </div>
      </div>
    </section>
  )
}
