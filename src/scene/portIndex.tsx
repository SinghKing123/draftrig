import { createContext, useContext, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Instance, Port, PortKind } from '@/parts/kernel/types'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import { useDoc } from '@/state/doc'

export interface WorldPort {
  instanceId: string
  portId: string
  port: Port
  pos: THREE.Vector3
  dir: THREE.Vector3
  /**
   * The other end of the pin: where the terminal's own ray, run backwards,
   * leaves the part it belongs to. See farEnd below for why it is worth
   * having.
   */
  back: THREE.Vector3
}

/**
 * Where a terminal comes out the other side.
 *
 * Nearly every through-hole part puts its terminals at the tips of its leads,
 * pointing down — pinPort in the catalog helpers is literally [x, -1.6, z]
 * facing DOWN — because that is where the joint is made. Mark only that point
 * and, the moment the part is seated in a board, every terminal it has is
 * underneath 1.6 mm of FR-4, and the camera cannot go below the horizon to
 * look at them. Wiring up a chip meant clicking dots you could not see.
 *
 * A pin has two ends, so both get marked. The far one is found by running the
 * terminal's ray backwards until it leaves the part's own bounding box, which
 * for a lead in a board is the top of the body — above the board, in the
 * open, right over the lead it belongs to. A single fixed offset cannot do
 * this: across the parts in one small build the terminals sit anywhere from
 * 2.25 mm below the board to on top of it, so any constant either buries some
 * of them or floats the rest.
 */
const STANDOFF = 0.3
const MIN_SPAN = 1.0
const MAX_SPAN = 24

function farEnd(box: THREE.Box3, from: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
  const out = from.clone()
  if (box.isEmpty()) return out.addScaledVector(dir, 2)
  // Slab test, kept to the axes the ray actually moves along.
  let t = Infinity
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = dir[axis]
    if (Math.abs(d) < 1e-6) continue
    const edge = d > 0 ? box.max[axis] : box.min[axis]
    const hit = (edge - from[axis]) / d
    if (hit > 0) t = Math.min(t, hit)
  }
  if (!Number.isFinite(t)) t = 2
  return out.addScaledVector(dir, Math.min(Math.max(t, MIN_SPAN), MAX_SPAN) + STANDOFF)
}

const CELL = 12 // mm, spatial hash cell, a little larger than a wire pitch

/**
 * World-space index of every port in the document.
 *
 * A full breadboard contributes hundreds of terminals, so snapping and picking
 * go through a uniform spatial hash instead of scanning the list.
 */
export class PortIndex {
  private byInstance = new Map<string, Map<string, WorldPort>>()
  private grid = new Map<string, WorldPort[]>()
  readonly list: WorldPort[] = []

  constructor(instances: Instance[]) {
    for (const inst of instances) {
      if (inst.hidden) continue
      const def = getPart(inst.defId)
      if (!def) continue
      const built = buildPart(def, inst.params)
      const m = instanceMatrix(inst.pos, inst.rot)
      const rot = new THREE.Matrix3().setFromMatrix4(m)
      const map = new Map<string, WorldPort>()
      for (const port of built.ports) {
        const local = new THREE.Vector3(...port.pos)
        const localDir = new THREE.Vector3(...port.dir).normalize()
        const wp: WorldPort = {
          instanceId: inst.id,
          portId: port.id,
          port,
          pos: local.clone().applyMatrix4(m),
          dir: new THREE.Vector3(...port.dir).applyMatrix3(rot).normalize(),
          back: farEnd(built.bbox, local, localDir.clone().negate()).applyMatrix4(m),
        }
        map.set(port.id, wp)
        this.list.push(wp)
        const k = this.cellKey(wp.pos)
        const bucket = this.grid.get(k)
        if (bucket) bucket.push(wp)
        else this.grid.set(k, [wp])
      }
      this.byInstance.set(inst.id, map)
    }
  }

  private cellKey(p: THREE.Vector3): string {
    return `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)},${Math.floor(p.z / CELL)}`
  }

  get(instanceId: string, portId: string): WorldPort | undefined {
    return this.byInstance.get(instanceId)?.get(portId)
  }

  ofInstance(instanceId: string): WorldPort[] {
    const m = this.byInstance.get(instanceId)
    return m ? [...m.values()] : []
  }

  /** Nearest port to `point` within `radius` mm, optionally filtered. */
  nearest(point: THREE.Vector3, radius: number, filter?: (p: WorldPort) => boolean): WorldPort | null {
    const r = Math.ceil(radius / CELL)
    const cx = Math.floor(point.x / CELL)
    const cy = Math.floor(point.y / CELL)
    const cz = Math.floor(point.z / CELL)
    let best: WorldPort | null = null
    let bestDist = radius * radius
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let z = cz - r; z <= cz + r; z++) {
          const bucket = this.grid.get(`${x},${y},${z}`)
          if (!bucket) continue
          for (const wp of bucket) {
            if (filter && !filter(wp)) continue
            const d = wp.pos.distanceToSquared(point)
            if (d < bestDist) {
              bestDist = d
              best = wp
            }
          }
        }
      }
    }
    return best
  }

  /** All ports of a kind, for rendering markers. */
  ofKind(kind: PortKind): WorldPort[] {
    return this.list.filter((p) => p.port.kind === kind)
  }
}

const Ctx = createContext<PortIndex>(new PortIndex([]))

export function PortIndexProvider({ children }: { children: ReactNode }) {
  const instances = useDoc((s) => s.doc.instances)
  const order = useDoc((s) => s.doc.order)
  const index = useMemo(
    () => new PortIndex(order.map((id) => instances[id]).filter(Boolean)),
    [instances, order],
  )
  return <Ctx.Provider value={index}>{children}</Ctx.Provider>
}

export const usePortIndex = (): PortIndex => useContext(Ctx)
