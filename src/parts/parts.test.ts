import { describe, expect, it } from 'vitest'
import '@/parts'
import { allParts, getPart } from './kernel/registry'
import { buildPart, defaultParams } from './kernel/build'
import { BAND_COLORS, eng, engCompact, parseEng, resistorBands, snapE } from './kernel/units'

describe('catalog integrity', () => {
  const parts = allParts()

  it('registers a catalog', () => {
    expect(parts.length).toBeGreaterThan(15)
  })

  it.each(parts.map((p) => [p.id, p] as const))('%s builds cleanly', (_id, def) => {
    const params = defaultParams(def)
    const built = buildPart(def, params)

    expect(built.meshes.length).toBeGreaterThan(0)
    for (const m of built.meshes) {
      const pos = m.geometry.getAttribute('position')
      expect(pos.count).toBeGreaterThan(0)
      for (let i = 0; i < pos.count * 3; i++) {
        if (!isFinite(pos.array[i] as number)) throw new Error(`${def.id}: non-finite vertex`)
      }
    }

    expect(built.bbox.isEmpty()).toBe(false)
    expect(built.mass).toBeGreaterThanOrEqual(0)
    expect(isFinite(built.mass)).toBe(true)

    // Port ids must be unique, nets are keyed on them.
    const ids = built.ports.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of built.ports) {
      expect(p.pos.every(isFinite)).toBe(true)
      expect(Math.hypot(...p.dir)).toBeGreaterThan(0.5)
    }
  })

  it.each(parts.filter((p) => p.electrical).map((p) => [p.id, p] as const))(
    '%s only references terminals it declares',
    (_id, def) => {
      const params = defaultParams(def)
      const ports = new Set(def.ports(params).map((p) => p.id))
      for (const dev of def.electrical!.devices(params)) {
        const refs = Object.entries(dev)
          .filter(([k, v]) => typeof v === 'string' && k !== 'type' && k !== 'evalId')
          .map(([, v]) => v as string)
        for (const r of refs) {
          if (r.startsWith('#')) continue
          expect(ports.has(r), `${def.id}: device references unknown terminal "${r}"`).toBe(true)
        }
      }
    },
  )

  it('sweeps enum and numeric parameters without breaking', () => {
    for (const def of parts) {
      const base = defaultParams(def)
      for (const spec of def.params) {
        const values =
          spec.type === 'enum' ? spec.options.map((o) => o.value)
          : spec.type === 'bool' ? [true, false]
          : spec.type === 'number' ? [spec.min ?? spec.default, spec.default, spec.max ?? spec.default]
          : []
        for (const v of values) {
          const built = buildPart(def, { ...base, [spec.key]: v })
          expect(built.meshes.length, `${def.id} @ ${spec.key}=${String(v)}`).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('specific parts', () => {
  it('sizes a 2020 extrusion like the real stock', () => {
    const def = getPart('extrusion-tslot')!
    const readouts = def.readouts!({ ...defaultParams(def), size: '2020', length: 1000 })
    const area = parseFloat(readouts[0].value)
    // Real 20x20 profiles land around 160-210 mm^2.
    expect(area).toBeGreaterThan(150)
    expect(area).toBeLessThan(230)

    const built = buildPart(def, { ...defaultParams(def), size: '2020', length: 1000 })
    // ~0.5 kg per metre.
    expect(built.mass).toBeGreaterThan(400)
    expect(built.mass).toBeLessThan(650)
  })

  it('wires a full breadboard into the right number of nets', () => {
    const def = getPart('breadboard')!
    const ports = def.ports({ ...defaultParams(def), size: '830' })
    const electrical = ports.filter((p) => p.kind === 'electrical')
    const nets = new Set(electrical.map((p) => p.groupId ?? p.id))
    expect(electrical.length).toBeGreaterThan(700)
    // 63 columns x 2 banks + 4 rails.
    expect(nets.size).toBe(63 * 2 + 4)
  })

  it('weighs a sheet of plywood correctly', () => {
    const def = getPart('panel-sheet')!
    // 600 x 600 x 18 mm birch ply at 0.6 g/cm^3 -> ~3.9 kg.
    const built = buildPart(def, { ...defaultParams(def), material: 'plywood', width: 600, depth: 600, thickness: 18 })
    expect(built.mass / 1000).toBeGreaterThan(3.5)
    expect(built.mass / 1000).toBeLessThan(4.5)
  })
})

describe('engineering units', () => {
  it('formats values', () => {
    expect(eng(4700, 'Ω')).toBe('4.7kΩ')
    expect(eng(0.000001, 'F')).toBe('1µF')
    expect(eng(1500000)).toBe('1.5M')
    expect(eng(0)).toBe('0')
  })

  it('renders part markings', () => {
    expect(engCompact(4700)).toBe('4k7')
    expect(engCompact(100e-9)).toBe('100n')
    expect(engCompact(220)).toBe('220')
  })

  it('parses what it prints', () => {
    expect(parseEng('4k7')).toBeCloseTo(4700, 6)
    expect(parseEng('4.7k')).toBeCloseTo(4700, 6)
    expect(parseEng('100n')).toBeCloseTo(100e-9, 15)
    expect(parseEng('220')).toBeCloseTo(220, 6)
  })

  it('keeps mega and milli apart, and accepts u for micro', () => {
    // Case folding here would turn 10 milliohms into 10 megohms.
    expect(parseEng('10M')).toBeCloseTo(10e6, 0)
    expect(parseEng('10m')).toBeCloseTo(0.01, 9)
    // Nobody types the micro sign, so u and U have to work.
    expect(parseEng('470u')).toBeCloseTo(470e-6, 12)
    expect(parseEng('470µ')).toBeCloseTo(470e-6, 12)
    expect(parseEng('4u7')).toBeCloseTo(4.7e-6, 12)
    // There is no capital-K prefix, so K is safe to accept as kilo.
    expect(parseEng('10K')).toBeCloseTo(10000, 6)
  })

  it('reads out the standard colour code', () => {
    // 4.7k, 5 %: yellow violet red gold
    const bands = resistorBands(4700, 5)
    expect(bands[0]).toBe(BAND_COLORS[4])
    expect(bands[1]).toBe(BAND_COLORS[7])
    expect(bands[2]).toBe(BAND_COLORS[2])
    expect(bands[3]).toBe('#C9A227')

    // 220R, 5 %: red red brown gold
    const b220 = resistorBands(220, 5)
    expect(b220[0]).toBe(BAND_COLORS[2])
    expect(b220[1]).toBe(BAND_COLORS[2])
    expect(b220[2]).toBe(BAND_COLORS[1])

    // 1 % parts get a third significant digit: 4.7k -> yellow violet black brown
    const precise = resistorBands(4700, 1)
    expect(precise).toHaveLength(5)
    expect(precise[2]).toBe(BAND_COLORS[0])
    expect(precise[3]).toBe(BAND_COLORS[1])
  })

  it('snaps to the E24 series', () => {
    expect(snapE(4600, 24)).toBeCloseTo(4700, 0)
    expect(snapE(1020, 24)).toBeCloseTo(1000, 0)
    // Snapping is geometric, so 1050 is nearer 1.1 than 1.0.
    expect(snapE(1050, 24)).toBeCloseTo(1100, 0)
    // And the top of a decade rolls into the next one.
    expect(snapE(9600, 24)).toBeCloseTo(10000, 0)
    expect(snapE(4600, 12)).toBeCloseTo(4700, 0)
  })
})
