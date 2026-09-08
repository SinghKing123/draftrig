import { describe, expect, it } from 'vitest'
import '@/parts'
import './library'
import { buildNetlist, portKey } from '../circuit/netlist'
import { BehaviourRunner } from './runner'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Params } from '@/parts/kernel/types'

/* ------------------------------------------------------------------ */
/* Test bench                                                          */
/* ------------------------------------------------------------------ */

class Bench {
  readonly doc: Doc = emptyDoc()
  private n = 0

  put(defId: string, params: Params = {}): string {
    const def = requirePart(defId)
    const id = `i${this.n++}`
    this.doc.instances[id] = {
      id, defId, name: id, params: { ...defaultParams(def), ...params }, pos: [0, 0, 0], rot: [0, 0, 0],
    }
    this.doc.order.push(id)
    return id
  }

  join(a: [string, string], b: [string, string]): string {
    const id = `c${this.n++}`
    this.doc.connections[id] = {
      id, kind: 'wire', a: { instanceId: a[0], portId: a[1] }, b: { instanceId: b[0], portId: b[1] }, gauge: 0.5,
    }
    this.doc.connectionOrder.push(id)
    return id
  }

  /** Compile and return a runnable circuit with its behaviours attached. */
  build() {
    const nl = buildNetlist(this.doc)
    const runner = new BehaviourRunner(nl)
    nl.circuit.reset()
    // Two settle passes so behaviours see a solved supply before the run.
    for (let i = 0; i < 3; i++) {
      runner.run(0, 0)
      nl.circuit.step(0)
    }
    const volts = (inst: string, port: string): number => {
      const node = nl.nodeOf.get(portKey(inst, port))
      return node === undefined || node < 0 ? 0 : nl.circuit.voltage(node)
    }
    const advance = (seconds: number, dt = 20e-6, onStep?: () => void): void => {
      const steps = Math.round(seconds / dt)
      for (let i = 0; i < steps; i++) {
        runner.run(nl.circuit.time, dt)
        nl.circuit.step(dt)
        onStep?.()
      }
    }
    return { nl, runner, volts, advance }
  }
}

/* ------------------------------------------------------------------ */

describe('555 timer', () => {
  it('oscillates at the frequency the datasheet formula predicts', () => {
    // Classic astable: R1 VCC->DISCH, R2 DISCH->THRESH, C THRESH->GND,
    // with TRIG tied to THRESH.
    const R1 = 10_000
    const R2 = 68_000
    const C = 1e-6

    const b = new Bench()
    const sup = b.put('bench-supply', { voltage: 9 })
    const ic = b.put('ne555')
    const r1 = b.put('resistor-axial', { value: R1 })
    const r2 = b.put('resistor-axial', { value: R2 })
    const cap = b.put('capacitor-ceramic', { value: C })
    const gnd = b.put('ground')

    b.join([sup, 'p'], [ic, 'vcc'])
    b.join([sup, 'p'], [ic, 'reset'])
    b.join([sup, 'n'], [ic, 'gnd'])
    b.join([sup, 'n'], [gnd, 'gnd'])
    b.join([sup, 'p'], [r1, '1'])
    b.join([r1, '2'], [ic, 'disch'])
    b.join([ic, 'disch'], [r2, '1'])
    b.join([r2, '2'], [ic, 'thresh'])
    b.join([ic, 'thresh'], [ic, 'trig'])
    b.join([ic, 'thresh'], [cap, '1'])
    b.join([cap, '2'], [sup, 'n'])

    const { volts, advance, nl } = b.build()
    expect(nl.behaviours).toHaveLength(1)

    // Let it settle, then count output edges over a fixed window.
    advance(0.25, 20e-6)

    let edges = 0
    let last = volts(ic, 'out') > 4.5
    const window = 1.0
    advance(window, 20e-6, () => {
      const high = volts(ic, 'out') > 4.5
      if (high !== last) edges++
      last = high
    })

    const measured = edges / 2 / window
    const predicted = 1.44 / ((R1 + 2 * R2) * C)
    expect(predicted).toBeGreaterThan(9)
    expect(predicted).toBeLessThan(11)
    // Within 15 % of the textbook figure, which itself is an approximation.
    expect(measured).toBeGreaterThan(predicted * 0.85)
    expect(measured).toBeLessThan(predicted * 1.15)
  })

  it('swings its output nearly rail to rail', () => {
    const b = new Bench()
    const sup = b.put('bench-supply', { voltage: 9 })
    const ic = b.put('ne555')
    const r1 = b.put('resistor-axial', { value: 10_000 })
    const r2 = b.put('resistor-axial', { value: 10_000 })
    const cap = b.put('capacitor-ceramic', { value: 1e-6 })
    const gnd = b.put('ground')

    b.join([sup, 'n'], [gnd, 'gnd'])
    b.join([sup, 'p'], [ic, 'vcc'])
    b.join([sup, 'p'], [ic, 'reset'])
    b.join([sup, 'n'], [ic, 'gnd'])
    b.join([sup, 'p'], [r1, '1'])
    b.join([r1, '2'], [ic, 'disch'])
    b.join([ic, 'disch'], [r2, '1'])
    b.join([r2, '2'], [ic, 'thresh'])
    b.join([ic, 'thresh'], [ic, 'trig'])
    b.join([ic, 'thresh'], [cap, '1'])
    b.join([cap, '2'], [sup, 'n'])

    const { volts, advance } = b.build()
    let vmin = Infinity
    let vmax = -Infinity
    advance(0.15, 20e-6, () => {
      const v = volts(ic, 'out')
      vmin = Math.min(vmin, v)
      vmax = Math.max(vmax, v)
    })
    expect(vmax).toBeGreaterThan(6.5)
    expect(vmin).toBeLessThan(1.0)
  })
})

