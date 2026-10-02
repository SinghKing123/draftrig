import * as THREE from 'three'

/**
 * The shape a wire takes between two terminals.
 *
 * Split out of Wires.tsx so it can be measured. A wire that dives through the
 * board it is wired to, or loops out past the pin it is going to and comes
 * back, is a drawing bug rather than a rendering one, and there is no way to
 * see it in a screenshot test but every way to see it in a number.
 *
 * Coordinates are millimetres throughout, like the rest of the scene.
 */

/** How far the wire leaves a terminal along that terminal's own normal. */
const LAUNCH_MAX = 6
const LAUNCH_FRACTION = 0.2

/** How high the middle of an unrouted wire rides above the straight line. */
const SAG_FRACTION = 0.18
const SAG_MAX = 14

/**
 * The shortest wire that still gets an arch. Below this the two terminals are
 * essentially the same point — adjacent holes in a breadboard are 2.54 mm
 * apart — and any lift at all reads as a loop rather than as slack.
 */
const MIN_ARCH = 3

export interface WireEnd {
  pos: THREE.Vector3
  /** Unit normal: the direction the terminal faces. */
  dir: THREE.Vector3
}

/* ------------------------------------------------------------------ */
/* Getting out of the way                                              */
/* ------------------------------------------------------------------ */

/**
 * Something a wire must not pass through.
 *
 * An axis-aligned box per part, in world space, with the id of the instance it
 * belongs to so a wire can ignore the two parts it is attached to. A wire has
 * to reach into its own endpoints; everything else it has to go around.
 */
export interface Obstacle {
  instanceId: string
  box: THREE.Box3
}

/** Clearance kept around whatever is in the way, mm. */
const CLEAR = 2.4

/**
 * How far the bow may be pushed, as a multiple of the straight-line span.
 *
 * Without a cap, one tall part under a short wire produces a loop bigger than
 * the build, which is a worse drawing than the one that clipped. Past this a
 * wire goes as far as it sensibly can and accepts the graze. The alternative
 * is really routing a harness, which is a different and much larger program.
 */
const MAX_BOW = 1.7

/** A part's own outermost millimetre may be brushed without it counting. */
const GRAZE = 1.2

/**
 * How deep a path goes into anything it is not attached to, in millimetres.
 *
 * This is the thing being minimised, so it is the thing measured, rather than
 * something that stands in for it. It samples the drawn curve rather than
 * reasoning about control points, because a spline does not pass through its
 * control points and the drawn line is what people see.
 */
export function avoidable(
  o: Obstacle,
  a: THREE.Vector3,
  b: THREE.Vector3,
  skip: readonly string[],
): boolean {
  if (skip.includes(o.instanceId)) return false
  /*
   * A part one of the terminals is inside cannot be gone around.
   *
   * Panel-mounted things are the case: a switch goes through a hole in the
   * sheet and its terminals are behind it, which puts them inside the sheet's
   * box. A wire reaching one of those has to cross the sheet, and so does the
   * real one — the hole it goes through is not in the model. Treating it as
   * something to avoid asks for a route that does not exist, and the search
   * spends its whole budget failing to find one.
   */
  return !o.box.containsPoint(a) && !o.box.containsPoint(b)
}

function intrusion(
  pts: THREE.Vector3[],
  obstacles: Obstacle[],
  skip: readonly string[],
  samples = 56,
): number {
  if (!obstacles.length) return 0
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4)
  const p = new THREE.Vector3()
  let worst = 0
  const first = pts[0]
  const last = pts[pts.length - 1]
  for (const o of obstacles) {
    if (!avoidable(o, first, last, skip)) continue
    const box = o.box.clone().expandByScalar(-GRAZE)
    if (box.isEmpty()) continue
    for (let i = 0; i <= samples; i++) {
      curve.getPoint(i / samples, p)
      if (!box.containsPoint(p)) continue
      worst = Math.max(
        worst,
        Math.min(
          p.x - box.min.x, box.max.x - p.x,
          p.y - box.min.y, box.max.y - p.y,
          p.z - box.min.z, box.max.z - p.z,
        ),
      )
    }
  }
  return worst
}

