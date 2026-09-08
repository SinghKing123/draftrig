import { describe, expect, it } from 'vitest'
import { Circuit, isFromVf, luSolve, type SolvedDevice } from './mna'

describe('luSolve', () => {
  it('solves a small system', () => {
    // [2 1; 1 3] x = [5; 10]  ->  x = [1; 3]
    const A = new Float64Array([2, 1, 1, 3])
    const b = new Float64Array([5, 10])
    const x = luSolve(A, b, 2)!
    expect(x[0]).toBeCloseTo(1, 9)
    expect(x[1]).toBeCloseTo(3, 9)
  })

  it('reports a singular matrix', () => {
    const A = new Float64Array([1, 2, 2, 4])
    const b = new Float64Array([1, 2])
    expect(luSolve(A, b, 2)).toBeNull()
  })
})

describe('DC analysis', () => {
  it('splits a resistive divider', () => {
    // 10 V across 1k + 3k; node 1 is the tap.
    const devices: SolvedDevice[] = [
      { k: 'v', a: 0, b: -1, v: 10 },
      { k: 'r', a: 0, b: 1, r: 1000 },
      { k: 'r', a: 1, b: -1, r: 3000 },
    ]
    const c = new Circuit(2, devices)
    const r = c.step(0)
    expect(r.converged).toBe(true)
    expect(c.voltage(0)).toBeCloseTo(10, 6)
    expect(c.voltage(1)).toBeCloseTo(7.5, 4)
    // Source current is negative: it flows out of the source into the network.
    expect(Math.abs(c.deviceCurrent(0))).toBeCloseTo(10 / 4000, 6)
  })

  it('honours a source’s internal resistance under load', () => {
    // 5 V with 1 ohm internal, into a 9 ohm load -> 4.5 V at the terminals.
    const devices: SolvedDevice[] = [
      { k: 'v', a: 1, b: -1, v: 5 },
      { k: 'r', a: 0, b: 1, r: 1 },
      { k: 'r', a: 0, b: -1, r: 9 },
    ]
    const c = new Circuit(2, devices)
    c.step(0)
    expect(c.voltage(0)).toBeCloseTo(4.5, 4)
  })

  it('lands a series LED at a sane operating point', () => {
    // 5 V -> 220 ohm -> red LED (Vf 1.9 at 20 mA, 8 ohm series) -> ground.
    const is = isFromVf(1.9, 2.2, 0.02)
    const devices: SolvedDevice[] = [
      { k: 'v', a: 0, b: -1, v: 5 },
      { k: 'r', a: 0, b: 1, r: 220 },
      { k: 'r', a: 1, b: 2, r: 8 },
      { k: 'd', a: 2, b: -1, is, n: 2.2 },
    ]
    const c = new Circuit(3, devices)
    const r = c.step(0)
    expect(r.converged).toBe(true)
    const current = (5 - c.voltage(1)) / 220
    // A 220 ohm resistor on 5 V puts a red LED near 13-15 mA.
    expect(current).toBeGreaterThan(0.010)
    expect(current).toBeLessThan(0.017)
    // And the junction should sit close to its rated forward drop.
    expect(c.voltage(2)).toBeGreaterThan(1.6)
    expect(c.voltage(2)).toBeLessThan(2.2)
  })

  it('blocks current through a reverse-biased diode', () => {
    const is = isFromVf(0.7, 1.8, 0.001)
    const c = new Circuit(2, [
      { k: 'v', a: 0, b: -1, v: 5 },
      { k: 'r', a: 0, b: 1, r: 1000 },
      { k: 'd', a: -1, b: 1, is, n: 1.8 },
    ])
    c.step(0)
    // With the diode reversed, the 1k sees almost no drop.
    expect(Math.abs(5 - c.voltage(1))).toBeLessThan(0.01)
  })
})

