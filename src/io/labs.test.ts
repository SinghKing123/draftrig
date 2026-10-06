import { describe, expect, it } from 'vitest'
import '@/parts'
import '@/sim/behaviour/library'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { PortIndex } from '@/scene/portIndex'
import { listInstances } from '@/state/doc'
import { lab9Blinker, lab10Buzzer } from './labs'

/**
 * The two lab circuits do what their sheets say they do.
 *
 * Both are followed from a printed handout, so the thing worth testing is
 * not that they compile but that they oscillate at the rate the sheet's own
 * arithmetic predicts. A 555 wired almost right sits at one rail in silence.
 */

const run = (doc: ReturnType<typeof lab9Blinker>, seconds: number, dt: number, watch: [string, string]) => {
  const nl = buildNetlist(doc)
  const runner = new BehaviourRunner(nl)
  nl.circuit.reset()
  for (let i = 0; i < 3; i++) { runner.run(0, 0); nl.circuit.step(0) }

  const inst = Object.values(doc.instances).find((x) => x.name?.startsWith(watch[0]) || x.defId === watch[0])!
  const node = nl.nodeOf.get(portKey(inst.id, watch[1]))
  const v: number[] = []
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    runner.run(nl.circuit.time, dt)
    nl.circuit.step(dt)
    v.push(node === undefined || node < 0 ? 0 : nl.circuit.voltage(node))
  }
  // Count rising edges through the middle of the swing.
  // Walked, not spread: the audio run samples a quarter of a million points
  // and `Math.max(...v)` on that many arguments overflows the stack.
  let hi = -Infinity
  let lo = Infinity
  for (const x of v) { if (x > hi) hi = x; if (x < lo) lo = x }
  const mid = (hi + lo) / 2
  let edges = 0
  for (let i = 1; i < v.length; i++) if (v[i - 1] <= mid && v[i] > mid) edges++
  return { hi, lo, edges, hz: edges / seconds }
}

describe('the 555 labs', () => {
  it('every port they wire to resolves', () => {
    const bad: string[] = []
    for (const [name, make] of [['lab 9', lab9Blinker], ['lab 10', lab10Buzzer]] as const) {
      const doc = make()
      const index = new PortIndex(listInstances(doc))
      for (const cid of doc.connectionOrder) {
        const c = doc.connections[cid]
        for (const end of [c.a, c.b]) {
          if (!index.get(end.instanceId, end.portId)) {
            bad.push(`${name}: ${doc.instances[end.instanceId]?.defId}.${end.portId}`)
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('lab 9 blinks at about 0.7 Hz', () => {
    // 1.44 / ((1k + 20k) * 100uF) = 0.686 Hz
    // 1e-3 is the timestep the recording uses; the rate must survive it.
    const r = run(lab9Blinker(), 12, 1e-3, ['ne555', 'out'])
    console.log('lab 9 output:', r.lo.toFixed(2), 'to', r.hi.toFixed(2), 'V,', r.hz.toFixed(2), 'Hz')
    expect(r.hi - r.lo).toBeGreaterThan(4)
    expect(r.hz).toBeGreaterThan(0.45)
    expect(r.hz).toBeLessThan(1.0)
  })

  it('lab 10 buzzes in the audible band', () => {
    const r = run(lab10Buzzer(), 0.05, 2e-7, ['ne555', 'out'])
    console.log('lab 10 output:', r.lo.toFixed(2), 'to', r.hi.toFixed(2), 'V,', Math.round(r.hz), 'Hz')
    expect(r.hi - r.lo).toBeGreaterThan(4)
    expect(r.hz).toBeGreaterThan(300)
    expect(r.hz).toBeLessThan(8000)
  })
})