/** How far along `dir` a point must move to leave a box behind. */
function exitDistance(box: THREE.Box3, from: THREE.Vector3, dir: THREE.Vector3): number {
  let t = 0
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = dir[axis]
    if (Math.abs(d) < 1e-6) continue
    const edge = d > 0 ? box.max[axis] : box.min[axis]
    t = Math.max(t, (edge - from[axis]) / d)
  }
  return t
}

/**
 * How far the midpoint has to go along `dir` to be outside everything the
 * straight run passes through.
 *
 * A first guess, not an answer: it puts the control point clear, and a spline
 * does not reach its control point, so the measured pass still has to confirm
 * it. Starting from this rather than from a ladder is the difference between
 * one measurement and six.
 */
function reachFor(
  a: WireEnd,
  b: WireEnd,
  dir: THREE.Vector3,
  obstacles: Obstacle[],
  skip: readonly string[],
): number {
  const centre = a.pos.clone().add(b.pos).multiplyScalar(0.5)
  const probe = new THREE.Vector3()
  let push = 0
  for (const o of obstacles) {
    if (!avoidable(o, a.pos, b.pos, skip)) continue
    const grown = o.box.clone().expandByScalar(CLEAR)
    // Does the straight run touch it at all? Walk the line rather than solve
    // it: eleven points is enough for a box and costs nothing.
    let touches = false
    for (let i = 0; i <= 10 && !touches; i++) {
      probe.lerpVectors(a.pos, b.pos, i / 10)
      if (grown.containsPoint(probe)) touches = true
    }
    if (!touches) continue
    push = Math.max(push, exitDistance(grown, centre, dir))
  }
  return push
}

/**
 * The directions a wire may bow, best first.
 *
 * Up, then the two sideways. Up leads because a wire on a bench goes over a
 * component rather than beside it, and because forty wires that all bow the
 * same way stay readable where forty that each found their own way do not.
 *
 * Each is made perpendicular to the run, so a bow never stretches the wire
 * along its own length. That is the whole reason a near-vertical run — a
 * switch on a panel, down to the board behind it — could not be helped by
 * lifting: there, up and along are the same direction.
 */
function bowDirections(travel: THREE.Vector3): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(travel, -travel.y)
  if (up.lengthSq() > 1e-4) out.push(up.normalize())
  const side = new THREE.Vector3().crossVectors(travel, new THREE.Vector3(0, 1, 0))
  if (side.lengthSq() > 1e-4) {
    side.normalize()
    out.push(side, side.clone().negate())
  }
  if (!out.length) out.push(new THREE.Vector3(1, 0, 0))
  return out
}

/**
 * Control points for the wire, in order.
 *
 * Two rules decide the shape, and a search decides the one number they leave
 * open.
 *
 * A wire may only leave a terminal along that terminal's own normal, and only
 * as far as it is going in total. The launch used to be a flat fraction of the
 * straight-line distance, which is fine until the normals point away from each
 * other: then both ends shoot outward, the curve has to turn around to get
 * back, and it overshoots the pin it was going to. Projecting the launch onto
 * the direction of travel, and refusing to launch backwards, removes that.
 *
 * And the middle is pushed off the straight line — the bow. On an empty bench
 * that is a few millimetres of slack, upward, which is what a wire does. With
 * something in the way it is however far it takes to clear it, in whichever
 * perpendicular direction clears it soonest.
 *
 * The direction and distance are found by trying and measuring rather than by
 * computing, because what has to be true is a property of the drawn curve and
 * not of its control points: push a wire up and it may clear the chip it was
 * crossing and bury itself in the one beside it. Ten candidates, measured, and
 * the first that is clear wins — the first candidate is the ordinary one, so
 * a wire with nothing in its way costs one measurement against an empty list.
 */
