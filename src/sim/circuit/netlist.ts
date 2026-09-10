import * as THREE from 'three'
import { Circuit, GROUND, isFromVf, type SolvedDevice, type WaveSpec } from './mna'
import type { Connection, DeviceModel, Instance, Port } from '@/parts/kernel/types'
import { getPart } from '@/parts/kernel/registry'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { awgToMm2, wireResistance } from '@/parts/kernel/units'
import { HI_Z } from '@/sim/behaviour'
import type { Doc } from '@/state/doc'

/** Stable key for one electrical terminal. */
export const portKey = (instanceId: string, portId: string): string => `${instanceId}:${portId}`

/* ------------------------------------------------------------------ */
/* Union-find                                                          */
/* ------------------------------------------------------------------ */

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
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

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

/* ------------------------------------------------------------------ */
/* Netlist                                                             */
/* ------------------------------------------------------------------ */

export interface DeviceRef {
  /** Index in Circuit.devices. */
  index: number
  instanceId: string
  model: DeviceModel
  /** Set for LEDs so the renderer can drive emission. */
  luminous?: boolean
}

export interface WireRef {
  connectionId: string
  index: number
  lengthMm: number
  ampacity: number
}

/** One behavioural part, bound to the devices that let it drive its pins. */
export interface BehaviourBinding {
  instanceId: string
  evalId: string
  params: import('@/parts/kernel/types').Params
  /** Node the part's outputs are referenced to (its own ground pin). */
  refNode: number
  pins: {
    id: string
    node: number
    /** Index of the pin's conductance to the part's reference. */
    rIndex: number
    /** Index of the current source across it. */
    iIndex: number
  }[]
}

export interface Netlist {
  circuit: Circuit
  /** Terminal key -> node index (GROUND for the reference node). */
  nodeOf: Map<string, number>
  devices: DeviceRef[]
  wires: WireRef[]
  behaviours: BehaviourBinding[]
  /** Node index -> the terminals sharing it, for probe labelling. */
  netMembers: Map<number, string[]>
  warnings: string[]
  errors: string[]
}

interface PendingDevice {
  instanceId: string
  model: DeviceModel
  /** Terminal keys, in the order the solved device consumes them. */
  build: (nodeOf: (key: string) => number, addNode: (key: string) => number) => SolvedDevice[]
  luminous?: boolean
  /** Set for behavioural parts so their pin sources can be found afterwards. */
  behaviour?: { evalId: string; pins: string[]; ref?: string; params: import('@/parts/kernel/types').Params }
}

/** World-space port positions for an instance, used for wire lengths. */
export function worldPorts(inst: Instance): Map<string, THREE.Vector3> {
  const def = getPart(inst.defId)
  const out = new Map<string, THREE.Vector3>()
  if (!def) return out
  const built = buildPart(def, inst.params)
  const m = instanceMatrix(inst.pos, inst.rot)
  for (const p of built.ports) {
    out.set(p.id, new THREE.Vector3(...p.pos).applyMatrix4(m))
  }
  return out
}

export function portsOf(inst: Instance): Port[] {
  const def = getPart(inst.defId)
  if (!def) return []
  return buildPart(def, inst.params).ports
}

function toWaveSpec(w: NonNullable<Extract<DeviceModel, { type: 'vsource' }>['wave']>): WaveSpec {
  return {
    shape: w.shape,
    amp: w.amp ?? 1,
    freq: w.freq ?? 50,
    offset: w.offset ?? 0,
    duty: w.duty ?? 0.5,
    phase: w.phase ?? 0,
  }
}

/**
 * Compile a document into a solvable circuit.
 *
 * Terminals that share a `groupId` inside one part are the same node (that is
 * how a breadboard column or a tactile switch's paired pins behave). Explicit
 * wires are *not* merged, they become small resistors, so the solver reports
 * a real current through every wire and a real drop along it.
 */
