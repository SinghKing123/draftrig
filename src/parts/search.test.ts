import { describe, expect, it } from 'vitest'
import '@/parts'
import { requirePart, searchParts, valueTargetFor } from '@/parts/kernel/registry'

describe('part search', () => {
  it('puts the obvious answer first', () => {
    expect(searchParts('led')[0].id).toBe('led-5mm')
    expect(searchParts('resistor')[0].id).toBe('resistor-axial')
    expect(searchParts('555')[0].id).toBe('ne555')
    expect(searchParts('2020')[0].id).toBe('extrusion-tslot')
    expect(searchParts('breadboard')[0].id).toBe('breadboard')
    expect(searchParts('motor')[0].id).toBe('motor-dc')
    expect(searchParts('plywood')[0].id).toBe('panel-sheet')
    expect(searchParts('arduino')[0].id).toBe('mcu-board')
    expect(searchParts('mosfet')[0].id).toBe('mosfet')
  })

  it('prefers the part a word describes over one that merely starts with it', () => {
    // "Motor driver" starts with the word, but the DC motor is tagged as one.
    expect(searchParts('motor')[0].id).toBe('motor-dc')
    expect(searchParts('motor driver')[0].id).toBe('motor-driver')
  })

  it('does not match a substring buried inside a word', () => {
    // "drilled" contains "led"; the perfboard must not outrank the LED.
    const ids = searchParts('led').map((d) => d.id)
    expect(ids.indexOf('led-5mm')).toBeLessThan(ids.indexOf('perfboard'))
  })

  it('finds parts by manufacturer part number', () => {
    expect(searchParts('NE555P')[0].id).toBe('ne555')
    expect(searchParts('1N4148')[0].id).toBe('diode-do35')
  })

  it('returns everything for an empty query', () => {
    expect(searchParts('  ').length).toBeGreaterThan(20)
  })
})

describe('value search', () => {
  it('finds parts by the value you would actually type', () => {
    // These are the exact examples the site and the tour tell people to try.
    expect(searchParts('10k').map((d) => d.id)).toContain('resistor-axial')
    expect(searchParts('220').map((d) => d.id)).toContain('resistor-axial')
    expect(searchParts('4k7').map((d) => d.id)).toContain('resistor-axial')
    expect(searchParts('100n').map((d) => d.id)).toContain('capacitor-ceramic')
    expect(searchParts('470u').map((d) => d.id)).toContain('capacitor-electrolytic')
  })

  it('picks the unit that suits the magnitude', () => {
    // 10k is a plausible resistance and an absurd capacitance.
    const forTenK = searchParts('10k')[0]
    expect(['resistor-axial', 'potentiometer']).toContain(forTenK.id)
    // 100n is only sane as a capacitance.
    expect(searchParts('100n')[0].category).toBe('passive')
  })

  it('does not mistake a part number for a value', () => {
    expect(searchParts('2N3904')[0].id).toBe('transistor-to92')
    expect(searchParts('1N4148')[0].id).toBe('diode-do35')
  })

  it('reports which parameter a value should be written to', () => {
    const resistor = requirePart('resistor-axial')
    expect(valueTargetFor(resistor, '10k')).toEqual({ key: 'value', value: 10000 })
    const cap = requirePart('capacitor-ceramic')
    expect(valueTargetFor(cap, '100n')?.key).toBe('value')
    expect(valueTargetFor(cap, '100n')?.value).toBeCloseTo(1e-7, 12)
    // A word is not a value.
    expect(valueTargetFor(resistor, 'resistor')).toBeNull()
  })
})

describe('the examples we tell people to try', () => {
  // Every value the tour, the landing page chips and the empty library state
  // suggest. If one of these stops returning anything, the product is telling
  // people to do something that does not work.
  const SUGGESTED = ['10k', '2020', '555', 'mosfet', 'plywood', 'breadboard', 'switch', '100n']

  it.each(SUGGESTED)('"%s" returns something', (q) => {
    expect(searchParts(q).length).toBeGreaterThan(0)
  })
})