describe('logic gates', () => {
  const truth = (fn: string, a: boolean, bIn: boolean): boolean => {
    switch (fn) {
      case '7400': return !(a && bIn)
      case '7408': return a && bIn
      case '7432': return a || bIn
      case '7486': return a !== bIn
      case '7402': return !(a || bIn)
      default: return false
    }
  }

  for (const type of ['7400', '7408', '7432', '7486', '7402']) {
    it(`${type} follows its truth table`, () => {
      for (const a of [false, true]) {
        for (const bIn of [false, true]) {
          const bench = new Bench()
          const sup = bench.put('bench-supply', { voltage: 5 })
          const gate = bench.put('logic-gate-dip', { type })
          const gnd = bench.put('ground')
          const pull = bench.put('resistor-axial', { value: 10_000 })

          bench.join([sup, 'n'], [gnd, 'gnd'])
          bench.join([sup, 'p'], [gate, 'vcc'])
          bench.join([sup, 'n'], [gate, 'gnd'])
          bench.join([gate, 'i0'], [a ? sup : gate, a ? 'p' : 'gnd'])
          bench.join([gate, 'i1'], [bIn ? sup : gate, bIn ? 'p' : 'gnd'])
          // A load on the output, so we are measuring a driven node.
          bench.join([gate, 'y'], [pull, '1'])
          bench.join([pull, '2'], [sup, 'n'])

          const { volts, advance } = bench.build()
          advance(2e-6, 1e-8)

          const out = volts(gate, 'y')
          const expected = truth(type, a, bIn)
          expect(out > 2.5, `${type}(${a},${bIn}) = ${out.toFixed(2)} V`).toBe(expected)
        }
      }
    })
  }
})

describe('linear regulator', () => {
  it('holds 5 V from a 12 V input', () => {
    const b = new Bench()
    const sup = b.put('bench-supply', { voltage: 12 })
    const reg = b.put('regulator-linear', { model: '7805' })
    const load = b.put('resistor-axial', { value: 100, watt: '1' })
    const gnd = b.put('ground')

    b.join([sup, 'n'], [gnd, 'gnd'])
    b.join([sup, 'p'], [reg, 'in'])
    b.join([sup, 'n'], [reg, 'gnd'])
    b.join([reg, 'out'], [load, '1'])
    b.join([load, '2'], [sup, 'n'])

    const { volts, advance } = b.build()
    advance(0.002, 20e-6)
    expect(volts(reg, 'out')).toBeGreaterThan(4.85)
    expect(volts(reg, 'out')).toBeLessThan(5.15)
  })

  it('drops out when the input falls below the minimum', () => {
    const b = new Bench()
    const sup = b.put('bench-supply', { voltage: 6 })
    const reg = b.put('regulator-linear', { model: '7805' })
    const load = b.put('resistor-axial', { value: 1000 })
    const gnd = b.put('ground')

    b.join([sup, 'n'], [gnd, 'gnd'])
    b.join([sup, 'p'], [reg, 'in'])
    b.join([sup, 'n'], [reg, 'gnd'])
    b.join([reg, 'out'], [load, '1'])
    b.join([load, '2'], [sup, 'n'])

    const { volts, advance } = b.build()
    advance(0.002, 20e-6)
    // 6 V in with a 2 V dropout cannot make 5 V.
    expect(volts(reg, 'out')).toBeLessThan(4.5)
    expect(volts(reg, 'out')).toBeGreaterThan(3.5)
  })
})

describe('microcontroller', () => {
  it('blinks its LED pin at the programmed rate', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', { program: 'blink', interval: 0.05 })
    const led = b.put('led-5mm', { color: 'red' })
    const res = b.put('resistor-axial', { value: 330 })
    const gnd = b.put('ground')

    b.join([mcu, 'gnd'], [gnd, 'gnd'])
    b.join([mcu, 'd13'], [res, '1'])
    b.join([res, '2'], [led, 'a'])
    b.join([led, 'c'], [mcu, 'gnd'])

    const { volts, advance } = b.build()

    let edges = 0
    let last = volts(mcu, 'd13') > 2.5
    advance(0.5, 50e-6, () => {
      const high = volts(mcu, 'd13') > 2.5
      if (high !== last) edges++
      last = high
    })
    // 50 ms per half period over 500 ms is about 10 transitions.
    expect(edges).toBeGreaterThanOrEqual(8)
    expect(edges).toBeLessThanOrEqual(12)
  })
})
