import { describe, expect, it } from 'vitest'
import '@/parts'
import { buildNetlist, portKey } from './netlist'
import { STARTERS } from '@/io/starters'
import type { Doc } from '@/state/doc'
import { emptyDoc } from '@/state/doc'
import { defaultParams } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import type { Params, Vec3 } from '@/parts/kernel/types'

function doc(): Doc & {
  put: (defId: string, params?: Params, pos?: Vec3) => string
  join: (a: [string, string], b: [string, string]) => string
} {
  const d = emptyDoc() as ReturnType<typeof doc>
  let n = 0
  d.put = (defId, params = {}, pos = [0, 0, 0]) => {
    const def = requirePart(defId)
    const id = `i${n++}`
    d.instances[id] = { id, defId, name: id, params: { ...defaultParams(def), ...params }, pos, rot: [0, 0, 0] }
    d.order.push(id)
    return id
  }
  d.join = (a, b) => {
    const id = `c${n++}`
    d.connections[id] = { id, kind: 'wire', a: { instanceId: a[0], portId: a[1] }, b: { instanceId: b[0], portId: b[1] }, gauge: 0.205 }
    d.connectionOrder.push(id)
    return id
  }
  return d
}

describe('netlist compilation', () => {
  it('lights an LED from a battery through a resistor', () => {
    const d = doc()
    const bat = d.put('battery-holder', { cell: 'aa', count: 4 })
    const res = d.put('resistor-axial', { value: 220 })
    const led = d.put('led-5mm', { color: 'red' })
    const gnd = d.put('ground')

    d.join([bat, 'p'], [res, '1'])
    d.join([res, '2'], [led, 'a'])
    d.join([led, 'c'], [bat, 'n'])
    d.join([bat, 'n'], [gnd, 'gnd'])

    const nl = buildNetlist(d)
    expect(nl.errors).toHaveLength(0)
    const r = nl.circuit.step(0)
    expect(r.converged).toBe(true)

    // 4 x AA is ~6 V; through 220 R into a red LED that is roughly 18 mA.
    const wire = nl.wires[0]
    const current = Math.abs(nl.circuit.deviceCurrent(wire.index))
    expect(current).toBeGreaterThan(0.012)
    expect(current).toBeLessThan(0.025)

    // The battery terminal should sag slightly under load, not sit at 6.00 V.
    const vbat = nl.circuit.voltage(nl.nodeOf.get(portKey(bat, 'p'))!)
    expect(vbat).toBeGreaterThan(5.5)
    expect(vbat).toBeLessThan(6.0)
  })

  it('treats a breadboard column as one node', () => {
    const d = doc()
    const bb = d.put('breadboard', { size: '400' })
    const sup = d.put('bench-supply', { voltage: 5 })
    const res = d.put('resistor-axial', { value: 1000 })
    const gnd = d.put('ground')

    // Feed column 3 row A; take it back out of column 3 row E.
    d.join([sup, 'p'], [bb, 'a3_0'])
    d.join([bb, 'a3_4'], [res, '1'])
    d.join([res, '2'], [sup, 'n'])
    d.join([sup, 'n'], [gnd, 'gnd'])

    const nl = buildNetlist(d)
    nl.circuit.step(0)

    // Both holes of column 3 must resolve to the same node.
    expect(nl.nodeOf.get(portKey(bb, 'a3_0'))).toBe(nl.nodeOf.get(portKey(bb, 'a3_4')))
    // ...and a different one from a neighbouring column.
    expect(nl.nodeOf.get(portKey(bb, 'a4_0'))).not.toBe(nl.nodeOf.get(portKey(bb, 'a3_0')))

    const i = Math.abs(nl.circuit.deviceCurrent(nl.wires[0].index))
    expect(i).toBeCloseTo(0.005, 3)
  })

  it('opens the circuit when a switch is off', () => {
    const d = doc()
    const sup = d.put('bench-supply', { voltage: 12 })
    const sw = d.put('switch-toggle', { on: false })
    const motor = d.put('motor-dc', { rwind: 3.2 })
    const gnd = d.put('ground')

    d.join([sup, 'p'], [sw, 'com'])
    d.join([sw, 'no'], [motor, 'p'])
    d.join([motor, 'n'], [sup, 'n'])
    d.join([sup, 'n'], [gnd, 'gnd'])

    const off = buildNetlist(d)
    off.circuit.step(0)
    expect(Math.abs(off.circuit.deviceCurrent(off.wires[0].index))).toBeLessThan(1e-6)

    d.instances[sw].params.on = true
    const on = buildNetlist(d)
    on.circuit.step(0)
    // 12 V into 3.2 ohm is a little under 4 A.
    expect(Math.abs(on.circuit.deviceCurrent(on.wires[0].index))).toBeGreaterThan(3.5)
  })

  it('divides with a potentiometer', () => {
    const d = doc()
    const sup = d.put('bench-supply', { voltage: 10 })
    const pot = d.put('potentiometer', { value: 10000, pos: 25, taper: 'lin' })
    const gnd = d.put('ground')

    d.join([sup, 'p'], [pot, 'a'])
    d.join([pot, 'b'], [sup, 'n'])
    d.join([sup, 'n'], [gnd, 'gnd'])

    const nl = buildNetlist(d)
    nl.circuit.step(0)
    const vw = nl.circuit.voltage(nl.nodeOf.get(portKey(pot, 'w'))!)
    // Wiper at 25 % from the A end, which is tied to +10 V: 7.5 V.
    expect(vw).toBeCloseTo(7.5, 1)
  })

  it('flags a circuit with no ground', () => {
    const d = doc()
    const res = d.put('resistor-axial', { value: 100 })
    const led = d.put('led-5mm')
    d.join([res, '2'], [led, 'a'])
    const nl = buildNetlist(d)
    expect(nl.errors.length).toBeGreaterThan(0)
    expect(nl.errors[0]).toMatch(/0 V reference/)
  })

  it('reports resistance along a wire run', () => {
    const d = doc()
    const sup = d.put('bench-supply', { voltage: 5 }, [0, 0, 0])
    const res = d.put('resistor-axial', { value: 1 }, [1000, 0, 0])
    const gnd = d.put('ground')
    d.join([sup, 'p'], [res, '1'])
    d.join([res, '2'], [sup, 'n'])
    d.join([sup, 'n'], [gnd, 'gnd'])

    const nl = buildNetlist(d)
    // A metre of 24 AWG is a real fraction of an ohm, so it must be modelled.
    expect(nl.wires[0].lengthMm).toBeGreaterThan(900)
    nl.circuit.step(0)
    const i = Math.abs(nl.circuit.deviceCurrent(nl.wires[0].index))
    // 5 V into 1 ohm plus wiring and supply impedance: under the ideal 5 A.
    expect(i).toBeGreaterThan(3)
    expect(i).toBeLessThan(5)
  })
})

