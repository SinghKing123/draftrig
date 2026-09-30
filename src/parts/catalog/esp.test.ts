import { describe, expect, it } from 'vitest'
import '@/parts'
import '@/sim/behaviour/library'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Params } from '@/parts/kernel/types'
import { ESP_BOARDS, espSketchPins } from './esp'

/**
 * The ESP boards.
 *
 * The point of splitting one generic part into four real ones is that the pin
 * a sketch names has to be the pin the silkscreen names, so that is what these
 * check: the numbers, the level, and that a sketch actually reaches a pad.
 */

class Bench {
  readonly doc: Doc = emptyDoc()
  private n = 0

  put(defId: string, params: Params = {}): string {
    const id = `i${this.n++}`
    this.doc.instances[id] = {
      id, defId, name: id,
      params: { ...defaultParams(requirePart(defId)), ...params },
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
    for (let i = 0; i < 3; i++) { runner.run(0, 0); nl.circuit.step(0) }
    return {
      advance: (seconds: number, dt = 25e-6) => {
        for (let i = 0; i < Math.round(seconds / dt); i++) {
          runner.run(nl.circuit.time, dt)
          nl.circuit.step(dt)
        }
      },
      volts: (inst: string, port: string) => {
        const node = nl.nodeOf.get(portKey(inst, port))
        return node === undefined || node < 0 ? 0 : nl.circuit.voltage(node)
      },
    }
  }
}

describe('the ESP board table', () => {
  it('offers more than one board', () => {
    expect(Object.keys(ESP_BOARDS).length).toBeGreaterThanOrEqual(4)
  })

  it('gives every board a ground and a 3.3 V pin', () => {
    for (const [key, b] of Object.entries(ESP_BOARDS)) {
      const all = [...b.left, ...b.right]
      expect(all.some((p) => p.kind === 'gnd'), `${key} ground`).toBe(true)
      expect(
        all.some((p) => p.kind === 'v33' || p.kind === 'v5'),
        `${key} supply`,
      ).toBe(true)
    }
  })

  it('never repeats a GPIO number on one board', () => {
    for (const [key, b] of Object.entries(ESP_BOARDS)) {
      const seen = new Set<number>()
      for (const pin of [...b.left, ...b.right]) {
        if (pin.gpio === undefined) continue
        expect(seen.has(pin.gpio), `${key} repeats GPIO ${pin.gpio}`).toBe(false)
        seen.add(pin.gpio)
      }
    }
  })

  it('puts the D-names where the ESP8266 boards print them', () => {
    // These four are the ones every ESP8266 tutorial assumes, and getting any
    // of them wrong is a build that works here and not on the bench.
    for (const key of ['nodemcu', 'd1mini']) {
      const pins = espSketchPins({ board: key })
      expect(pins.aliases.d1, `${key} D1`).toBe(pins.digital[5])
      expect(pins.aliases.d2, `${key} D2`).toBe(pins.digital[4])
      expect(pins.aliases.d4, `${key} D4`).toBe(pins.digital[2])
      expect(pins.aliases.d8, `${key} D8`).toBe(pins.digital[15])
    }
  })

  it('leaves a hole where a board does not bring a GPIO out', () => {
    // The D1 mini has no GPIO 9; writing to 9 must reach nothing at all.
    const pins = espSketchPins({ board: 'd1mini' })
    expect(pins.digital[9]).toBeUndefined()
    expect(pins.digital[5]).toBeDefined()
  })
})

describe('an ESP running a sketch', () => {
  /** An LED and its resistor on GPIO 2, which is the on-board LED pin. */
  function lamp(params: Params) {
    const b = new Bench()
    const esp = b.put('esp-board', params)
    const r = b.put('resistor-axial', { value: 220 })
    const led = b.put('led-5mm', { color: 'red' })
    b.join([esp, 'io2'], [r, '1'])
    b.join([r, '2'], [led, 'a'])
    b.join([led, 'c'], [esp, 'gndl13'])
    return { esp, run: b.build(), bench: b }
  }

  it('drives a pin from a sketch at 3.3 volts, not five', () => {
    const { esp, run } = lamp({
      board: 'doit-30',
      program: 'custom',
      code: 'function setup() { pinMode(2, OUTPUT) }\nfunction loop() { digitalWrite(2, HIGH) }',
    })
    run.advance(0.02)
    const v = run.volts(esp, 'io2')
    expect(v).toBeGreaterThan(1.5)
    // The whole point of the board being separate: it must never reach 5 V.
    expect(v).toBeLessThan(3.4)
  })

  it('regulates 3.3 V out for the rest of the circuit', () => {
    const b = new Bench()
    const esp = b.put('esp-board', { board: 'doit-30', program: 'off' })
    const r = b.put('resistor-axial', { value: 1000 })
    b.join([esp, 'v33r14'], [r, '1'])
    b.join([r, '2'], [esp, 'gndl13'])
    const run = b.build()
    run.advance(0.01)
    expect(run.volts(esp, 'v33r14')).toBeGreaterThan(3.1)
    expect(run.volts(esp, 'v33r14')).toBeLessThan(3.4)
  })

  it('blinks the on-board LED pin on the stock program', () => {
    const { esp, run } = lamp({ board: 'doit-30', program: 'blink', interval: 0.05 })
    const seen: number[] = []
    for (let i = 0; i < 6; i++) {
      run.advance(0.025)
      seen.push(run.volts(esp, 'io2') > 1.5 ? 1 : 0)
    }
    expect(seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length).toBeGreaterThanOrEqual(2)
  })

  it('reaches a pin by its silkscreen name on a NodeMCU', () => {
    const b = new Bench()
    const esp = b.put('esp-board', {
      board: 'nodemcu',
      program: 'custom',
      code: 'function setup() { pinMode(D4, OUTPUT) }\nfunction loop() { digitalWrite(D4, HIGH) }',
    })
    const r = b.put('resistor-axial', { value: 220 })
    b.join([esp, 'io2'], [r, '1'])
    b.join([r, '2'], [esp, 'gndl9'])
    const run = b.build()
    run.advance(0.02)
    // D4 is GPIO 2 on a NodeMCU, and that is the pad the wire is on.
    expect(run.volts(esp, 'io2')).toBeGreaterThan(1.5)
  })
})
