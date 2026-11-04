import type { Vec3 } from '@/parts/kernel/types'

/**
 * Where the camera is looking, for the parts of the editor outside the canvas.
 *
 * The library panel is a plain React tree with no access to the orbit
 * controls, so a part placed from it used to land in a spiral around the
 * world origin. That is fine for the first few parts of an empty bench and
 * wrong everywhere else: pan across a room to work on the far corner of it,
 * click a part, and the part appears at the origin — off screen, behind you,
 * in the middle of something else.
 *
 * The viewport publishes its orbit target here on every camera change, and
 * whatever places a part reads it. Deliberately a module variable rather than
 * store state: it changes on every frame of a drag, and putting that through
 * a zustand store would re-render the whole interface sixty times a second to
 * tell it something only one click ever asks about.
 */

let anchor: Vec3 = [0, 0, 0]
let live = false

export function publishAnchor(x: number, y: number, z: number): void {
  anchor = [x, y, z]
  live = true
}

/** The orbit centre, or null when no viewport has reported one yet. */
export function cameraAnchor(): Vec3 | null {
  return live ? ([...anchor] as Vec3) : null
}

/** Forget the published anchor. The viewport calls this as it unmounts. */
export function clearAnchor(): void {
  live = false
  anchor = [0, 0, 0]
}
