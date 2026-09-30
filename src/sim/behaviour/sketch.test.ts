import { describe, expect, it } from 'vitest'
import '@/parts'
import './library'
import './displays'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from './runner'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Params } from '@/parts/kernel/types'
import { compileSketch } from './sketch'

/**
 * Sketches, driven through the solver rather than inspected directly.
 *
 * The question these answer is not "did the interpreter run" but "did a pin
 * move, and did the circuit on the end of it notice". A sketch that sets a
 * variable and never reaches a terminal is not a working sketch.
 */

class Bench {
  readonly doc: Doc = emptyDoc()
  private n = 0

  put(defId: string, params: Params = {}): string {
    const def = requirePart(defId)
    const id = `i${this.n++}`
    this.doc.instances[id] = {
      id, defId, name: id, params: { ...defaultParams(def), ...params },
      pos: [0, 0, 0], rot: [0, 0, 0],
    }
    this.doc.order.push(id)
    return id
  }

  join(a: [string, string], b: [string, string]): void {
    const id = `c${this.n++}`
    this.doc.connections[id] = {
      id, kind: 'wire', a: { instanceId: a[0], portId: a[1] },
      b: { instanceId: b[0], portId: b[1] }, gauge: 0.5,
    }
    this.doc.connectionOrder.push(id)
  }

  build() {
    const nl = buildNetlist(this.doc)
    const runner = new BehaviourRunner(nl)
    nl.circuit.reset()
    for (let i = 0; i < 3; i++) {
      runner.run(0, 0)
      nl.circuit.step(0)
    }
    const advance = (seconds: number, dt = 25e-6): void => {
      for (let i = 0; i < Math.round(seconds / dt); i++) {
        runner.run(nl.circuit.time, dt)
        nl.circuit.step(dt)
      }
    }
    const volts = (inst: string, port: string): number => {
      const node = nl.nodeOf.get(portKey(inst, port))
      return node === undefined || node < 0 ? 0 : nl.circuit.voltage(node)
    }
    return { nl, advance, volts }
  }
}

/** An LED and its resistor on one pin, which is the smallest real circuit. */
function lamp(code: string): { bench: Bench; mcu: string; run: ReturnType<Bench['build']> } {
  const b = new Bench()
  const mcu = b.put('mcu-board', { program: 'custom', code })
  const r = b.put('resistor-axial', { value: 220 })
  const led = b.put('led-5mm', { color: 'red' })
  b.join([mcu, 'd13'], [r, '1'])
  b.join([r, '2'], [led, 'a'])
  b.join([led, 'c'], [mcu, 'gnd'])
  return { bench: b, mcu, run: b.build() }
}

describe('sketch compiler', () => {
  it('accepts a sketch with only a loop', () => {
    const { program, error } = compileSketch('function loop() {}')
    expect(error).toBeNull()
    expect(program?.loop).toBeTypeOf('function')
  })

  it('reports a syntax error instead of throwing', () => {
    const { program, error } = compileSketch('function loop( {')
    expect(program).toBeNull()
    expect(error).toBeTruthy()
  })

  it('refuses a sketch with neither setup nor loop', () => {
    const { error } = compileSketch('const x = 1')
    expect(error).toMatch(/setup\(\) or loop\(\)/)
  })
})

describe('a sketch on the pins', () => {
  it('lights an LED from digitalWrite', () => {
    const { run } = lamp(`
      function setup() { pinMode(13, OUTPUT) }
      function loop() { digitalWrite(13, HIGH) }
    `)
    run.advance(0.02)
    // The pin is driving, so it sits near the rail behind its source resistance.
    expect(run.volts('i0', 'd13')).toBeGreaterThan(3)
  })

  it('blinks: the pin is high, then low, then high again', () => {
    const { run } = lamp(`
      function setup() { pinMode(13, OUTPUT) }
      function* loop() {
        digitalWrite(13, HIGH)
        yield delay(100)
        digitalWrite(13, LOW)
        yield delay(100)
      }
    `)
    const seen: number[] = []
    for (let i = 0; i < 6; i++) {
      run.advance(0.05)
      seen.push(run.volts('i0', 'd13') > 2 ? 1 : 0)
    }
    // 50 ms samples of a 100 ms half-period: it has to change at least twice.
    const changes = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length
    expect(changes).toBeGreaterThanOrEqual(2)
  })

  it('leaves a pin high-impedance until pinMode makes it an output', () => {
    const { run } = lamp(`function loop() { digitalWrite(13, HIGH) }`)
    run.advance(0.02)
    // Nothing is driving, so the LED and resistor pull the pin to nothing.
    expect(run.volts('i0', 'd13')).toBeLessThan(1)
  })

  it('averages an analogWrite to somewhere between the rails', () => {
    const { run } = lamp(`
      function setup() { pinMode(9, OUTPUT); analogWrite(13, 128) }
      function loop() {}
    `)
    // Sample across one PWM period and average, which is what an LED does.
    let sum = 0
    const n = 60
    for (let i = 0; i < n; i++) {
      run.advance(1 / 490 / n)
      sum += run.volts('i0', 'd13')
    }
    const mean = sum / n
    expect(mean).toBeGreaterThan(1)
    expect(mean).toBeLessThan(4.4)
  })

  it('reads a pin the circuit is holding low', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', {
      program: 'custom',
      code: `
        function setup() { pinMode(2, INPUT); pinMode(13, OUTPUT) }
        function loop() { digitalWrite(13, digitalRead(2) ? HIGH : LOW) }
      `,
    })
    const r = b.put('resistor-axial', { value: 1000 })
    b.join([mcu, 'd2'], [r, '1'])
    b.join([r, '2'], [mcu, 'gnd'])
    const run = b.build()
    run.advance(0.02)
    expect(run.volts(mcu, 'd13')).toBeLessThan(1)
  })

  it('stops and releases its pins when the sketch throws', () => {
    const { run } = lamp(`
      function setup() { pinMode(13, OUTPUT) }
      function loop() { digitalWrite(13, HIGH); throw new Error('bang') }
    `)
    run.advance(0.02)
    expect(run.volts('i0', 'd13')).toBeLessThan(1)
  })

  it('survives a loop that never ends instead of hanging', () => {
    const { run } = lamp(`
      function setup() { pinMode(13, OUTPUT) }
      function loop() { while (true) { digitalWrite(13, HIGH) } }
    `)
    // If the guard did not fire this test would never return.
    run.advance(0.01)
    expect(run.volts('i0', 'd13')).toBeLessThan(1)
  })

  it('picks up an edited sketch without a reset', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', {
      program: 'custom',
      code: 'function setup() { pinMode(13, OUTPUT) }\nfunction loop() { digitalWrite(13, LOW) }',
    })
    const r = b.put('resistor-axial', { value: 220 })
    const led = b.put('led-5mm', { color: 'red' })
    b.join([mcu, 'd13'], [r, '1'])
    b.join([r, '2'], [led, 'a'])
    b.join([led, 'c'], [mcu, 'gnd'])
    const run = b.build()
    run.advance(0.02)
    expect(run.volts(mcu, 'd13')).toBeLessThan(1)

    b.doc.instances[mcu].params.code =
      'function setup() { pinMode(13, OUTPUT) }\nfunction loop() { digitalWrite(13, HIGH) }'
    run.advance(0.02)
    expect(run.volts(mcu, 'd13')).toBeGreaterThan(3)
  })
})
