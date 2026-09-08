import { buildNetlist, portKey, type Netlist } from './circuit/netlist'
import { GROUND } from './circuit/mna'
import { useDoc, type Doc } from '@/state/doc'
import { useSim, type SimIssue } from '@/state/sim'
import { getPart } from '@/parts/kernel/registry'
import { eng } from '@/parts/kernel/units'

/**
 * Simulation driver.
 *
 * Owns the compiled circuit, advances it in real time, and publishes a single
 * flattened snapshot to the store each display frame. Trace history lives here
 * in ring buffers rather than in React state — the scope reads it directly.
 */

const TRACE_LEN = 4096
const MAX_STEPS_PER_FRAME = 4000
/** Store writes per second. Decoupled from the integration rate. */
const PUBLISH_HZ = 30

export interface Trace {
  key: string
  kind: 'voltage' | 'current'
  t: Float32Array
  y: Float32Array
  head: number
  count: number
}

class SimEngine {
  private netlist: Netlist | null = null
  private raf = 0
  private lastFrame = 0
  private lastPublish = 0
  private dirty = true
  private traces = new Map<string, Trace>()
  /** Wall-clock time carried over when a frame could not fully catch up. */
  private debt = 0

  /* ---------------- lifecycle ---------------- */

  markDirty(): void {
    this.dirty = true
  }

  start(): void {
    if (this.raf) return
    this.lastFrame = performance.now()
    this.debt = 0
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop)
      this.frame(now)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  reset(): void {
    this.dirty = true
    this.traces.clear()
    this.debt = 0
    useSim.getState().resetOutputs()
    this.rebuild(useDoc.getState().doc)
    this.publish(true)
  }

  getTraces(): Map<string, Trace> {
    return this.traces
  }

  /* ---------------- compile ---------------- */

  private rebuild(doc: Doc): void {
    this.netlist = buildNetlist(doc)
    this.netlist.circuit.reset()
    this.dirty = false
  }

  /* ---------------- step ---------------- */

  private frame(now: number): void {
    const sim = useSim.getState()
    const doc = useDoc.getState().doc

    if (this.dirty) this.rebuild(doc)
    const nl = this.netlist
    if (!nl) return

    const wall = Math.min((now - this.lastFrame) / 1000, 0.1)
    this.lastFrame = now

    if (sim.running) {
      const target = wall * sim.speed + this.debt
      const dt = sim.dt
      let steps = Math.floor(target / dt)
      if (steps > MAX_STEPS_PER_FRAME) {
        this.debt = 0
        steps = MAX_STEPS_PER_FRAME
      } else {
        this.debt = target - steps * dt
      }
      for (let i = 0; i < steps; i++) {
        const r = nl.circuit.step(dt)
        if (!r.converged) break
        this.sample(nl)
      }
    } else if (nl.circuit.time === 0) {
      nl.circuit.step(0)
    }

    if (now - this.lastPublish > 1000 / PUBLISH_HZ) {
      this.lastPublish = now
      this.publish(false)
    }
  }

  /* ---------------- probe sampling ---------------- */

  private sample(nl: Netlist): void {
    const probes = useSim.getState().probes
    if (!probes.length) return
    const t = nl.circuit.time
    for (const p of probes) {
      let trace = this.traces.get(p.id)
      if (!trace) {
        trace = { key: p.key, kind: p.kind, t: new Float32Array(TRACE_LEN), y: new Float32Array(TRACE_LEN), head: 0, count: 0 }
        this.traces.set(p.id, trace)
      }
      let value = 0
      if (p.kind === 'voltage') {
        const node = nl.nodeOf.get(p.key)
        value = node === undefined ? 0 : node === GROUND ? 0 : nl.circuit.voltage(node)
      } else {
        const w = nl.wires.find((x) => x.connectionId === p.key)
        if (w) value = nl.circuit.deviceCurrent(w.index)
      }
      trace.t[trace.head] = t
      trace.y[trace.head] = value
      trace.head = (trace.head + 1) % TRACE_LEN
      trace.count = Math.min(trace.count + 1, TRACE_LEN)
    }
  }

  /* ---------------- publish ---------------- */

