import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Vec3 } from '@/parts/kernel/types'
import { useDoc } from '@/state/doc'
import { SnapSession, type SnapHit } from './snap'
import { snapStore } from './SnapIndicator'
import { wasClick } from './pointer'

/**
 * Dragging a part with the mouse.
 *
 * Before this, pressing on a part handed the gesture to the orbit controls:
 * selecting something swung the camera a few degrees, and trying to drag a
 * part spun the whole scene instead. The gizmo was the only way to move
 * anything, which is a fine second way and a poor only way.
 *
 * The rule now is simply which thing you pressed on. Press on a part and the
 * gesture belongs to the part: it never moves the camera, and past the click
 * threshold it moves the part. Press on empty space, or use the right or
 * middle button anywhere, and the gesture belongs to the camera as before.
 *
 * Movement is solved on a horizontal plane through the point you grabbed, so
 * a part slides across the bench at the height it was already at rather than
 * diving toward the camera. Snapping is the same code the gizmo uses, so a
 * lead dropped near a hole lands in it either way.
 */

export interface DragState {
  ids: string[]
  /** Plane the pointer is solved against, through the grab point. */
  plane: THREE.Plane
  /** Where on that plane the gesture started. */
  from: THREE.Vector3
  origin: { id: string; pos: Vec3 }[]
  session: SnapSession | null
  hit: SnapHit | null
  /** False until the pointer has travelled far enough to be a drag. */
  live: boolean
}

/** Begin a potential drag. Returns null when there is nothing draggable. */
export function beginDrag(ids: string[], grabPoint: THREE.Vector3): DragState | null {
  const doc = useDoc.getState().doc
  const origin = ids
    .map((id) => doc.instances[id])
    .filter((i) => i && !i.locked)
    .map((i) => ({ id: i.id, pos: [...i.pos] as Vec3 }))
  if (!origin.length) return null

  return {
    ids,
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -grabPoint.y),
    from: grabPoint.clone(),
    origin,
    session: null,
    hit: null,
    live: false,
  }
}

/**
 * Advance a drag from a pointer position. Returns true once the gesture has
 * committed to being a drag rather than a click.
 */
export function updateDrag(
  drag: DragState,
  raycaster: THREE.Raycaster,
  controls: OrbitControlsImpl | null,
): boolean {
  const point = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(drag.plane, point)) return drag.live

  if (!drag.live) {
    // The same threshold the click-versus-drag guard uses, so a part cannot
    // start moving on a gesture the rest of the app still calls a click.
    if (wasClick()) return false
    drag.live = true
    if (controls) controls.enabled = false
    const { snap } = useDoc.getState()
    useDoc.getState().beginEdit()
    drag.session = snap.enabled && snap.ports ? new SnapSession(useDoc.getState().doc, drag.ids) : null
  }

  const delta = point.sub(drag.from)
  // Horizontal only: the grab plane is level, so this is belt and braces
  // against a near-parallel ray solving to a point far off the plane.
  delta.y = 0

  const { snap } = useDoc.getState()
  if (snap.enabled && snap.grid > 0) {
    delta.x = Math.round(delta.x / snap.grid) * snap.grid
    delta.z = Math.round(delta.z / snap.grid) * snap.grid
  }

  // Terminals win over the grid, exactly as they do under the gizmo.
  const hit = drag.session?.solve(delta) ?? null
  drag.hit = hit
  snapStore.set(hit)
  if (hit) delta.add(hit.offset)

  useDoc.getState().transformInstances(
    drag.origin.map((o) => ({
      id: o.id,
      pos: [o.pos[0] + delta.x, o.pos[1] + delta.y, o.pos[2] + delta.z] as Vec3,
    })),
    false,
  )
  return true
}

/** Finish a drag, recording any mechanical mate it landed on. */
export function endDrag(drag: DragState, controls: OrbitControlsImpl | null): void {
  if (controls) controls.enabled = true
  const hit = drag.hit
  if (drag.live && hit && hit.kind === 'mechanical') {
    useDoc.getState().connect(
      { instanceId: hit.movingInstance, portId: hit.movingPort },
      { instanceId: hit.targetInstance, portId: hit.targetPort },
      { kind: 'mate' },
    )
  }
  snapStore.set(null)
}