export function wirePoints(
  a: WireEnd,
  b: WireEnd,
  waypoints?: THREE.Vector3[],
  obstacles: Obstacle[] = [],
  skip: readonly string[] = [],
): THREE.Vector3[] {
  const span = a.pos.distanceTo(b.pos)

  if (span < MIN_ARCH) {
    // Two holes apart. A straight hop, so it cannot loop.
    const hop = [a.pos.clone()]
    if (waypoints?.length) for (const w of waypoints) hop.push(w.clone())
    hop.push(b.pos.clone())
    return hop
  }

  const travel = b.pos.clone().sub(a.pos).normalize()
  const launch = (end: WireEnd, toward: THREE.Vector3): number => {
    // Only the part of the normal that makes progress counts. A pin facing
    // straight back down the wire gets no launch rather than a negative one.
    const along = Math.max(end.dir.dot(toward), 0)
    return Math.min(LAUNCH_MAX, span * LAUNCH_FRACTION) * along
  }
  const outA = launch(a, travel)
  const outB = launch(b, travel.clone().negate())

  /** The path, given a midpoint. Hand-placed waypoints replace it entirely. */
  const pathVia = (mid: THREE.Vector3 | null): THREE.Vector3[] => {
    const pts: THREE.Vector3[] = [a.pos.clone()]
    if (outA > 0.05) pts.push(a.pos.clone().addScaledVector(a.dir, outA))
    if (waypoints?.length) for (const w of waypoints) pts.push(w.clone())
    else if (mid) pts.push(mid)
    if (outB > 0.05) pts.push(b.pos.clone().addScaledVector(b.dir, outB))
    pts.push(b.pos.clone())
    return pts
  }

  // Somebody routed this by hand. That is the route.
  if (waypoints?.length) return pathVia(null)

  const natural = Math.min(span * SAG_FRACTION, SAG_MAX)
  const centre = a.pos.clone().add(b.pos).multiplyScalar(0.5)
  const ceiling = natural + span * MAX_BOW
  const at = (dir: THREE.Vector3, reach: number): THREE.Vector3[] =>
    pathVia(centre.clone().addScaledVector(dir, reach))

  const dirs = bowDirections(travel)
  const ordinary = at(dirs[0], natural)
  let best = { pts: ordinary, bad: intrusion(ordinary, obstacles, skip) }
  if (best.bad <= 0) return best.pts

  for (const dir of dirs) {
    /* The computed distance first, then a little more each time: how far is
       needed depends on where the drawn curve bulges, not on where the
       control point is, and a spline falls short of its control point by an
       amount that depends on the spacing of the rest. */
    const want = Math.max(reachFor(a, b, dir, obstacles, skip), natural)
    for (const slack of [1.35, 1.8, 2.4, 3.2, 4.4]) {
      const reach = Math.min(want * slack, ceiling)
      const pts = at(dir, reach)
      const bad = intrusion(pts, obstacles, skip)
      if (bad <= 0) return pts
      if (bad < best.bad) best = { pts, bad }
      if (reach >= ceiling) break
    }
  }
  return best.pts
}

export function wireCurve(
  a: WireEnd,
  b: WireEnd,
  waypoints?: THREE.Vector3[],
  obstacles: Obstacle[] = [],
  skip: readonly string[] = [],
): THREE.CatmullRomCurve3 {
  /*
   * Centripetal parameterisation, and a low tension.
   *
   * Centripetal is the one Catmull-Rom variant that cannot form a cusp or a
   * self-intersection however the control points are spaced, which matters
   * because they are spaced by whatever the person wiring this up did. The
   * tension then decides how far the curve bows away from the points between
   * them; 0.4 is slack enough to read as wire and tight enough not to bulge
   * past the terminals.
   */
  return new THREE.CatmullRomCurve3(wirePoints(a, b, waypoints, obstacles, skip), false, 'centripetal', 0.4)
}

/**
 * How far past its own endpoints a curve travels, in millimetres.
 *
 * Measured along the line joining them: a wire that leaves the terminal, goes
 * beyond it, and comes back reads as passing through whatever is on the far
 * side. Zero means every point on the wire lies between the two pins.
 */
export function overshoot(curve: THREE.CatmullRomCurve3, a: THREE.Vector3, b: THREE.Vector3, samples = 80): number {
  const axis = b.clone().sub(a)
  const span = axis.length()
  if (span < 1e-6) return 0
  axis.divideScalar(span)
  let worst = 0
  for (let i = 0; i <= samples; i++) {
    const t = curve.getPoint(i / samples).sub(a).dot(axis)
    worst = Math.max(worst, -t, t - span)
  }
  return worst
}
