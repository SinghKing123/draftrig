import { getBehaviour, HI_Z, type BehaviourContext } from './index'
import type { BehaviourBinding, Netlist } from '../circuit/netlist'
import type { Params } from '@/parts/kernel/types'
import { fbKey, getFramebuffer } from '@/sim/display/framebuffer'

/**
 * Evaluates a netlist's behavioural parts against the solver.
 *
 * Kept separate from the simulation engine so it can be driven from a test
 * without a browser, a store or an animation frame.
 */
export class BehaviourRunner {
  private contexts: { binding: BehaviourBinding; ctx: BehaviourContext }[] = []

  /**
   * @param liveParams Optional lookup so live inspector controls take effect
   *                   without recompiling the netlist.
   */
  /** Resolved once: a registry lookup per behaviour per timestep is waste. */
  private fns = new Map<string, ReturnType<typeof getBehaviour>>()

  constructor(
    nl: Netlist,
    private readonly state = new Map<string, Record<string, unknown>>(),
    private readonly liveParams?: (instanceId: string) => Params | undefined,
  ) {
    for (const binding of nl.behaviours) {
      if (!this.fns.has(binding.evalId)) this.fns.set(binding.evalId, getBehaviour(binding.evalId))
      const byPin = new Map(binding.pins.map((p) => [p.id, p]))
      let s = this.state.get(binding.instanceId)
      if (!s) {
        s = {}
        this.state.set(binding.instanceId, s)
      }
      this.contexts.push({
        binding,
        ctx: {
          t: 0,
          dt: 0,
          params: binding.params,
          state: s,
          read: (pin) => {
            const p = byPin.get(pin)
            if (!p) return 0
            return nl.circuit.voltage(p.node) - nl.circuit.voltage(binding.refNode)
          },
          drive: (pin, v, r = 25) => {
            const p = byPin.get(pin)
            if (!p) return
            const rr = Math.max(r, 1e-3)
            nl.circuit.setResistance(p.rIndex, rr)
            nl.circuit.setSourceCurrent(p.iIndex, v / rr)
          },
          hiZ: (pin) => {
            const p = byPin.get(pin)
            if (!p) return
            nl.circuit.setResistance(p.rIndex, HI_Z)
            // A released pin must stop injecting, not merely stop being stiff.
            nl.circuit.setSourceCurrent(p.iIndex, 0)
          },
          display: (screen, init) => getFramebuffer(fbKey(binding.instanceId, screen), init),
        },
      })
    }
  }

  get count(): number {
    return this.contexts.length
  }

  /**
   * Pull the latest instance parameters. Called once per display frame rather
   * than per timestep, reading a store forty thousand times a second to catch
   * a knob the user might have turned is not a good trade.
   */
  refreshParams(): void {
    if (!this.liveParams) return
    for (const { binding, ctx } of this.contexts) {
      const live = this.liveParams(binding.instanceId)
      if (live) ctx.params = live
    }
  }

  /** Evaluate every behaviour against the last solved state. */
  run(t: number, dt: number): void {
    for (const { binding, ctx } of this.contexts) {
      const fn = this.fns.get(binding.evalId)
      if (!fn) continue
      ctx.t = t
      ctx.dt = dt
      fn(ctx)
    }
  }

  clearState(): void {
    this.state.clear()
  }
}
