import { describe, expect, it } from 'vitest'
import '@/parts'
import { searchParts } from '@/parts/kernel/registry'

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
