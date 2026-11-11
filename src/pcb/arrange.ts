import type { Doc } from '@/state/doc'
import type { Vec2 } from '@/parts/kernel/types'
import { boardable, footprintBounds, footprintOf } from './footprint'
import type { Pcb, Placement } from './types'

/**
 * A first arrangement, so the board is never a blank rectangle.
 *
 * It is not an autoplacer and does not pretend to be: it packs the parts
 * into rows, biggest first, which is enough to get every footprint onto
 * the board and visible so they can be dragged into a layout that makes
 * sense. Deciding what should sit next to what is a judgement about the
 * circuit, and a tool that guesses at that produces a board somebody
 * then has to undo.
 *
 * What it does guarantee is that nothing starts out overlapping and
 * nothing starts out off the edge, which are the two things that would
 * otherwise fill the rule checker with faults the person did not make.
 */

/** Space left between footprints, mm. */
const GAP = 2

/** One part, as the packer sees it: an extent and where its origin is in it. */
interface Shelf {
  id: string
  size: Vec2
  min: Vec2
}

export interface Arrangement {
  placements: Record<string, Placement>
  /** The board this arrangement needs, mm. */
  w: number
  h: number
  /** Parts that would not fit, by instance id. */
  dropped: string[]
}

/** Every part in the document that belongs on a board. */
export function boardParts(doc: Doc): string[] {
  return doc.order.filter((id) => {
    const inst = doc.instances[id]
    return !!inst && boardable(inst)
  })
}

/**
 * Pack the circuit onto a board, growing the board to fit if asked.
 *
 * `fixed` keeps the board at the size it already is and reports what did
 * not fit; without it the board is sized to the contents and rounded up
 * to the next 5 mm, which is how a fab quotes anyway.
 */
export function arrange(doc: Doc, pcb: Pcb, fixed = false): Arrangement {
  const ids = boardParts(doc)
  const sized = ids
    .map((id) => {
      const inst = doc.instances[id]
      const fp = inst ? footprintOf(inst) : null
      if (!fp) return null
      const b = footprintBounds(fp)
      return { id, size: [b.max[0] - b.min[0], b.max[1] - b.min[1]] as Vec2, min: b.min }
    })
    .filter((x): x is Shelf => !!x)

  if (!sized.length) return { placements: {}, w: pcb.w, h: pcb.h, dropped: [] }

  /* Tallest first: shelves packed this way leave the least dead space. */
  const order = [...sized].sort((a, b) => b.size[1] - a.size[1] || b.size[0] - a.size[0])

  const area = order.reduce((s, p) => s + (p.size[0] + GAP) * (p.size[1] + GAP), 0)
  /* Wide enough that the rows come out close to square, which is the
     shape that wastes least and the shape a board usually wants. */
  const want = Math.sqrt(area * 1.35)
  const widest = Math.max(...order.map((p) => p.size[0]))
  const inner = fixed ? pcb.w - 2 * GAP : Math.max(want, widest + GAP)

  /*
   * Pack first, in shelf coordinates: a left-to-right cursor on rows
   * that grow downwards, with every part recorded by the top-left
   * corner of its extent. Turning that into board coordinates is one
   * pass at the end, which is the only place either axis has to be
   * thought about twice.
   */
  const shelf = new Map<string, Vec2>()
  const dropped: string[] = []
  let cx = 0
  let cy = 0
  let rowH = 0
  let used = 0

  for (const p of order) {
    if (p.size[0] > inner) {
      dropped.push(p.id)
      continue
    }
    if (cx > 0 && cx + p.size[0] > inner) {
      cy += rowH + GAP
      cx = 0
      rowH = 0
    }
    shelf.set(p.id, [cx, cy])
    cx += p.size[0] + GAP
    rowH = Math.max(rowH, p.size[1])
    used = Math.max(used, cx - GAP)
  }

  const packedW = Math.max(used, 10)
  const packedH = cy + rowH

  const w = fixed ? pcb.w : round5(packedW + 2 * GAP + 2 * pcb.rules.edge)
  const h = fixed ? pcb.h : round5(packedH + 2 * GAP + 2 * pcb.rules.edge)

  /*
   * Shelf to board.
   *
   * The pack is centred, and y is turned over because the board counts
   * upwards while the shelves counted down. A placement is the
   * footprint's origin, not a corner of it, so each one is offset by
   * where its own extent sits relative to that origin: left edge at
   * `min[0]`, top edge at `max[1]`.
   */
  const placements: Record<string, Placement> = {}
  for (const p of order) {
    const at = shelf.get(p.id)
    if (!at) continue
    const left = at[0] - packedW / 2
    const top = packedH / 2 - at[1]
    placements[p.id] = {
      x: +(left - p.min[0]).toFixed(3),
      y: +(top - (p.min[1] + p.size[1])).toFixed(3),
      rot: 0,
      side: 'top',
    }
  }

  /* Anything that overhangs a board held at its size is reported rather
     than quietly left sticking out. */
  if (fixed) {
    for (const p of order) {
      const pl = placements[p.id]
      if (!pl) continue
      const lo = pl.y + p.min[1]
      const hi = lo + p.size[1]
      if (lo < -pcb.h / 2 + pcb.rules.edge || hi > pcb.h / 2 - pcb.rules.edge) {
        delete placements[p.id]
        dropped.push(p.id)
      }
    }
  }

  return { placements, w, h, dropped }
}

const round5 = (v: number): number => Math.max(20, Math.ceil(v / 5) * 5)
