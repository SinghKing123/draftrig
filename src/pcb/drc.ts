import type { Vec2 } from '@/parts/kernel/types'
import { Connectivity, type Flat, type PlacedPad, type Segment } from './copper'
import { dist, distToRect, distToSegment, rectsOverlap, segmentGap } from './geom'
import type { Nets } from './nets'
import type { Pcb } from './types'
import { padKey } from './types'

/**
 * The design rule check.
 *
 * A board that looks finished and a board that can be made are different
 * boards, and the difference is entirely in numbers too small to see at
 * the zoom anyone draws at. So the check is the part of this workspace
 * that is worth the most: it is the only thing between a layout and
 * forty pounds of unusable fibreglass.
 *
 * Every violation carries a place on the board, because a list of faults
 * you cannot point at is a list nobody fixes.
 */

export type Severity = 'error' | 'warning'

export interface Violation {
  id: string
  severity: Severity
  /** Short enough to read in a list. */
  title: string
  detail: string
  /** Where on the board, for the marker and for zooming to it. */
  at: Vec2
  net?: string
}

/** Copper, as the clearance pass sees it: a thing with a net and a layer. */
type Item =
  | { kind: 'pad'; pad: PlacedPad }
  | { kind: 'seg'; seg: Segment }
  | { kind: 'via'; at: Vec2; r: number; net: string }

function netOfItem(i: Item): string | null {
  if (i.kind === 'pad') return i.pad.net
  if (i.kind === 'seg') return i.seg.net
  return i.net
}

/** Layers an item is on. A through-hole pad and a via are on both. */
function onLayers(i: Item): ('top' | 'bottom')[] {
  if (i.kind === 'pad') return i.pad.through ? ['top', 'bottom'] : [i.pad.side]
  if (i.kind === 'via') return ['top', 'bottom']
  return [i.seg.layer]
}

/** The gap between two pieces of copper, edge to edge, in mm. */
function gap(a: Item, b: Item): number {
  const asSeg = (i: Item): Segment | null => (i.kind === 'seg' ? i.seg : null)
  const sa = asSeg(a)
  const sb = asSeg(b)

  if (sa && sb) return Math.max(0, segmentGap(sa.a, sa.b, sb.a, sb.b) - (sa.width + sb.width) / 2)

  const roundOf = (i: Item): { at: Vec2; r: number } | null => {
    if (i.kind === 'via') return { at: i.at, r: i.r / 2 }
    if (i.kind === 'pad' && i.pad.shape === 'round') return { at: i.pad.at, r: Math.max(i.pad.size[0], i.pad.size[1]) / 2 }
    return null
  }

  if (sa || sb) {
    const s = (sa ?? sb)!
    const o = sa ? b : a
    const rnd = roundOf(o)
    if (rnd) return Math.max(0, distToSegment(rnd.at, s.a, s.b) - rnd.r - s.width / 2)
    // A rectangular pad: measure to the rectangle, and allow for the
    // track's own width.
    const p = (o as Extract<Item, { kind: 'pad' }>).pad
    const r = { at: p.at, size: p.size, rot: 0 }
    const samples = sampleSegment(s.a, s.b)
    let best = Infinity
    for (const q of samples) best = Math.min(best, distToRect(q, r))
    return Math.max(0, best - s.width / 2)
  }

  const ra = roundOf(a)
  const rb = roundOf(b)
  if (ra && rb) return Math.max(0, dist(ra.at, rb.at) - ra.r - rb.r)
  if (ra || rb) {
    const rnd = (ra ?? rb)!
    const other = ra ? b : a
    const p = (other as Extract<Item, { kind: 'pad' }>).pad
    return Math.max(0, distToRect(rnd.at, { at: p.at, size: p.size, rot: 0 }) - rnd.r)
  }

  const pa = (a as Extract<Item, { kind: 'pad' }>).pad
  const pb = (b as Extract<Item, { kind: 'pad' }>).pad
  const dx = Math.abs(pa.at[0] - pb.at[0]) - (pa.size[0] + pb.size[0]) / 2
  const dy = Math.abs(pa.at[1] - pb.at[1]) - (pa.size[1] + pb.size[1]) / 2
  if (dx <= 0 && dy <= 0) return 0
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
}

