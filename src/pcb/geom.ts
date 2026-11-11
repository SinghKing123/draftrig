import type { Vec2 } from '@/parts/kernel/types'

/**
 * The plane geometry the board editor needs, and nothing else.
 *
 * All of it is millimetres in board space. None of it knows about the
 * screen: the canvas owns the transform from these numbers to pixels, so
 * a clearance worked out here is the clearance the fab will see rather
 * than a number that drifts with the zoom.
 */

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]]
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
export const len = (a: Vec2): number => Math.hypot(a[0], a[1])
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Rotate about the origin, degrees anticlockwise. */
export function rotate(p: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]
}

/** Snap to a grid, keeping the sign. A grid of 0 or less leaves it alone. */
export const snap = (v: number, grid: number): number => (grid > 0 ? Math.round(v / grid) * grid : v)
export const snapPt = (p: Vec2, grid: number): Vec2 => [snap(p[0], grid), snap(p[1], grid)]

/** The closest point to `p` on the segment `a`–`b`. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return a
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return [a[0] + t * dx, a[1] + t * dy]
}

export const distToSegment = (p: Vec2, a: Vec2, b: Vec2): number => dist(p, closestOnSegment(p, a, b))

/**
 * The gap between two segments, zero if they cross.
 *
 * Sampling the four endpoint-to-segment distances is exact for disjoint
 * segments and wrong only for crossing ones, where it returns something
 * positive for a pair that actually touches. So the crossing test comes
 * first and short-circuits it: a clearance check that misses a crossing
 * is a board with a short on it.
 */
export function segmentGap(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): number {
  if (segmentsCross(a1, a2, b1, b2)) return 0
  return Math.min(
    distToSegment(a1, b1, b2),
    distToSegment(a2, b1, b2),
    distToSegment(b1, a1, a2),
    distToSegment(b2, a1, a2),
  )
}

const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

export function segmentsCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const d1 = cross(b1, b2, a1)
  const d2 = cross(b1, b2, a2)
  const d3 = cross(a1, a2, b1)
  const d4 = cross(a1, a2, b2)
  // Strictly opposite sides on both tests: a shared endpoint or a touch is
  // left to the distance pass, which measures it as the zero it is.
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** Half-extents of an axis-aligned box, as a rectangle centred on `at`. */
export interface Rect {
  at: Vec2
  /** Full width and height, mm. */
  size: Vec2
  /** Degrees. */
  rot: number
}

/** The distance from a point to a rotated rectangle's edge, 0 inside it. */
export function distToRect(p: Vec2, r: Rect): number {
  const local = rotate(sub(p, r.at), -r.rot)
  const dx = Math.abs(local[0]) - r.size[0] / 2
  const dy = Math.abs(local[1]) - r.size[1] / 2
  if (dx <= 0 && dy <= 0) return 0
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
}

export function rectCorners(r: Rect): Vec2[] {
  const [w, h] = [r.size[0] / 2, r.size[1] / 2]
  return ([[-w, -h], [w, -h], [w, h], [-w, h]] as Vec2[]).map((c) => add(r.at, rotate(c, r.rot)))
}

/** Do two rotated rectangles overlap? Separating axes, four of them. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const ca = rectCorners(a)
  const cb = rectCorners(b)
  const axes: Vec2[] = [
    rotate([1, 0], a.rot), rotate([0, 1], a.rot),
    rotate([1, 0], b.rot), rotate([0, 1], b.rot),
  ]
  for (const axis of axes) {
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity
    for (const q of ca) {
      const t = q[0] * axis[0] + q[1] * axis[1]
      amin = Math.min(amin, t); amax = Math.max(amax, t)
    }
    for (const q of cb) {
      const t = q[0] * axis[0] + q[1] * axis[1]
      bmin = Math.min(bmin, t); bmax = Math.max(bmax, t)
    }
    if (amax < bmin || bmax < amin) return false
  }
  return true
}

/**
 * The corner that turns a straight run into a 45° one.
 *
 * Tracks go orthogonal then diagonal, which is how every board is drawn
 * and the reason boards look the way they do: a right angle in copper is
 * an acid trap on the inside of the corner and a reflection on the
 * outside. The longer axis takes the orthogonal leg, so the diagonal is
 * never longer than it has to be.
 *
 * Returns the single corner between `a` and `b`, or null when the run is
 * already straight or already at 45°, in which case there is nothing to
 * put between them.
 */
export function corner45(a: Vec2, b: Vec2): Vec2 | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < 1e-9 || ay < 1e-9) return null
  if (Math.abs(ax - ay) < 1e-9) return null
  return ax > ay
    ? [b[0] - Math.sign(dx) * ay, a[1]]
    : [a[0], b[1] - Math.sign(dy) * ax]
}

/** The run from `a` to `b`, as the vertices of one or two segments. */
export function run45(a: Vec2, b: Vec2): Vec2[] {
  const c = corner45(a, b)
  return c ? [a, c, b] : [a, b]
}
