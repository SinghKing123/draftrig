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

/**
 * Control points for the wire, in order.
 *
 * Two rules, and between them they are the whole fix:
 *
 * A wire may only leave a terminal along the terminal's own normal, and only
 * as far as it is going in total. The launch used to be a flat fraction of the
 * straight-line distance, which is fine until the normals point away from each
 * other: then both ends shoot outward, the curve has to turn around to get
 * back, and it overshoots the pin it was going to — the wire visibly reaches
 * past the hole and returns. Projecting the launch onto the direction of
 * travel, and refusing to launch backwards, removes that case entirely.
 *
 * And the arch is always up. It was already meant to be, but it was applied to
 * the midpoint of a curve that the launches had already pulled somewhere else,
 * so on a pair of downward-facing pins — which is nearly every through-hole
 * part, seated — the two effects cancelled and the wire sagged down through
 * the board instead of arching over it.
 */
export function wirePoints(a: WireEnd, b: WireEnd, waypoints?: THREE.Vector3[]): THREE.Vector3[] {
  const span = a.pos.distanceTo(b.pos)
  const pts: THREE.Vector3[] = [a.pos.clone()]

  if (span < MIN_ARCH) {
    // Two holes apart. A straight hop, so it cannot loop.
    if (waypoints?.length) for (const w of waypoints) pts.push(w.clone())
    pts.push(b.pos.clone())
    return pts
  }

  const travel = b.pos.clone().sub(a.pos).normalize()
  const launch = (end: WireEnd, toward: THREE.Vector3): number => {
    // Only the part of the normal that makes progress counts. A pin facing
    // straight back down the wire gets no launch at all rather than a
    // negative one.
    const along = Math.max(end.dir.dot(toward), 0)
    return Math.min(LAUNCH_MAX, span * LAUNCH_FRACTION) * along
  }

  const outA = launch(a, travel)
  if (outA > 0.05) pts.push(a.pos.clone().addScaledVector(a.dir, outA))

  if (waypoints?.length) {
    for (const w of waypoints) pts.push(w.clone())
  } else {
    // The arch, measured from the straight line rather than from whatever the
    // launches did, and always upward in world space.
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5)
    mid.y += Math.min(span * SAG_FRACTION, SAG_MAX)
    pts.push(mid)
  }

  const outB = launch(b, travel.clone().negate())
  if (outB > 0.05) pts.push(b.pos.clone().addScaledVector(b.dir, outB))

  pts.push(b.pos.clone())
  return pts
}

export function wireCurve(a: WireEnd, b: WireEnd, waypoints?: THREE.Vector3[]): THREE.CatmullRomCurve3 {
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
  return new THREE.CatmullRomCurve3(wirePoints(a, b, waypoints), false, 'centripetal', 0.4)
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
