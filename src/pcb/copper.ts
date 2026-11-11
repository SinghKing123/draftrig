import type { Doc } from '@/state/doc'
import type { Vec2 } from '@/parts/kernel/types'
import { bodyRect, footprintOf, padAt } from './footprint'
import { dist, distToSegment, type Rect } from './geom'
import type { Footprint, Pad, Pcb, Side, Track, Via } from './types'
import { padKey } from './types'
import type { Nets } from './nets'

/**
 * The board, flattened into the copper that is actually on it.
 *
 * Everything downstream — what is routed, what is too close to what, what
 * goes in the Gerber — wants the same thing: a flat list of pads and
 * segments in board coordinates with a net and a layer on each. Working
 * that out once, here, is what stops the checker and the exporter from
 * drifting apart and disagreeing about the board they are looking at.
 */

/** A pad, placed, with the net it belongs to. */
export interface PlacedPad {
  key: string
  instanceId: string
  portId: string
  label: string
  at: Vec2
  size: Vec2
  shape: Pad['shape']
  drill: number
  /** Null when the pad belongs to no net: nothing is wired to it. */
  net: string | null
  /** A through-hole pad is on both layers. */
  through: boolean
  side: Side
}

/** One straight run of copper. */
export interface Segment {
  trackId: string
  net: string
  layer: Side
  width: number
  a: Vec2
  b: Vec2
}

export interface Flat {
  pads: PlacedPad[]
  padByKey: Map<string, PlacedPad>
  segments: Segment[]
  vias: Via[]
  /** Instance id -> the footprint used, so callers need not rebuild it. */
  footprints: Map<string, Footprint>
  bodies: { instanceId: string; rect: Rect; side: Side; name: string }[]
}

export function flatten(doc: Doc, pcb: Pcb, nets: Nets): Flat {
  const pads: PlacedPad[] = []
  const padByKey = new Map<string, PlacedPad>()
  const footprints = new Map<string, Footprint>()
  const bodies: Flat['bodies'] = []

  for (const id of doc.order) {
    const pl = pcb.placements[id]
    const inst = doc.instances[id]
    if (!pl || !inst) continue
    const fp = footprintOf(inst)
    if (!fp) continue
    footprints.set(id, fp)
    bodies.push({ instanceId: id, rect: bodyRect(fp, pl), side: pl.side, name: inst.name })
    for (const pad of fp.pads) {
      const key = padKey(id, pad.portId)
      const p: PlacedPad = {
        key,
        instanceId: id,
        portId: pad.portId,
        label: pad.label,
        at: padAt(pad, pl),
        size: pad.size,
        shape: pad.shape,
        drill: pad.drill,
        net: nets.netOf.get(key) ?? null,
        through: pad.drill > 0,
        side: pl.side,
      }
      pads.push(p)
      padByKey.set(key, p)
    }
  }

  const segments: Segment[] = []
  for (const tid of pcb.trackOrder) {
    const t = pcb.tracks[tid]
    if (!t) continue
    for (let i = 1; i < t.pts.length; i++) {
      segments.push({ trackId: t.id, net: t.net, layer: t.layer, width: t.width, a: t.pts[i - 1], b: t.pts[i] })
    }
  }

  const vias = pcb.viaOrder.map((id) => pcb.vias[id]).filter((v): v is Via => !!v)

  return { pads, padByKey, segments, vias, footprints, bodies }
}

/* ------------------------------------------------------------------ */
/* Connectivity                                                        */
/* ------------------------------------------------------------------ */

/**
 * How close two pieces of copper have to be to count as joined, mm.
 *
 * Not zero. A track is drawn to a pad centre and a pad has a radius, and
 * a person routing by hand lands within a fraction of a millimetre of
 * where they meant to. Treating that as unrouted would make the checker
 * complain about boards that are plainly finished, and the number is
 * small enough that two things this close really are touching.
 */
const TOUCH = 0.05

/**
 * Which pads of each net the copper actually joins.
 *
 * This is the question a board is finished or not finished on, and it is
 * the one a ratsnest answers from the other side. Copper joins two
 * things when they share a layer and overlap, so the walk unions pads
 * into tracks, tracks into each other, and the two layers through a via.
 */
export class Connectivity {
  private parent = new Map<string, string>()

  private find(x: string): string {
    let p = this.parent.get(x)
    if (p === undefined) {
      this.parent.set(x, x)
      return x
    }
    if (p !== x) {
      p = this.find(p)
      this.parent.set(x, p)
    }
    return p
  }

