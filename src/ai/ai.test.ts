import { describe, expect, it } from 'vitest'
import '@/parts'
import { allParts } from '@/parts/kernel/registry'
import { validatePlan } from './plan'
import { applyPlan, describeBench } from './apply'
import { catalogPrompt } from './catalog'
import { emptyDoc } from '@/state/doc'
import { buildNetlist } from '@/sim/circuit/netlist'

const ids = (): string[] => allParts().map((p) => p.id)

/**
 * The validator is the only thing standing between a confidently wrong model
 * and the document, so it is tested as an adversary rather than as a helper.
 */

describe('plan validation', () => {
  it('accepts a plan that only uses real parts and real pins', () => {
    const r = validatePlan(
      {
        summary: 'An LED on a bench supply.',
        parts: [
          { ref: 'ps', part: 'bench-supply', params: { voltage: 5 } },
          { ref: 'r', part: 'resistor-axial', params: { value: 220 } },
          { ref: 'd', part: 'led-5mm', params: { color: 'red' } },
          { ref: 'g', part: 'ground' },
        ],
        wires: [
          { from: ['ps', 'p'], to: ['r', '1'] },
          { from: ['r', '2'], to: ['d', 'a'] },
          { from: ['d', 'c'], to: ['ps', 'n'] },
          { from: ['ps', 'n'], to: ['g', 'gnd'] },
        ],
      },
      ids(),
    )
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
    expect(r.plan.parts).toHaveLength(4)
    expect(r.plan.wires).toHaveLength(4)
  })

  it('rejects a part that does not exist, and suggests the nearest', () => {
    const r = validatePlan(
      { summary: '', parts: [{ ref: 'a', part: 'resistor-smd-0805' }], wires: [] },
      ids(),
    )
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('no part "resistor-smd-0805"')
    expect(r.errors[0]).toContain('resistor-axial')
  })

  it('rejects a pin the part does not have, and lists the ones it does', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [
          { ref: 'r', part: 'resistor-axial' },
          { ref: 'd', part: 'led-5mm' },
        ],
        // Resistors here have pins 1 and 2, not a and b.
        wires: [{ from: ['r', 'b'], to: ['d', 'a'] }],
      },
      ids(),
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('no pin "b"')
    expect(r.errors.join(' ')).toContain('1, 2')
  })

  it('rejects a wire to a part that was never placed', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [{ ref: 'r', part: 'resistor-axial' }],
        wires: [{ from: ['r', '1'], to: ['ghost', 'a'] }],
      },
      ids(),
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('"ghost"')
  })

  it('rejects two parts claiming the same handle', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [
          { ref: 'r', part: 'resistor-axial' },
          { ref: 'r', part: 'led-5mm' },
        ],
        wires: [],
      },
      ids(),
    )
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('share the handle')
  })

  it('clamps a number the part could never accept instead of trusting it', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [{ ref: 'r', part: 'resistor-axial', params: { value: 1e30 } }],
        wires: [],
      },
      ids(),
    )
    expect(r.ok).toBe(true)
    // The part tops out at a gigaohm, so that is where it lands.
    expect(r.plan.parts[0].params!.value).toBe(1e9)
  })

  it('drops an unknown parameter as a warning rather than failing the build', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [{ ref: 'r', part: 'resistor-axial', params: { ohms: 220 } }],
        wires: [],
      },
      ids(),
    )
    expect(r.ok).toBe(true)
    // The resistance parameter is called "value" here, so "ohms" is dropped
    // rather than silently carried into the document as a key nothing reads.
    expect(r.plan.parts[0].params).not.toHaveProperty('ohms')
    expect(r.warnings.join(' ')).toContain('no parameter "ohms"')
  })

  it('rejects an enum value outside the options', () => {
    const r = validatePlan(
      {
        summary: '',
        parts: [{ ref: 'd', part: 'led-5mm', params: { color: 'ultraviolet' } }],
        wires: [],
      },
      ids(),
    )
    expect(r.warnings.join(' ')).toContain('must be one of')
  })

  it('survives complete nonsense without throwing', () => {
    for (const junk of [null, undefined, 42, 'hello', [], { parts: 'no' }, { parts: [null] }]) {
      const r = validatePlan(junk, ids())
      expect(r.ok).toBe(false)
      expect(Array.isArray(r.errors)).toBe(true)
    }
  })
})

describe('applying a plan', () => {
  const goodPlan = {
    summary: 'LED and resistor.',
    parts: [
      { ref: 'ps', part: 'bench-supply', params: { voltage: 5 } },
      { ref: 'r', part: 'resistor-axial', params: { value: 220 } },
      { ref: 'd', part: 'led-5mm' },
      { ref: 'g', part: 'ground' },
    ],
    wires: [
      { from: ['ps', 'p'], to: ['r', '1'] },
      { from: ['r', '2'], to: ['d', 'a'] },
      { from: ['d', 'c'], to: ['ps', 'n'] },
      { from: ['ps', 'n'], to: ['g', 'gnd'] },
    ],
  }

  it('produces a document the netlist compiler accepts', () => {
    const r = validatePlan(goodPlan, ids())
    expect(r.ok).toBe(true)
    const { doc } = applyPlan(r.plan, emptyDoc())

    expect(doc.order).toHaveLength(4)
    expect(doc.connectionOrder).toHaveLength(4)

    const nl = buildNetlist(doc)
    expect(nl.errors).toEqual([])
    nl.circuit.step(0)
    // The whole point: it is a real circuit, so a real current flows.
    const led = nl.devices.find((d) => d.luminous)
    expect(led).toBeDefined()
    expect(nl.circuit.deviceCurrent(led!.index)).toBeGreaterThan(0.005)
  })

  it('lays parts out without stacking them on top of each other', () => {
    const r = validatePlan(goodPlan, ids())
    const { doc } = applyPlan(r.plan, emptyDoc())
    const spots = doc.order.map((id) => doc.instances[id].pos.join(','))
    expect(new Set(spots).size).toBe(spots.length)
  })

  it('adds to a bench rather than overwriting it', () => {
    const r = validatePlan(goodPlan, ids())
    const first = applyPlan(r.plan, emptyDoc())
    const second = applyPlan(r.plan, first.doc)
    expect(second.doc.order).toHaveLength(8)
    expect(second.doc.connectionOrder).toHaveLength(8)
  })
})

describe('catalog grounding', () => {
  it('lists every part with its pins, so nothing has to be guessed', () => {
    const text = catalogPrompt()
    for (const id of ['resistor-axial', 'led-5mm', 'mcu-board', 'display-lcd-character', 'extrusion-tslot']) {
      expect(text).toContain(id)
    }
    // The pins a model would otherwise invent.
    expect(text).toContain('pins:')
    expect(text).toMatch(/display-lcd-character[\s\S]{0,400}rs/)
  })

  it('describes an empty bench as empty', () => {
    expect(describeBench(emptyDoc())).toBe('')
  })
})
