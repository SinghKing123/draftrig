import { buildNetlist, portKey, type Netlist } from './circuit/netlist'
import { BehaviourRunner } from './behaviour/runner'
import '@/sim/behaviour/library'
import '@/sim/behaviour/displays'
import { GROUND } from './circuit/mna'
import { clearFramebuffers } from './display/framebuffer'
import { useDoc, type Doc } from '@/state/doc'
import { useSim, type SimIssue } from '@/state/sim'
import { getPart } from '@/parts/kernel/registry'
import { eng } from '@/parts/kernel/units'

/**
 * Simulation driver.
 *
 * Owns the compiled circuit, advances it in real time, and publishes a single
 * flattened snapshot to the store each display frame. Trace history lives here
 * in ring buffers rather than in React state, the scope reads it directly.
 */

const TRACE_LEN = 4096
/**
 * Milliseconds of wall clock the solver may spend inside one tick. Bounding by
 * time rather than step count is what keeps a slow frame from turning into a
 * death spiral: we fall behind real time instead of locking up.
 */
const STEP_BUDGET_MS = 7
/** How often the solver wakes up, independent of the render loop. */
const TICK_MS = 8
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
  private timer: ReturnType<typeof setTimeout> | 0 = 0
  private lastFrame = 0
  private lastPublish = 0
  private dirty = true
  private traces = new Map<string, Trace>()
  /** Wall-clock time carried over when a tick could not fully catch up. */
  private debt = 0
  /** Fraction of requested simulation time actually delivered, 0..1. */
  private realtimeRatio = 1
  /**
   * Behaviour state lives here rather than in the netlist so a 555 keeps
   * oscillating when the user nudges a part and the circuit is recompiled.
   */
  private behaviourState = new Map<string, Record<string, unknown>>()
  /** Rebuilt whenever the netlist is. */
  private behaviours: BehaviourRunner | null = null

  /* ---------------- lifecycle ---------------- */

  markDirty(): void {
    this.dirty = true
  }

  /**
   * The solver runs on its own timer rather than inside requestAnimationFrame.
   * Tying it to the render loop meant a heavy scene starved the simulation.
   * A circuit would run slow simply because the viewport was busy, which is
   * exactly backwards.
   */
  start(): void {
    if (this.timer) return
    this.lastFrame = performance.now()
    this.debt = 0
    const loop = () => {
      this.timer = setTimeout(loop, TICK_MS)
      this.frame(performance.now())
    }
    this.timer = setTimeout(loop, TICK_MS)
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = 0
  }

  reset(): void {
    this.dirty = true
    this.traces.clear()
    this.behaviourState.clear()
    clearFramebuffers()
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
    const nl = buildNetlist(doc)
    this.netlist = nl
    this.bindBehaviours(nl)
    nl.circuit.reset()
    this.dirty = false
  }

  private bindBehaviours(nl: Netlist): void {
    this.behaviours = new BehaviourRunner(
      nl,
      this.behaviourState,
      // Read parameters live so inspector controls take effect immediately
      // instead of waiting for the next netlist rebuild.
      (id) => useDoc.getState().doc.instances[id]?.params,
    )
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
      // Live parameters are picked up once per tick, not once per timestep.
      this.behaviours?.refreshParams()
      const dt = sim.dt
      const target = wall * sim.speed + this.debt
      const steps = Math.floor(target / dt)
      this.debt = target - steps * dt

      const deadline = now + STEP_BUDGET_MS
      let done = 0
      for (; done < steps; done++) {
        this.behaviours?.run(nl.circuit.time, dt)
        const r = nl.circuit.step(dt)
        if (!r.converged) break
        this.sample(nl)
        // Check the clock every so often rather than every step.
        if ((done & 63) === 63 && performance.now() > deadline) {
          done++
          break
        }
      }
      // Whatever we could not do this tick is dropped, not banked. Banking it
      // would make the next tick even more expensive.
      if (done < steps) this.debt = 0
      this.realtimeRatio = steps > 0 ? done / steps : 1
    } else if (nl.circuit.time === 0) {
      // Settle the operating point: solve, let the behaviours react to what
      // they see, then solve again so their outputs are reflected.
      this.behaviours?.run(0, 0)
      nl.circuit.step(0)
      this.behaviours?.run(0, 0)
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
          message: `Wire carries ${eng(Math.abs(i), 'A')}, above the ${eng(w.ampacity, 'A')} rating for this gauge.`,
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
            message: `LED is drawing ${eng(drive, 'A')}, over its 30 mA maximum. It will fail. Add or increase the series resistor.`,
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
            message: `${inst.name} runs at ${Math.round((p / rating) * 100)} % of its power rating, it will get hot.`,
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
      realtimeRatio: this.realtimeRatio,
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
