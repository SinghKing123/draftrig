import * as THREE from 'three'
import { create } from 'zustand'
import { buildPart, defaultParams, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { useDoc } from '@/state/doc'

/**
 * The ruler.
 *
 * Everything else in the editor answers a question you have to ask it
 * properly: place a part and read its inspector, wire a circuit and run
 * it. The question people actually ask of a drawing first is how far it
 * is from here to there, and there was no way to ask it.
 *
 * Two points and the distance between them, with the per-axis gaps,
 * because "1.9 m" is rarely the whole answer — what you usually want is
 * that it is 1.9 m away and 300 mm of that is height.
 *
 * Points snap to the corners and terminals of whatever is under the
 * pointer. A measurement taken by eye on a perspective projection is
 * worth nothing: the surface under your cursor is somewhere between the
 * near face and the far one, and which one you got depends on the
 * camera. Snapping to a corner means the number is the model's, not the
 * screen's.
 */

export interface RulerState {
  /** Whether the tool has the pointer. */
  on: boolean
  from: THREE.Vector3 | null
  to: THREE.Vector3 | null
  setOn: (v: boolean) => void
  toggle: () => void
  /** Drop the next point: first, second, then start again. */
  place: (p: THREE.Vector3) => void
  clear: () => void
}

export const useRuler = create<RulerState>((set, get) => ({
  on: false,
  from: null,
  to: null,
  setOn: (v) => set(v ? { on: true } : { on: false, from: null, to: null }),
  toggle: () => get().setOn(!get().on),
  place: (p) =>
    set((s) =>
      // A third click starts the next measurement rather than doing
      // nothing, which is what a tape measure does and what the hand
      // expects. Clearing first would blink the old line out for a frame.
      s.from && s.to ? { from: p.clone(), to: null } : s.from ? { to: p.clone() } : { from: p.clone() },
    ),
  clear: () => set({ from: null, to: null }),
}))

/* ------------------------------------------------------------------ */

/** Corners, face centres and the middle of one instance's box. */
function boxPoints(box: THREE.Box3): THREE.Vector3[] {
  const { min, max } = box
  const mid = box.getCenter(new THREE.Vector3())
  const out: THREE.Vector3[] = []
  for (const x of [min.x, mid.x, max.x]) {
    for (const y of [min.y, mid.y, max.y]) {
      for (const z of [min.z, mid.z, max.z]) out.push(new THREE.Vector3(x, y, z))
    }
  }
  return out
}

/**
 * Points worth snapping to on one instance.
 *
 * The box's corners, edge and face middles, and every terminal. Twenty
 * seven points from the box is more than it sounds — it is every corner,
 * every edge centre, every face centre and the middle — and between them
 * they cover nearly everything anybody wants to measure from.
 */
export function snapPoints(instanceId: string): THREE.Vector3[] {
  const inst = useDoc.getState().doc.instances[instanceId]
  if (!inst || inst.hidden) return []
  const def = getPart(inst.defId)
  if (!def) return []
  const built = buildPart(def, inst.params)
  if (built.bbox.isEmpty()) return []
  const m = instanceMatrix(inst.pos, inst.rot)
  const out = boxPoints(built.bbox).map((q) => q.applyMatrix4(m))
  try {
    for (const port of def.ports({ ...defaultParams(def), ...inst.params })) {
      out.push(new THREE.Vector3(port.pos[0], port.pos[1], port.pos[2]).applyMatrix4(m))
    }
  } catch {
    /* A part whose ports throw on these params still has a box worth
       measuring, and the ruler is no place to surface that. */
  }
  return out
}

/**
 * The nearest snap point to where the pointer is, in screen pixels.
 *
 * Screen distance rather than world distance, because the tolerance has
 * to mean the same thing to the hand at every zoom: 18 px away is 18 px
 * away whether the part is 4 mm or 4 m across.
 */
export function nearestSnap(
  candidates: THREE.Vector3[],
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  size: { width: number; height: number },
  withinPx = 18,
): THREE.Vector3 | null {
  let best: THREE.Vector3 | null = null
  let bestPx = withinPx
  const v = new THREE.Vector3()
  for (const c of candidates) {
    v.copy(c).project(camera)
    if (v.z > 1) continue
    const dx = ((v.x + 1) / 2) * size.width - pointer.x
    const dy = ((1 - v.y) / 2) * size.height - pointer.y
    const px = Math.hypot(dx, dy)
    if (px < bestPx) {
      bestPx = px
      best = c
    }
  }
  return best ? best.clone() : null
}

/** A length in the clearest unit for its size. */
export function readLength(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(mm >= 10000 ? 2 : 3)} m`
  if (mm >= 10) return `${mm.toFixed(mm >= 100 ? 0 : 1)} mm`
  return `${mm.toFixed(2)} mm`
}
