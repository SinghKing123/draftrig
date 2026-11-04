import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Marquee } from '@/ui/motion'

/**
 * The templates, moving past.
 *
 * Two rows travelling in opposite directions, which is the device both
 * reference pages use for the same job: a lot of real content shown as
 * texture, with any one of it readable if you stop on it. It is honest
 * here in a way a logo wall never is — every card is a document in the
 * repository that opens in one click, and the line under each is a figure
 * the editor reports about it rather than a description of it.
 *
 * The images are the catalogue photographs in `public/presets`, taken from
 * the live editor with the simulation running. A template with no
 * photograph is not shown: a card with a placeholder in it is worse than a
 * shorter row.
 */

interface Card {
  id: string
  name: string
  fact: string
}

/*
 * The facts are read off the builds, not written about them. Where a figure
 * appears here it is one the editor prints for that document — the mass and
 * cost from the bill of materials, the load from the solver, the dimension
 * from the part that owns it.
 */
const ROW_A: Card[] = [
  { id: 'desk-setup', name: 'Desk setup', fact: 'One lead, a tower and a heater on it' },
  { id: 'workbench', name: 'Workbench', fact: 'Worktop, DIN rail, 66 fasteners' },
  { id: 'pi-case', name: 'Enclosure', fact: 'Inserts, standoffs, a lid that fits' },
  { id: 'shop-rack', name: 'Shop rack', fact: '2020 frame · 16 joints · casters' },
  { id: 'control-stack', name: 'Control stack', fact: 'Three decks, loom up the side' },
  { id: 'arcade', name: 'Arcade cabinet', fact: '34 items · 11.18 kg · $214.74' },
]

const ROW_B: Card[] = [
  { id: 'control-cabinet', name: 'Control cabinet', fact: 'Four switched zones on a rail' },
  { id: 'desk-terminal', name: 'Desk terminal', fact: 'A 1602 panel, a knob, a lid' },
  { id: 'drawer-unit', name: 'Drawer unit', fact: 'Three drawers, plywood carcass' },
  { id: 'message-board', name: 'Message board', fact: '48 modules · 3,072 dots' },
  { id: 'quadcopter', name: 'Quadcopter', fact: 'Four arms, two plates, an IMU' },
  { id: 'eight-bit', name: 'Eight-bit machine', fact: 'Six registers · 32 lamps' },
]

function Tile({ c }: { c: Card }) {
  return (
    <Link className="tpl" to={`/app?start=${c.id}`}>
      <span className="tpl-shot">
        <img src={`/presets/${c.id}.jpg`} alt="" width={860} height={538} loading="lazy" decoding="async" />
      </span>
      <span className="tpl-name">{c.name}</span>
      <span className="tpl-fact mono">{c.fact}</span>
    </Link>
  )
}

export function Templates() {
  /*
   * Rendered only once the section has been near the viewport.
   *
   * Twelve photographs duplicated for the loop is twenty-four requests, and
   * on a page this long most readers never reach them. The row holds its
   * height either way so nothing jumps when they arrive.
   */
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = document.getElementById('builds')
    if (!el || typeof IntersectionObserver !== 'function') {
      setOn(true)
      return
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setOn(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="tpls" id="builds">
      <div className="lpw tpls-head">
        <h2>Start from one of these.</h2>
        <p>
          Open it, pull it apart, swap the bits for yours. They are real files, not
          screenshots — the numbers under each one are what it actually comes to.
        </p>
      </div>

      <div className="tpls-rows" data-on={on || undefined}>
        <Marquee seconds={78} className="tpl-row">
          {ROW_A.map((c) => (
            <Tile key={c.id} c={c} />
          ))}
        </Marquee>
        <Marquee seconds={94} reverse className="tpl-row">
          {ROW_B.map((c) => (
            <Tile key={c.id} c={c} />
          ))}
        </Marquee>
      </div>
    </section>
  )
}
