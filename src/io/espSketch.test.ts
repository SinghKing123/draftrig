import { describe, expect, it } from 'vitest'
import '@/parts'
import '@/sim/behaviour/library'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { espWeather } from './builds'

/**
 * The sensor node really drives its bar.
 *
 * The sketch on that board is the only thing lighting those segments, and a
 * sketch that does not run fails silently: the part sits there unlit and the
 * circuit around it reads as a wiring mistake. Two separate faults in the
 * sketch runtime did exactly that to this build, so it is measured.
 */
describe('the sensor node', () => {
  it('lights the part of the bar the sensor asks for', () => {
    const doc = espWeather()
    const nl = buildNetlist(doc)
    const runner = new BehaviourRunner(nl)
    nl.circuit.reset()
    for (let i = 0; i < 3; i++) { runner.run(0, 0); nl.circuit.step(0) }

    const dt = 20e-6
    for (let i = 0; i < Math.round(0.6 / dt); i++) {
      runner.run(nl.circuit.time, dt)
      nl.circuit.step(dt)
    }

    const bar = Object.values(doc.instances).find((x) => x.defId === 'led-bargraph')!
    const volts = (inst: string, port: string): number => {
      const node = nl.nodeOf.get(portKey(inst, port))
      return node === undefined || node < 0 ? 0 : nl.circuit.voltage(node)
    }

    const lit: number[] = []
    for (let i = 1; i <= 6; i++) if (volts(bar.id, `a${i}`) > 1.2) lit.push(i)

    /*
     * The gas sensor is set to 70 per cent and the bar has six driven
     * segments, so the sketch should light four. Asserting the number rather
     * than "more than none" is what catches a pin map that resolves to the
     * wrong pin: that lights something, just not this.
     */
    expect(lit).toEqual([1, 2, 3, 4])
  })
})