export function buildNetlist(doc: Doc): Netlist {
  const uf = new UnionFind()
  const warnings: string[] = []
  const errors: string[] = []

  const instances = doc.order.map((id) => doc.instances[id]).filter(Boolean)

  // 1. Internal groups.
  const portCache = new Map<string, Port[]>()
  for (const inst of instances) {
    const ports = portsOf(inst)
    portCache.set(inst.id, ports)
    const groups = new Map<string, string>()
    for (const p of ports) {
      if (p.kind !== 'electrical') continue
      const key = portKey(inst.id, p.id)
      uf.find(key)
      if (!p.groupId) continue
      const seen = groups.get(p.groupId)
      if (seen) uf.union(seen, key)
      else groups.set(p.groupId, key)
    }
  }

  // 2. Devices contributed by each part.
  const pending: PendingDevice[] = []
  for (const inst of instances) {
    const def = getPart(inst.defId)
    if (!def?.electrical) continue
    for (const model of def.electrical.devices(inst.params)) {
      pending.push(compileDevice(inst, model))
    }
  }

  // 3. Wires.
  const connections = doc.connectionOrder.map((id) => doc.connections[id]).filter(Boolean)
  const worldCache = new Map<string, Map<string, THREE.Vector3>>()
  const worldOf = (instId: string): Map<string, THREE.Vector3> => {
    let m = worldCache.get(instId)
    if (!m) {
      const inst = doc.instances[instId]
      m = inst ? worldPorts(inst) : new Map()
      worldCache.set(instId, m)
    }
    return m
  }

  const electricalWires: { conn: Connection; lengthMm: number }[] = []
  for (const c of connections) {
    if (c.kind !== 'wire') continue
    const pa = portCache.get(c.a.instanceId)?.find((p) => p.id === c.a.portId)
    const pb = portCache.get(c.b.instanceId)?.find((p) => p.id === c.b.portId)
    if (!pa || !pb) continue
    if (pa.kind !== 'electrical' || pb.kind !== 'electrical') continue
    const wa = worldOf(c.a.instanceId).get(c.a.portId)
    const wb = worldOf(c.b.instanceId).get(c.b.portId)
    let len = wa && wb ? wa.distanceTo(wb) : 50
    for (let i = 0; c.waypoints && i < c.waypoints.length; i++) len += 20
    electricalWires.push({ conn: c, lengthMm: Math.max(len * 1.15, 5) })
  }

  // 4. Reference node.
  //
  // A Ground part only counts if something is actually wired to it. Taking an
  // unconnected one as the reference would leave the entire real circuit
  // floating, and every reading would be meaningless.
  const wiredRoots = new Set<string>()
  for (const { conn } of electricalWires) {
    wiredRoots.add(uf.find(portKey(conn.a.instanceId, conn.a.portId)))
    wiredRoots.add(uf.find(portKey(conn.b.instanceId, conn.b.portId)))
  }

  let groundKey: string | null = null
  let strandedGround = false
  for (const inst of instances) {
    if (inst.defId !== 'ground') continue
    const key = portKey(inst.id, 'gnd')
    if (wiredRoots.has(uf.find(key))) {
      groundKey = key
      break
    }
    strandedGround = true
  }
  if (strandedGround && !groundKey) {
    warnings.push('The Ground part is not connected to anything, wire it to your supply’s negative terminal.')
  }

  if (!groundKey) {
    // Fall back to the negative terminal of the first source in the document.
    const src = pending.find((p) => p.model.type === 'vsource')
    if (src && src.model.type === 'vsource') {
      groundKey = portKey(src.instanceId, src.model.b)
      if (!strandedGround) {
        warnings.push('No ground part found, using the first source’s negative terminal as 0 V.')
      }
    }
  }

  if (!groundKey) {
    /*
     * Still nothing, which happens whenever the only supply is a board rather
     * than a bench source: a microcontroller's 5 V pin is a behavioural output,
     * not a voltage source, so there is no negative terminal to find.
     *
     * Take the net that the most ground pins agree on. That is what makes a
     * board's GND the reference on a real bench, and without it a perfectly
     * sensible build (a board, a display, no ground symbol anywhere) is a
     * circuit whose absolute level nothing pins down. The solver can only
     * settle such a thing to within an arbitrary constant, so every node drifts
     * by the same amount on every iteration and Newton never converges.
     */
    const gndVotes = new Map<string, { key: string; votes: number }>()
    for (const inst of instances) {
      for (const port of portCache.get(inst.id) ?? []) {
        if (port.kind !== 'electrical' || port.role !== 'gnd') continue
        const key = portKey(inst.id, port.id)
        const root = uf.find(key)
        const entry = gndVotes.get(root)
        if (entry) entry.votes++
        else gndVotes.set(root, { key, votes: 1 })
      }
    }
    let best: { key: string; votes: number } | null = null
    for (const entry of gndVotes.values()) {
      if (!best || entry.votes > best.votes) best = entry
    }
    if (best) groundKey = best.key
  }

  if (!groundKey && pending.length) {
    // A circuit with no ground pin anywhere at all. Anchor it to something so
    // the numbers mean something, and say so rather than silently guessing.
    const anyBehaviour = pending.find((p) => p.behaviour?.ref)
    if (anyBehaviour?.behaviour?.ref) {
      groundKey = portKey(anyBehaviour.instanceId, anyBehaviour.behaviour.ref)
      warnings.push('Nothing in this circuit is marked as ground, so voltages are measured against ' +
        `${anyBehaviour.instanceId === '' ? 'a part' : 'the first part'}'s reference pin. Add a Ground part to choose the reference yourself.`)
    }
  }

  // 5. Assign node indices.
  const nodeOf = new Map<string, number>()
  let nextNode = 0
  const groundRoot = groundKey ? uf.find(groundKey) : null

  const nodeFor = (key: string): number => {
    const root = uf.find(key)
    if (groundRoot !== null && root === groundRoot) {
      nodeOf.set(key, GROUND)
      return GROUND
    }
    const existing = nodeOf.get(root)
    if (existing !== undefined) {
      nodeOf.set(key, existing)
      return existing
    }
    const idx = nextNode++
    nodeOf.set(root, idx)
    nodeOf.set(key, idx)
    return idx
  }

  /** Anonymous internal node (diode series R, source resistance, ESR). */
  const addNode = (key: string): number => {
    const existing = nodeOf.get(key)
    if (existing !== undefined) return existing
    const idx = nextNode++
    nodeOf.set(key, idx)
    return idx
  }

  // 6. Build solved devices.
  const solved: SolvedDevice[] = []
  const deviceRefs: DeviceRef[] = []
  const behaviours: BehaviourBinding[] = []
  for (const p of pending) {
    const base = solved.length
    const built = p.build(nodeFor, addNode)
    for (const d of built) {
      deviceRefs.push({ index: solved.length, instanceId: p.instanceId, model: p.model, luminous: p.luminous })
      solved.push(d)
    }
    if (p.behaviour) {
      // build() emitted, per pin and in order: the conductance to the part's
      // reference, then the current source across it.
      behaviours.push({
        instanceId: p.instanceId,
        evalId: p.behaviour.evalId,
        params: p.behaviour.params,
        refNode: p.behaviour.ref ? nodeFor(portKey(p.instanceId, p.behaviour.ref)) : GROUND,
        pins: p.behaviour.pins.map((id, i) => ({
          id,
          node: nodeFor(portKey(p.instanceId, id)),
          rIndex: base + i * 2,
          iIndex: base + i * 2 + 1,
        })),
      })
    }
  }

  const wireRefs: WireRef[] = []
  for (const { conn, lengthMm } of electricalWires) {
    const a = nodeFor(portKey(conn.a.instanceId, conn.a.portId))
    const b = nodeFor(portKey(conn.b.instanceId, conn.b.portId))
    const mm2 = conn.gauge ?? awgToMm2(24)
    const r = Math.max(wireResistance(lengthMm, mm2), 1e-4)
    wireRefs.push({ connectionId: conn.id, index: solved.length, lengthMm, ampacity: 6 * mm2 })
    solved.push({ k: 'r', a, b, r })
  }

  // 7. Diagnostics.
  if (!groundKey && solved.length) {
    errors.push('This circuit has no 0 V reference. Add a Ground part or connect a supply’s negative terminal.')
  }
  if (!pending.some((p) => p.model.type === 'vsource') && solved.length) {
    warnings.push('No power source in the circuit, every node will read 0 V.')
  }

  const netMembers = new Map<number, string[]>()
  for (const [key, node] of nodeOf) {
    if (!key.includes(':')) continue
    const list = netMembers.get(node)
    if (list) list.push(key)
    else netMembers.set(node, [key])
  }

  return {
    circuit: new Circuit(nextNode, solved),
    nodeOf,
    devices: deviceRefs,
    wires: wireRefs,
    behaviours,
    netMembers,
    warnings,
    errors,
  }
}