/** A handful of points along a segment, for measuring to a rectangle. */
function sampleSegment(a: Vec2, b: Vec2): Vec2[] {
  const n = Math.max(2, Math.min(24, Math.ceil(dist(a, b) / 0.25)))
  const out: Vec2[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  return out
}

const mid = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/**
 * How many pairs the clearance pass will look at before it stops.
 *
 * Clearance is every piece of copper against every other, which grows as
 * the square. On the boards this editor makes that is nothing; on a
 * pathological one it would lock the tab up, and a checker that freezes
 * the application is worse than one that says it did not finish. When it
 * stops it says so, in the list, as a warning you can see.
 */
const MAX_PAIRS = 400_000

export function checkBoard(pcb: Pcb, flat: Flat, nets: Nets): Violation[] {
  const out: Violation[] = []
  const { clearance, edge, track: minTrack } = pcb.rules
  const hx = pcb.w / 2
  const hy = pcb.h / 2

  /* ---- 1. nothing placed ---- */
  if (!flat.pads.length) {
    return [{
      id: 'empty',
      severity: 'warning',
      title: 'Nothing on the board',
      detail: 'No part has been placed yet. Press Arrange to drop the circuit onto the board.',
      at: [0, 0],
    }]
  }

  /* ---- 2. unrouted nets ---- */
  const conn = Connectivity.of(flat)
  for (const net of nets.list) {
    const pads = net.pads
      .map((p) => flat.padByKey.get(padKey(p.instanceId, p.portId)))
      .filter((p): p is PlacedPad => !!p)
    if (pads.length < 2) continue
    const missing: PlacedPad[] = []
    for (let i = 1; i < pads.length; i++) if (!conn.joined(pads[0].key, pads[i].key)) missing.push(pads[i])
    if (!missing.length) continue
    out.push({
      id: `unrouted:${net.id}`,
      severity: 'error',
      title: `${net.name} is not routed`,
      detail:
        missing.length === pads.length - 1
          ? `${pads.length} pads, none of them joined by copper.`
          : `${missing.length} of ${pads.length} pads are not reached by the copper on this net.`,
      at: mid(pads[0].at, missing[0].at),
      net: net.id,
    })
  }

  /* ---- 3. a pad with nothing wired to it ---- */
  const loose = flat.pads.filter((p) => p.net === null)
  if (loose.length) {
    out.push({
      id: 'unconnected-pads',
      severity: 'warning',
      title: `${loose.length} pad${loose.length === 1 ? '' : 's'} on no net`,
      detail: 'Nothing is wired to these terminals on the bench, so the board has nowhere to take them.',
      at: loose[0].at,
    })
  }

  /* ---- 4. clearance, every piece of copper against every other ---- */
  const items: Item[] = [
    ...flat.pads.map((pad): Item => ({ kind: 'pad', pad })),
    ...flat.segments.map((seg): Item => ({ kind: 'seg', seg })),
    ...flat.vias.map((v): Item => ({ kind: 'via', at: v.at, r: v.pad, net: v.net })),
  ]

  let pairs = 0
  let truncated = false
  const seen = new Set<string>()
  outer: for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (++pairs > MAX_PAIRS) {
        truncated = true
        break outer
      }
      const a = items[i]
      const b = items[j]
      const na = netOfItem(a)
      const nb = netOfItem(b)
      // Same net is allowed to touch. That is what a net is.
      if (na !== null && na === nb) continue
      // Two pads of one part that are on no net at all: not a fault of
      // the layout, and already reported once above.
      if (na === null && nb === null) continue
      const la = onLayers(a)
      const lb = onLayers(b)
      if (!la.some((l) => lb.includes(l))) continue

      const g = gap(a, b)
      if (g >= clearance) continue

      const at = placeOf(a, b)
      const key = `${Math.round(at[0] * 20)}:${Math.round(at[1] * 20)}`
      if (seen.has(key)) continue
      seen.add(key)

      const short = g <= 0
      out.push({
        id: `clear:${i}:${j}`,
        severity: short ? 'error' : 'warning',
        title: short ? `${na ?? '?'} shorts to ${nb ?? '?'}` : 'Too close',
        detail: short
          ? 'Two different nets are touching. The board would come back with them joined.'
          : `${g.toFixed(2)} mm apart, and the rule is ${clearance.toFixed(2)} mm.`,
        at,
        net: na ?? nb ?? undefined,
      })
    }
  }
  if (truncated) {
    out.push({
      id: 'clearance-truncated',
      severity: 'warning',
      title: 'Clearance check stopped early',
      detail: `This board has more copper than the checker walks in one pass (${MAX_PAIRS.toLocaleString()} pairs). What is listed is real; there may be more.`,
      at: [0, 0],
    })
  }

  /* ---- 5. copper off the board, or too near its edge ---- */
  for (const p of flat.pads) {
    const over = Math.max(
      Math.abs(p.at[0]) + p.size[0] / 2 - (hx - edge),
      Math.abs(p.at[1]) + p.size[1] / 2 - (hy - edge),
    )
    if (over <= 0) continue
    out.push({
      id: `edge:${p.key}`,
      severity: Math.abs(p.at[0]) > hx || Math.abs(p.at[1]) > hy ? 'error' : 'warning',
      title: `${p.label} is over the edge`,
      detail: `This pad is ${over.toFixed(2)} mm inside the ${edge} mm edge keep-out. Move the part in, or make the board bigger.`,
      at: p.at,
      net: p.net ?? undefined,
    })
  }
  for (const s of flat.segments) {
    for (const q of [s.a, s.b]) {
      if (Math.abs(q[0]) + s.width / 2 <= hx - edge && Math.abs(q[1]) + s.width / 2 <= hy - edge) continue
      out.push({
        id: `edge-track:${s.trackId}:${q[0]}:${q[1]}`,
        severity: 'error',
        title: 'Track runs off the board',
        detail: 'Copper crosses the outline. It will be cut through when the board is routed out.',
        at: q,
        net: s.net,
      })
      break
    }
  }

  /* ---- 6. parts sitting on top of each other ---- */
  for (let i = 0; i < flat.bodies.length; i++) {
    for (let j = i + 1; j < flat.bodies.length; j++) {
      const a = flat.bodies[i]
      const b = flat.bodies[j]
      if (a.side !== b.side) continue
      if (!rectsOverlap(a.rect, b.rect)) continue
      out.push({
        id: `overlap:${a.instanceId}:${b.instanceId}`,
        severity: 'error',
        title: `${a.name} overlaps ${b.name}`,
        detail: 'Two parts occupy the same space on the same face. Only one of them can be fitted.',
        at: mid(a.rect.at, b.rect.at),
      })
    }
  }

  /* ---- 7. tracks thinner than the rule ---- */
  for (const s of flat.segments) {
    if (s.width >= minTrack - 1e-9) continue
    out.push({
      id: `thin:${s.trackId}`,
      severity: 'warning',
      title: 'Track thinner than the rule',
      detail: `${s.width.toFixed(2)} mm, against a minimum of ${minTrack.toFixed(2)} mm.`,
      at: mid(s.a, s.b),
      net: s.net,
    })
  }

  const rank: Record<Severity, number> = { error: 0, warning: 1 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

function placeOf(a: Item, b: Item): Vec2 {
  const point = (i: Item): Vec2 => (i.kind === 'pad' ? i.pad.at : i.kind === 'via' ? i.at : mid(i.seg.a, i.seg.b))
  return mid(point(a), point(b))
}

export const errorsIn = (v: Violation[]): number => v.filter((x) => x.severity === 'error').length
export const warningsIn = (v: Violation[]): number => v.filter((x) => x.severity === 'warning').length
