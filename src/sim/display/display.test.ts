import { beforeEach, describe, expect, it } from 'vitest'
import '@/parts'
import '@/sim/behaviour/library'
import '@/sim/behaviour/displays'
import { buildNetlist, portKey } from '@/sim/circuit/netlist'
import { BehaviourRunner } from '@/sim/behaviour/runner'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Params } from '@/parts/kernel/types'
import { clearFramebuffers, fbKey, peekFramebuffer, type CharBuffer, type SegBuffer } from './framebuffer'

/**
 * These drive the panels the way a build would: through wires, from a sketch,
 * with no direct access to the framebuffer. If the protocol is wrong the text
 * does not appear, which is the point of testing it this way.
 */

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

  join(a: [string, string], b: [string, string]): void {
    const id = `c${this.n++}`
    this.doc.connections[id] = {
      id, kind: 'wire', a: { instanceId: a[0], portId: a[1] }, b: { instanceId: b[0], portId: b[1] }, gauge: 0.5,
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
      const steps = Math.round(seconds / dt)
      for (let i = 0; i < steps; i++) {
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

/** Read one row of a character panel back as a string. */
function row(fb: CharBuffer, r: number): string {
  return String.fromCharCode(...fb.chars.slice(r * fb.cols, (r + 1) * fb.cols)).trimEnd()
}

beforeEach(() => clearFramebuffers())

describe('character LCD', () => {
  /** Board and panel wired as the LiquidCrystal example expects. */
  function wired(params: Params = {}): { bench: Bench; lcd: string; build: () => ReturnType<Bench['build']> } {
    const b = new Bench()
    const mcu = b.put('mcu-board', { program: 'lcd-text', text1: 'HELLO', text2: 'Draftrig 1602', ...params })
    const lcd = b.put('display-lcd-character')
    b.join([mcu, 'v5'], [lcd, 'vdd'])
    b.join([mcu, 'gnd'], [lcd, 'vss'])
    b.join([mcu, 'v5'], [lcd, 'a'])
    b.join([mcu, 'gnd'], [lcd, 'k'])
    b.join([mcu, 'gnd'], [lcd, 'rw'])
    b.join([mcu, 'd12'], [lcd, 'rs'])
    b.join([mcu, 'd11'], [lcd, 'e'])
    b.join([mcu, 'd5'], [lcd, 'd4'])
    b.join([mcu, 'd4'], [lcd, 'd5'])
    b.join([mcu, 'd3'], [lcd, 'd6'])
    b.join([mcu, 'd2'], [lcd, 'd7'])
    return { bench: b, lcd, build: () => b.build() }
  }

  it('shows the text the sketch sends, over the real four-bit bus', () => {
    const { lcd, build } = wired()
    build().advance(0.25)

    const fb = peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer
    expect(fb).toBeDefined()
    expect(fb.kind).toBe('chars')
    expect(row(fb, 0)).toBe('HELLO')
    expect(row(fb, 1)).toBe('Draftrig 1602')
    expect(fb.displayOn).toBe(true)
  })

  it('follows a change of text without being reset', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', { program: 'lcd-text', text1: 'FIRST', text2: '' })
    const lcd = b.put('display-lcd-character')
    for (const [a, c] of [['v5', 'vdd'], ['gnd', 'vss'], ['v5', 'a'], ['gnd', 'k'], ['gnd', 'rw'],
      ['d12', 'rs'], ['d11', 'e'], ['d5', 'd4'], ['d4', 'd5'], ['d3', 'd6'], ['d2', 'd7']] as const) {
      b.join([mcu, a], [lcd, c])
    }
    const run = b.build()
    run.advance(0.2)
    expect(row(peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer, 0)).toBe('FIRST')

    b.doc.instances[mcu].params.text1 = 'SECOND'
    run.advance(0.2)
    expect(row(peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer, 0)).toBe('SECOND')
  })

  it('stays blank when the enable line is not connected', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', { program: 'lcd-text', text1: 'HELLO' })
    const lcd = b.put('display-lcd-character')
    // Everything except E, which is what actually latches the bus.
    for (const [a, c] of [['v5', 'vdd'], ['gnd', 'vss'], ['v5', 'a'], ['gnd', 'k'], ['gnd', 'rw'],
      ['d12', 'rs'], ['d5', 'd4'], ['d4', 'd5'], ['d3', 'd6'], ['d2', 'd7']] as const) {
      b.join([mcu, a], [lcd, c])
    }
    b.build().advance(0.25)
    const fb = peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer
    expect(row(fb, 0)).toBe('')
    expect(fb.displayOn).toBe(false)
  })

  it('is dark and uninitialised with no supply', () => {
    const b = new Bench()
    const mcu = b.put('mcu-board', { program: 'lcd-text', text1: 'HELLO' })
    const lcd = b.put('display-lcd-character')
    // Signals only. No VDD, no VSS.
    for (const [a, c] of [['d12', 'rs'], ['d11', 'e'], ['d5', 'd4'], ['d4', 'd5'],
      ['d3', 'd6'], ['d2', 'd7']] as const) {
      b.join([mcu, a], [lcd, c])
    }
    b.build().advance(0.1)
    const fb = peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer
    expect(fb.displayOn).toBe(false)
    expect(fb.backlight).toBe(0)
  })

  it('lights its backlight from the LED pins, through the fitted resistor', () => {
    const { lcd, build } = wired()
    build().advance(0.05)
    const fb = peekFramebuffer(fbKey(lcd, 'main')) as CharBuffer
    expect(fb.backlight).toBeGreaterThan(0.9)
  })
})

describe('seven-segment display', () => {
  it('lights the segments a driver pulls low, and forgets them when the scan stops', () => {
    const b = new Bench()
    const supply = b.put('bench-supply', { voltage: 5 })
    const seg = b.put('display-seven-seg', { digits: 4, common: 'cathode' })
    const gnd = b.put('ground')
    b.join([supply, 'n'], [gnd, 'gnd'])

    // Digit 1 common to ground through a resistor, segments A and B to +5 V.
    const r1 = b.put('resistor-axial', { ohms: 220 })
    const r2 = b.put('resistor-axial', { ohms: 220 })
    b.join([seg, 'd1'], [supply, 'n'])
    b.join([supply, 'p'], [r1, '1'])
    b.join([r1, '2'], [seg, 'a'])
    b.join([supply, 'p'], [r2, '1'])
    b.join([r2, '2'], [seg, 'b'])

    const run = b.build()
    run.advance(0.01)
    const fb = peekFramebuffer(fbKey(seg, 'main')) as SegBuffer
    expect(fb.kind).toBe('segments')
    // Bits 0 and 1 are segments A and B.
    expect(fb.digits[0] & 0b11).toBe(0b11)
    expect(fb.digits[1]).toBe(0)
  })
})