  private union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  /** Are these two pads joined by copper? */
  joined(a: string, b: string): boolean {
    return this.parent.has(a) && this.parent.has(b) && this.find(a) === this.find(b)
  }

  static of(flat: Flat): Connectivity {
    const c = new Connectivity()
    for (const p of flat.pads) c.find(p.key)

    const touchesPad = (p: PlacedPad, at: Vec2, layer: Side): boolean => {
      if (!p.through && p.side !== layer) return false
      const r = Math.max(p.size[0], p.size[1]) / 2
      return dist(p.at, at) <= r + TOUCH
    }

    /* A track's ends are what join it to things. A track crossing a pad
       in the middle of a run is a short, not a connection, and the rule
       checker is the thing that should say so. */
    for (const s of flat.segments) {
      const sid = 'seg:' + s.trackId
      c.find(sid)
      for (const p of flat.pads) {
        if (p.net !== s.net) continue
        if (touchesPad(p, s.a, s.layer) || touchesPad(p, s.b, s.layer)) c.union(sid, p.key)
      }
    }

    /* Two tracks on one layer that meet. */
    for (let i = 0; i < flat.segments.length; i++) {
      for (let j = i + 1; j < flat.segments.length; j++) {
        const s = flat.segments[i]
        const t = flat.segments[j]
        if (s.trackId === t.trackId || s.layer !== t.layer || s.net !== t.net) continue
        const gap = Math.min(
          distToSegment(s.a, t.a, t.b),
          distToSegment(s.b, t.a, t.b),
          distToSegment(t.a, s.a, s.b),
          distToSegment(t.b, s.a, s.b),
        )
        if (gap <= (s.width + t.width) / 2 + TOUCH) c.union('seg:' + s.trackId, 'seg:' + t.trackId)
      }
    }

    /* A via carries a net from one layer to the other. */
    for (const v of flat.vias) {
      const vid = 'via:' + v.id
      c.find(vid)
      for (const s of flat.segments) {
        if (s.net !== v.net) continue
        if (distToSegment(v.at, s.a, s.b) <= v.pad / 2 + s.width / 2 + TOUCH) c.union(vid, 'seg:' + s.trackId)
      }
      for (const p of flat.pads) {
        if (p.net !== v.net) continue
        if (dist(p.at, v.at) <= Math.max(p.size[0], p.size[1]) / 2 + v.pad / 2 + TOUCH) c.union(vid, p.key)
      }
    }

    return c
  }
}

/**
 * The pairs still to route, one net at a time.
 *
 * A net of n pads needs n-1 joins, not n² lines, so the pairs are the
 * edges of a minimum spanning tree over the pads that are not already
 * joined by copper — shortest first, which is also the order anyone
 * routing by hand would pick them off in. Pads the copper already joins
 * start life in the same group, so a line disappears the moment the
 * track that replaces it lands.
 */
export function ratsnest(flat: Flat, nets: Nets, conn: Connectivity): { net: string; a: Vec2; b: Vec2 }[] {
  const out: { net: string; a: Vec2; b: Vec2 }[] = []

  for (const net of nets.list) {
    const pads = net.pads
      .map((p) => flat.padByKey.get(padKey(p.instanceId, p.portId)))
      .filter((p): p is PlacedPad => !!p)
    if (pads.length < 2) continue

    /* Groups: pads the copper already joins travel together. */
    const group = new Map<string, number>()
    let next = 0
    for (const p of pads) {
      if (group.has(p.key)) continue
      const g = next++
      group.set(p.key, g)
      for (const q of pads) if (q !== p && !group.has(q.key) && conn.joined(p.key, q.key)) group.set(q.key, g)
    }

    /* Prim's, over groups rather than pads. */
    const roots = [...new Set(group.values())]
    if (roots.length < 2) continue
    const inTree = new Set<number>([roots[0]])
    while (inTree.size < roots.length) {
      let best: { d: number; a: PlacedPad; b: PlacedPad } | null = null
      for (const a of pads) {
        if (!inTree.has(group.get(a.key)!)) continue
        for (const b of pads) {
          if (inTree.has(group.get(b.key)!)) continue
          const d = dist(a.at, b.at)
          if (!best || d < best.d) best = { d, a, b }
        }
      }
      if (!best) break
      inTree.add(group.get(best.b.key)!)
      out.push({ net: net.id, a: best.a.at, b: best.b.at })
    }
  }

  return out
}

/** Every track that carries a given net, for highlighting. */
export function tracksOfNet(pcb: Pcb, net: string): Track[] {
  return pcb.trackOrder.map((id) => pcb.tracks[id]).filter((t): t is Track => !!t && t.net === net)
}
