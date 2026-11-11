import type { Instance, PartCategory, Vec2 } from '@/parts/kernel/types'
import { getPart } from '@/parts/kernel/registry'
import { buildPart } from '@/parts/kernel/build'
import { rotate, type Rect } from './geom'
import type { Footprint, Pad, Placement } from './types'

/**
 * A footprint, worked out from the part rather than looked up.
 *
 * Every part in this catalogue already declares where its terminals are,
 * in millimetres, because the 3D bench needs that to put a wire on one.
 * A through-hole part's pins point down and lie in the part's own xz
 * plane, so the pad pattern is the terminals with the vertical thrown
 * away — and because the terminals were authored from the real part, the
 * pitch that falls out is the real pitch. A DIP comes out on 2.54 with
 * 7.62 between the rows, a resistor comes out as its lead span, a header
 * comes out as a row on a tenth of an inch. None of that is a guess and
 * none of it is a library this project would then have to keep.
 *
 * What it cannot invent is the hole size, because a lead diameter is not
 * in the part model. The drill comes off the terminal's current rating,
 * which is the one piece of evidence there is about how thick the wire
 * through it has to be, and it lands on the sizes a fab actually stocks.
 * Where that is wrong it is wrong in the safe direction: a hole slightly
 * too big is a part that still fits and a joint that still takes solder.
 */

/** Pad copper is the hole plus this much ring on each side. */
const ANNULAR = 0.45
/** No pad smaller than this, whatever the hole. */
const MIN_PAD = 1.4

/**
 * The categories that could be parts on a board.
 *
 * A board is not everything on the bench. The desk the bench stands on
 * has no footprint, and neither does the room, so the board workspace
 * takes the electronics and leaves the rest of the build alone. A part
 * is included because of what it is, not because of whether it happens
 * to be wired up: an unconnected resistor is still a resistor.
 */
const ON_BOARD: ReadonlySet<PartCategory> = new Set<PartCategory>([
  'passive',
  'semiconductor',
  'ic',
  'module',
  'connector',
  'display',
  'sensor',
  'electromech',
  'power',
])

/**
 * And the test that settles it: do the leads point down?
 *
 * The category is not enough on its own. `power` holds a barrel jack
 * and it also holds a bench supply, and the first is three leads to
 * solder while the second is a shoebox on the desk that the board is
 * connected to. Sorting them by category put a 250 mm instrument on a
 * circuit board and sized the board around it.
 *
 * What actually separates them is the terminals. A part made to go on a
 * board has leads leaving the bottom of it, because that is where the
 * board is; a bench supply has binding posts on the front, pointing at
 * the person using it. The catalogue already carries that as `dir`,
 * authored from the real part, so the question is one the parts have
 * been answering all along.
 */
const LEADS_DOWN = -0.5

export function boardable(inst: Instance): boolean {
  const def = getPart(inst.defId)
  if (!def) return false
  if (!ON_BOARD.has(def.category)) return false
  return def
    .ports(inst.params)
    .some((p) => p.kind === 'electrical' && p.dir[1] < LEADS_DOWN)
}

/** The hole a terminal needs, rounded to a size a fab drills. */
export function leadDrill(imax: number | undefined): number {
  if (imax === undefined) return 0.9
  if (imax >= 5) return 1.3
  if (imax >= 2) return 1.1
  if (imax >= 0.5) return 1.0
  return 0.8
}

export function footprintOf(inst: Instance): Footprint | null {
  const def = getPart(inst.defId)
  if (!def) return null
  const built = buildPart(def, inst.params)
  /* Only the leads that go into the board. A part can have both: a
     barrel jack has three solder tags and a mechanical mounting face. */
  const ports = built.ports.filter((p) => p.kind === 'electrical' && p.dir[1] < LEADS_DOWN)
  if (!ports.length) return null

  const pads: Pad[] = ports.map((p, i) => {
    const drill = leadDrill(p.imax)
    const d = Math.max(MIN_PAD, drill + 2 * ANNULAR)
    return {
      portId: p.id,
      label: p.label || p.id,
      at: [p.pos[0], p.pos[2]] as Vec2,
      size: [d, d] as Vec2,
      // Pin one square, the way a board is marked so it goes in the
      // right way round. It is the only orientation cue a bare
      // footprint has.
      shape: i === 0 ? 'rect' : 'round',
      drill,
    }
  })

  const b = built.body
  const w = Math.max(b.max.x - b.min.x, 0.5)
  const h = Math.max(b.max.z - b.min.z, 0.5)
  return {
    pads,
    body: [w, h],
    bodyAt: [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2],
  }
}

/* ------------------------------------------------------------------ */
/* Placed footprints                                                   */
/* ------------------------------------------------------------------ */

/**
 * A pad put where the placement says, in board coordinates.
 *
 * Mounting on the bottom mirrors x, which is what turning a board over
 * does. The hole does not move, because a hole goes through.
 */
export function padAt(pad: Pad, pl: Placement): Vec2 {
  const local: Vec2 = pl.side === 'bottom' ? [-pad.at[0], pad.at[1]] : pad.at
  const r = rotate(local, pl.rot)
  return [pl.x + r[0], pl.y + r[1]]
}

export function bodyRect(fp: Footprint, pl: Placement): Rect {
  const local: Vec2 = pl.side === 'bottom' ? [-fp.bodyAt[0], fp.bodyAt[1]] : fp.bodyAt
  const r = rotate(local, pl.rot)
  return { at: [pl.x + r[0], pl.y + r[1]], size: fp.body, rot: pl.rot }
}

/**
 * The footprint's own extent, pads and body, around its origin.
 *
 * Both corners rather than just a size, because the origin is the pad
 * pattern's and a part's body is very often not centred on it. A DC
 * barrel jack is three solder tags at one end of a body that reaches
 * 15 mm the other way; packing it by its size alone and then placing
 * its origin at the middle of that space leaves it hanging over the
 * edge of the board by everything the origin is offset by.
 */
export function footprintBounds(fp: Footprint): { min: Vec2; max: Vec2 } {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity
  for (const p of fp.pads) {
    minx = Math.min(minx, p.at[0] - p.size[0] / 2)
    maxx = Math.max(maxx, p.at[0] + p.size[0] / 2)
    miny = Math.min(miny, p.at[1] - p.size[1] / 2)
    maxy = Math.max(maxy, p.at[1] + p.size[1] / 2)
  }
  minx = Math.min(minx, fp.bodyAt[0] - fp.body[0] / 2)
  maxx = Math.max(maxx, fp.bodyAt[0] + fp.body[0] / 2)
  miny = Math.min(miny, fp.bodyAt[1] - fp.body[1] / 2)
  maxy = Math.max(maxy, fp.bodyAt[1] + fp.body[1] / 2)
  return { min: [minx, miny], max: [maxx, maxy] }
}

export function footprintSize(fp: Footprint): Vec2 {
  const b = footprintBounds(fp)
  return [b.max[0] - b.min[0], b.max[1] - b.min[1]]
}