describe('transient analysis', () => {
  it('charges an RC to 63.2 % after one time constant', () => {
    const R = 1000
    const C = 1e-6
    const tau = R * C // 1 ms
    const c = new Circuit(2, [
      { k: 'v', a: 0, b: -1, v: 10 },
      { k: 'r', a: 0, b: 1, r: R },
      { k: 'c', a: 1, b: -1, c: C },
    ])
    c.reset()
    const dt = tau / 2000
    for (let i = 0; i < 2000; i++) c.step(dt)
    expect(c.time).toBeCloseTo(tau, 6)
    // Backward Euler undershoots slightly; 1 % is well inside that.
    expect(c.voltage(1)).toBeGreaterThan(10 * 0.632 * 0.99)
    expect(c.voltage(1)).toBeLessThan(10 * 0.632 * 1.01)
  })

  it('ramps current in an inductor linearly at first', () => {
    // 10 V across 10 mH: di/dt = V/L = 1000 A/s.
    const L = 0.01
    const c = new Circuit(1, [
      { k: 'v', a: 0, b: -1, v: 10 },
      { k: 'l', a: 0, b: -1, l: L, dcr: 1e-6 },
    ])
    c.reset()
    const dt = 1e-6
    for (let i = 0; i < 100; i++) c.step(dt)
    // After 100 us the current should be about 0.1 A.
    const i = Math.abs(c.deviceCurrent(1))
    expect(i).toBeGreaterThan(0.09)
    expect(i).toBeLessThan(0.11)
  })

  it('follows a sine source', () => {
    const c = new Circuit(1, [
      { k: 'v', a: 0, b: -1, v: 0, wave: { shape: 'sine', amp: 5, freq: 1000, offset: 0, duty: 0.5, phase: 0 } },
      { k: 'r', a: 0, b: -1, r: 1000 },
    ])
    c.reset()
    const dt = 1e-6
    // Quarter period of a 1 kHz sine -> the peak.
    for (let i = 0; i < 250; i++) c.step(dt)
    expect(c.voltage(0)).toBeCloseTo(5, 1)
  })
})

describe('non-linear devices', () => {
  it('amplifies with an NPN in forward active', () => {
    // Common-emitter: 10 V rail, 1k collector, base fed through 100k.
    const c = new Circuit(3, [
      { k: 'v', a: 0, b: -1, v: 10 },
      { k: 'r', a: 0, b: 1, r: 1000 }, // collector load
      { k: 'r', a: 0, b: 2, r: 100000 }, // base bias
      { k: 'bjt', c: 1, b: 2, e: -1, pnp: false, bf: 150, is: 1e-14 },
    ])
    const r = c.step(0)
    expect(r.converged).toBe(true)
    // Base sits near a diode drop; the collector is pulled well down.
    expect(c.voltage(2)).toBeGreaterThan(0.55)
    expect(c.voltage(2)).toBeLessThan(0.85)
    expect(c.voltage(1)).toBeLessThan(9.5)
  })

  it('turns an N-channel MOSFET on and off', () => {
    const off = new Circuit(2, [
      { k: 'v', a: 0, b: -1, v: 12 },
      { k: 'r', a: 0, b: 1, r: 100 },
      { k: 'mos', d: 1, g: -1, s: -1, p: false, vth: 2, kp: 5, rds: 0.05 },
    ])
    off.step(0)
    expect(off.voltage(1)).toBeGreaterThan(11.9) // gate low -> no conduction

    const on = new Circuit(3, [
      { k: 'v', a: 0, b: -1, v: 12 },
      { k: 'v', a: 2, b: -1, v: 10 },
      { k: 'r', a: 0, b: 1, r: 100 },
      { k: 'mos', d: 1, g: 2, s: -1, p: false, vth: 2, kp: 5, rds: 0.05 },
    ])
    on.step(0)
    expect(on.voltage(1)).toBeLessThan(0.5) // gate high -> pulled to ground
  })
})
