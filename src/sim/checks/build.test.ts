import { describe, expect, it } from 'vitest'
import '@/parts'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams, requirePart } from '@/parts/kernel/registry'
import type { Params } from '@/parts/kernel/types'
import { checkBuild } from './build'

/**
 * The point of modelling a PC here is that it tells you what will not go
 * together before you have paid for it, so these are the rules that matter.
 */

let n = 0
function put(doc: Doc, defId: string, params: Params = {}): string {
  const def = requirePart(defId)
  const id = `s${n++}`
  doc.instances[id] = {
    id, defId, name: def.name, params: { ...defaultParams(def), ...params }, pos: [0, 0, 0], rot: [0, 0, 0],
  }
  doc.order.push(id)
  return id
}

const messages = (doc: Doc): string => checkBuild(doc).map((i) => i.message).join(' | ')

describe('PC build rules', () => {
  it('says nothing about a circuit that is not a computer', () => {
    const d = emptyDoc()
    put(d, 'resistor-axial')
    put(d, 'led-5mm')
    expect(checkBuild(d)).toEqual([])
  })

  it('rejects a processor that does not match the socket', () => {
    const d = emptyDoc()
    put(d, 'motherboard', { socket: 'AM5' })
    put(d, 'cpu', { socket: 'LGA1700' })
    expect(messages(d)).toContain('LGA1700 and the board is AM5')
  })

  it('rejects memory of the wrong standard', () => {
    const d = emptyDoc()
    put(d, 'motherboard', { socket: 'AM4' })
    put(d, 'cpu', { socket: 'AM4' })
    put(d, 'ram-dimm', { standard: 'DDR5' })
    expect(messages(d)).toContain('DDR5 and this board takes DDR4')
  })

  it('accepts a matched set without complaint about compatibility', () => {
    const d = emptyDoc()
    put(d, 'motherboard', { form: 'atx', socket: 'AM5' })
    put(d, 'cpu', { socket: 'AM5', tdp: 105 })
    put(d, 'ram-dimm', { standard: 'DDR5' })
    put(d, 'cpu-cooler', { height: 158, watts: 220 })
    put(d, 'pc-case', { size: 'mid' })
    put(d, 'power-supply', { watts: 750 })
    const text = messages(d)
    expect(text).not.toContain('will not go in')
    expect(text).not.toContain('does not fit')
    expect(text).not.toContain('too long')
  })

  it('catches a board that will not fit the case', () => {
    const d = emptyDoc()
    put(d, 'motherboard', { form: 'atx' })
    put(d, 'pc-case', { size: 'itx' })
    expect(messages(d)).toContain('ATX does not fit')
  })

  it('catches a card that is too long and a cooler that is too tall', () => {
    const d = emptyDoc()
    put(d, 'pc-case', { size: 'itx' })
    put(d, 'graphics-card', { length: 340 })
    put(d, 'cpu-cooler', { height: 158 })
    const text = messages(d)
    expect(text).toContain('too long')
    expect(text).toContain('clears 70 mm')
  })

  it('adds up the power budget and says when the supply is short', () => {
    const d = emptyDoc()
    put(d, 'motherboard')
    put(d, 'cpu', { tdp: 170 })
    put(d, 'graphics-card', { tdp: 450 })
    put(d, 'ram-dimm')
    put(d, 'ram-dimm')
    put(d, 'power-supply', { watts: 550 })
    // 30 + 170 + 450 + 10 = 660 W against a 550 W supply.
    expect(messages(d)).toContain('660 W and the supply is rated for 550 W')
  })

  it('warns when the supply is technically enough but has no headroom', () => {
    const d = emptyDoc()
    put(d, 'motherboard')
    put(d, 'cpu', { tdp: 105 })
    put(d, 'graphics-card', { tdp: 285 })
    put(d, 'power-supply', { watts: 450 })
    expect(messages(d)).toContain('headroom')
  })

  it('notices a processor with nothing on top of it', () => {
    const d = emptyDoc()
    put(d, 'motherboard')
    put(d, 'cpu')
    put(d, 'ram-dimm')
    expect(messages(d)).toContain('No cooler')
  })

  it('notices a cooler that cannot keep up', () => {
    const d = emptyDoc()
    put(d, 'motherboard')
    put(d, 'cpu', { tdp: 250 })
    put(d, 'ram-dimm')
    put(d, 'cpu-cooler', { watts: 120 })
    expect(messages(d)).toContain('will throttle')
  })
})
