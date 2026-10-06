import { describe, expect, it } from 'vitest'
import '@/parts'
import '@/sim/behaviour/library'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { PortIndex } from '@/scene/portIndex'
import { listInstances } from '@/state/doc'
import { eightBit } from './builds'

/**
 * The machine is dense, and it runs.
 *
 * Density is the point of this one, so the part and wire counts are asserted:
 * if a later edit quietly thins it out, it stops being the thing it is for.
 * And the lamps have to be driven by the solver rather than decorating a
 * still life, so the clock is checked for a real square wave and the register
 * chain for outputs that are not all sitting at one rail.
 */
describe('the eight-bit machine', () => {
  it('resolves every port it wires to', () => {
    const doc = eightBit()
    const index = new PortIndex(listInstances(doc))
    const bad: string[] = []
    for (const cid of doc.connectionOrder) {
      const c = doc.connections[cid]
      for (const end of [c.a, c.b]) {
        if (!index.get(end.instanceId, end.portId)) {
          bad.push(`${doc.instances[end.instanceId]?.defId}.${end.portId}`)
        }
      }
    }
    expect(bad.slice(0, 12)).toEqual([])
  })

  it('is as dense as the thing it is imitating', () => {
    const doc = eightBit()
    const parts = Object.keys(doc.instances).length
    const wires = doc.connectionOrder.length
    console.log(`eight-bit: ${parts} parts, ${wires} wires`)
    expect(parts).toBeGreaterThan(60)
    expect(wires).toBeGreaterThan(140)
  })

  it('clocks, and the lamps follow it', () => {
    const doc = eightBit()
    const nl = buildNetlist(doc)
    const runner = new BehaviourRunner(nl)
    nl.circuit.reset()
    for (let i = 0; i < 3; i++) { runner.run(0, 0); nl.circuit.step(0) }

    const clk = Object.values(doc.instances).find((x) => x.defId === 'ne555')!
    const node = nl.nodeOf.get(portKey(clk.id, 'out'))
    let hi = -Infinity
    let lo = Infinity
    let edges = 0
    let was = 0

    const dt = 2e-4
    for (let i = 0; i < Math.round(3 / dt); i++) {
      runner.run(nl.circuit.time, dt)
      nl.circuit.step(dt)
      const v = node === undefined || node < 0 ? 0 : nl.circuit.voltage(node)
      if (v > hi) hi = v
      if (v < lo) lo = v
      const now = v > (hi + lo) / 2 ? 1 : 0
      if (!was && now) edges++
      was = now
    }
    console.log(`clock: ${lo.toFixed(2)}..${hi.toFixed(2)} V, ${(edges / 3).toFixed(1)} Hz`)
    expect(hi - lo).toBeGreaterThan(2)
    expect(edges).toBeGreaterThan(1)

    // At least one register output is high and at least one is low, which is
    // what a pattern walking the chain looks like and a dead circuit does not.
    const reg = Object.values(doc.instances).find((x) => x.defId === 'shift-register-595')!
    const outs = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'].map((q) => {
      const n = nl.nodeOf.get(portKey(reg.id, q))
      return n === undefined || n < 0 ? 0 : nl.circuit.voltage(n)
    })
    console.log('register 1:', outs.map((v) => v.toFixed(1)).join(' '))
    /* A pattern, not a saturated register. The data input was tied high at
       first, which filled every stage with ones within a second and left the
       lamps on and still; a mix of highs and lows is what moving looks like. */
    expect(Math.max(...outs)).toBeGreaterThan(1.5)
    expect(Math.min(...outs)).toBeLessThan(1.5)
  })
})