describe('starter projects', () => {
  it.each(STARTERS.map((s) => [s.id, s] as const))('%s compiles and solves', (_id, starter) => {
    const d = starter.build()

    // Every wire must reference terminals that actually exist.
    for (const cid of d.connectionOrder) {
      const c = d.connections[cid]
      for (const end of [c.a, c.b]) {
        const inst = d.instances[end.instanceId]
        expect(inst, `${starter.id}: wire ${cid} references a missing part`).toBeTruthy()
        const def = requirePart(inst.defId)
        const ids = new Set(def.ports(inst.params).map((p) => p.id))
        expect(ids.has(end.portId), `${starter.id}: no terminal "${end.portId}" on ${inst.name}`).toBe(true)
      }
    }

    const nl = buildNetlist(d)
    expect(nl.errors, `${starter.id}: ${nl.errors.join('; ')}`).toHaveLength(0)
    const r = nl.circuit.step(0)
    expect(r.converged, `${starter.id} failed to converge`).toBe(true)
  })

  it('drives the starter LED at a safe current', () => {
    const d = STARTERS.find((s) => s.id === 'led')!.build()
    const nl = buildNetlist(d)
    nl.circuit.step(0)
    const ledDevice = nl.devices.find((x) => x.luminous)
    expect(ledDevice).toBeTruthy()
    const i = nl.circuit.deviceCurrent(ledDevice!.index)
    expect(i).toBeGreaterThan(0.004)
    expect(i).toBeLessThan(0.03)
  })
})