/* ------------------------------------------------------------------ */
/* Device compilation                                                  */
/* ------------------------------------------------------------------ */

function compileDevice(inst: Instance, model: DeviceModel): PendingDevice {
  const t = (portId: string): string => (portId.startsWith('#') ? `${inst.id}${portId}` : portKey(inst.id, portId))
  const iid = inst.id

  return {
    instanceId: iid,
    model,
    luminous: model.type === 'diode' ? model.luminous : undefined,
    behaviour:
      model.type === 'behavioral'
        ? { evalId: model.evalId, pins: model.pins, ref: model.ref, params: inst.params }
        : undefined,
    build: (nodeOf, addNode) => {
      const n = (portId: string): number => (portId.startsWith('#') ? addNode(`${iid}${portId}`) : nodeOf(t(portId)))
      switch (model.type) {
        case 'resistor':
          return [{ k: 'r', a: n(model.a), b: n(model.b), r: Math.max(model.r, 1e-6) }]

        case 'short':
          return [{ k: 'r', a: n(model.a), b: n(model.b), r: 1e-5 }]

        case 'switch':
          return [{ k: 'sw', a: n(model.a), b: n(model.b), r: model.closed ? (model.ron ?? 0.02) : (model.roff ?? 1e9) }]

        case 'isource':
          return [{ k: 'i', a: n(model.a), b: n(model.b), i: model.i }]

        case 'vsource': {
          const wave = model.wave ? toWaveSpec(model.wave) : undefined
          if (model.rint && model.rint > 0) {
            const mid = addNode(`${iid}#vs_${model.a}_${model.b}`)
            return [
              { k: 'v', a: mid, b: n(model.b), v: model.v, wave },
              { k: 'r', a: n(model.a), b: mid, r: model.rint },
            ]
          }
          return [{ k: 'v', a: n(model.a), b: n(model.b), v: model.v, wave }]
        }

        case 'capacitor': {
          if (model.esr && model.esr > 0) {
            const mid = addNode(`${iid}#esr_${model.a}_${model.b}`)
            return [
              { k: 'r', a: n(model.a), b: mid, r: model.esr },
              { k: 'c', a: mid, b: n(model.b), c: Math.max(model.c, 1e-15) },
            ]
          }
          return [{ k: 'c', a: n(model.a), b: n(model.b), c: Math.max(model.c, 1e-15) }]
        }

        case 'inductor':
          return [{ k: 'l', a: n(model.a), b: n(model.b), l: Math.max(model.l, 1e-12), dcr: model.dcr ?? 0.01 }]

        case 'diode': {
          const nEmission = model.n ?? 1.8
          const iref = model.luminous ? 0.02 : 0.001
          const is = model.is ?? isFromVf(model.vf ?? 0.7, nEmission, iref)
          const rs = model.rs ?? 0
          if (rs > 0) {
            const mid = addNode(`${iid}#ds_${model.a}_${model.c}`)
            return [
              { k: 'r', a: n(model.a), b: mid, r: rs },
              { k: 'd', a: mid, b: n(model.c), is, n: nEmission },
            ]
          }
          return [{ k: 'd', a: n(model.a), b: n(model.c), is, n: nEmission }]
        }

        case 'bjt':
          return [{
            k: 'bjt', c: n(model.c), b: n(model.b), e: n(model.e),
            pnp: !!model.pnp, bf: model.bf ?? 150, is: model.is ?? 1e-14,
          }]

        case 'mosfet':
          return [{
            k: 'mos', d: n(model.d), g: n(model.g), s: n(model.s),
            p: !!model.p, vth: model.vth ?? 2.0, kp: model.k ?? 0.5, rds: model.rds ?? 0.05,
          }]

        case 'opamp': {
          // Rails default to ±15 V when the part does not wire them up.
          return [{
            k: 'op', p: n(model.inp), n: n(model.inn), o: n(model.out),
            gain: model.gain ?? 2e5, vhi: 15, vlo: -15,
          }]
        }

        case 'behavioral': {
          /*
           * One Norton source per pin: a conductance to the part's own ground
           * and a current source across it. This is the same device as a
           * voltage behind a series resistance, but stamping it this way costs
           * no extra node and no extra branch row.
           *
           * That matters for more than size. As a Thevenin pair, a released
           * pin put a 1e-11 conductance and a unit branch coupling in the same
           * matrix row, and a board with thirty-odd pins on it was then badly
           * enough conditioned that Newton could not meet its tolerance at all
           * and burned the full iteration cap on every timestep. As a Norton
           * pair, releasing a pin simply means no current and a conductance
           * down at the level of GMIN, which is unremarkable.
           */
          const ref = model.ref ? n(model.ref) : -1
          const out: SolvedDevice[] = []
          for (const pin of model.pins) {
            out.push({ k: 'r', a: n(pin), b: ref, r: HI_Z })
            out.push({ k: 'i', a: ref, b: n(pin), i: 0 })
          }
          return out
        }
      }
    },
  }
}