  private publish(force: boolean): void {
    const nl = this.netlist
    if (!nl) return
    void force

    const doc = useDoc.getState().doc
    const nodeV: Record<string, number> = {}
    const wireI: Record<string, number> = {}
    const instI: Record<string, number> = {}
    const power: Record<string, number> = {}
    const glow: Record<string, number> = {}
    const issues: SimIssue[] = []

    for (const [key, node] of nl.nodeOf) {
      if (!key.includes(':')) continue
      nodeV[key] = node === GROUND ? 0 : nl.circuit.voltage(node)
    }

    for (const w of nl.wires) {
      const i = nl.circuit.deviceCurrent(w.index)
      wireI[w.connectionId] = i
      if (Math.abs(i) > w.ampacity) {
        issues.push({
          severity: 'error',
          connectionId: w.connectionId,
          message: `Wire carries ${eng(Math.abs(i), 'A')} — above the ${eng(w.ampacity, 'A')} rating for this gauge.`,
        })
      }
    }

    for (const d of nl.devices) {
      const i = nl.circuit.deviceCurrent(d.index)
      const prev = instI[d.instanceId]
      if (prev === undefined || Math.abs(i) > Math.abs(prev)) instI[d.instanceId] = i

      if (d.model.type === 'resistor') {
        const p = i * i * d.model.r
        power[d.instanceId] = (power[d.instanceId] ?? 0) + p
      }

      if (d.luminous) {
        // Perceived brightness tracks current with a strong knee: an LED at
        // 1 mA is visibly lit but dim, at 20 mA it is at full output.
        const drive = Math.max(0, i)
        glow[d.instanceId] = Math.min(2.6, Math.pow(drive / 0.02, 0.45) * 1.6)
        if (drive > 0.03) {
          issues.push({
            severity: 'error',
            instanceId: d.instanceId,
            message: `LED is drawing ${eng(drive, 'A')} — over its 30 mA maximum. It will fail. Add or increase the series resistor.`,
          })
        }
      }
    }

    // Part-level rule checks.
    for (const id of doc.order) {
      const inst = doc.instances[id]
      if (!inst) continue
      const def = getPart(inst.defId)
      if (!def) continue

      const p = power[id]
      if (p !== undefined && def.id === 'resistor-axial') {
        const rating = parseFloat(String(inst.params.watt ?? '0.25'))
        if (p > rating) {
          issues.push({
            severity: 'error',
            instanceId: id,
            message: `${inst.name} is dissipating ${eng(p, 'W')} in a ${rating} W part. Use a larger package.`,
          })
        } else if (p > rating * 0.7) {
          issues.push({
            severity: 'warning',
            instanceId: id,
            message: `${inst.name} runs at ${Math.round((p / rating) * 100)} % of its power rating — it will get hot.`,
          })
        }
      }

      if (def.id === 'capacitor-electrolytic') {
        const vp = nodeV[portKey(id, 'p')] ?? 0
        const vn = nodeV[portKey(id, 'n')] ?? 0
        const v = vp - vn
        const vmax = Number(inst.params.vmax ?? 25)
        if (v < -0.5) {
          issues.push({
            severity: 'error',
            instanceId: id,
            message: `${inst.name} is reverse-biased at ${eng(-v, 'V')}. Electrolytics vent when installed backwards.`,
          })
        } else if (v > vmax) {
          issues.push({
            severity: 'error',
            instanceId: id,
            message: `${inst.name} sees ${eng(v, 'V')} across a ${vmax} V part.`,
          })
        }
      }
    }

    for (const w of nl.warnings) issues.push({ severity: 'warning', message: w })
    for (const e of nl.errors) issues.push({ severity: 'error', message: e })

    useSim.getState().publish({
      time: nl.circuit.time,
      nodeV,
      wireI,
      instI,
      power,
      glow,
      issues,
      converged: true,
    })
  }
}

export const engine = new SimEngine()

/** Rebuild whenever the document changes structurally. */
let lastDocRef: Doc | null = null
useDoc.subscribe((s) => {
  if (s.doc !== lastDocRef) {
    lastDocRef = s.doc
    engine.markDirty()
  }
})
