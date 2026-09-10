import * as THREE from 'three'
import type { Instance, MateType, Port, Vec3 } from '@/parts/kernel/types'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { PortIndex, type WorldPort } from './portIndex'
import type { Doc } from '@/state/doc'

/**
 * Snapping while a part is being dragged.
 *
 * The point of this is that a build should come together by being moved near
 * the right place, not by being typed into the right place. A lead finds a
 * breadboard hole, a screw finds a tapped end, a T-nut finds a slot, and the
 * part visibly jumps the last millimetre so you can see it took.
 *
 * The work is arranged so the per-frame cost is small: everything that is not
 * moving is indexed once when the drag starts, and each frame only the dragged
 * part's own terminals are transformed and looked up.
 */

/** How close two terminals must be before they snap, mm. */
export const SNAP_RADIUS = 9

/** Which mate types will accept which. */
const MATE_ACCEPTS: Record<MateType, MateType[]> = {
  hole: ['stud', 'thread', 'hole'],
  thread: ['stud', 'hole'],
  stud: ['hole', 'thread', 'tslot'],
  tslot: ['stud', 'tslot'],
  face: ['face'],
  rail: ['rail'],
  peg: ['peg'],
  socket: ['socket'],
  dimm: ['dimm'],
  pcie: ['pcie'],
  m2: ['m2'],
  standoff: ['standoff', 'hole'],
}

/** Sizes have to be in the same family, so an M3 screw skips an M8 hole. */
function sizesAgree(a?: number, b?: number): boolean {
  if (a === undefined || b === undefined) return true
  const big = Math.max(a, b)
  return big <= 0 || Math.abs(a - b) / big <= 0.4
}

/**
 * Whether two terminals can join.
 *
 * Both cases require the terminals to face each other. A lead points down out
 * of a part and a breadboard hole points up, so opposing directions is what
 * separates a lead going into a hole from two leads lying side by side.
 */
export function canSnap(moving: Port, target: Port): boolean {
  if (moving.kind !== target.kind) return false
  if (moving.kind === 'electrical') return true
  const a = moving.mate
  const b = target.mate
  if (!a || !b) return false
  if (!MATE_ACCEPTS[a.type]?.includes(b.type)) return false
  // Where both sides name a standard, they have to name the same one. This is
  // what stops a DDR4 stick going into a DDR5 slot that is the same length.
  if (a.key && b.key && a.key !== b.key) return false
  return sizesAgree(a.size, b.size)
}

export interface SnapHit {
  /** Translation to add to everything being dragged. */
  offset: THREE.Vector3
  /** Where the join happens, world space. */
  at: THREE.Vector3
  movingInstance: string
  movingPort: string
  targetInstance: string
  targetPort: string
  targetLabel: string
  distance: number
  kind: 'electrical' | 'mechanical'
}

interface MovingPart {
  id: string
  /** Local port positions, already rotated but not translated. */
  ports: { port: Port; local: THREE.Vector3; dir: THREE.Vector3 }[]
  /** Position at the moment the drag started. */
  origin: Vec3
}

export class SnapSession {
  private readonly moving: MovingPart[] = []
  private readonly index: PortIndex

  constructor(doc: Doc, movingIds: string[]) {
    const still: Instance[] = []
    const set = new Set(movingIds)
    for (const id of doc.order) {
      const inst = doc.instances[id]
      if (!inst) continue
      if (!set.has(id)) {
        still.push(inst)
        continue
      }
      const def = getPart(inst.defId)
      if (!def) continue
      const built = buildPart(def, inst.params)
      // Rotation is fixed for the duration of a move, so bake it once.
      const rot = new THREE.Matrix3().setFromMatrix4(instanceMatrix([0, 0, 0], inst.rot))
      this.moving.push({
        id,
        origin: [...inst.pos] as Vec3,
        ports: built.ports.map((port) => ({
          port,
          local: new THREE.Vector3(...port.pos).applyMatrix3(rot),
          dir: new THREE.Vector3(...port.dir).applyMatrix3(rot).normalize(),
        })),
      })
    }
    this.index = new PortIndex(still)
  }

  get isEmpty(): boolean {
    return this.moving.length === 0
  }

  /**
   * The best snap for a proposed translation, or null.
   *
   * `delta` is where the drag has taken the selection so far. The returned
   * offset is the extra nudge that lands the terminals on each other.
   */
  solve(delta: THREE.Vector3, radius = SNAP_RADIUS): SnapHit | null {
    let best: SnapHit | null = null
    const world = new THREE.Vector3()

    for (const part of this.moving) {
      for (const mp of part.ports) {
        world.set(
          part.origin[0] + delta.x + mp.local.x,
          part.origin[1] + delta.y + mp.local.y,
          part.origin[2] + delta.z + mp.local.z,
        )
        const target = this.index.nearest(
          world,
          radius,
          (q: WorldPort) => canSnap(mp.port, q.port) && q.dir.dot(mp.dir) < -0.4,
        )
        if (!target) continue
        const d = target.pos.distanceTo(world)
        if (best && d >= best.distance) continue
        best = {
          offset: target.pos.clone().sub(world),
          at: target.pos.clone(),
          movingInstance: part.id,
          movingPort: mp.port.id,
          targetInstance: target.instanceId,
          targetPort: target.portId,
          targetLabel: target.port.label,
          distance: d,
          kind: mp.port.kind,
        }
      }
    }
    return best
  }
}
