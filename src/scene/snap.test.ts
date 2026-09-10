import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import '@/parts'
import { emptyDoc, type Doc } from '@/state/doc'
import { defaultParams, requirePart } from '@/parts/kernel/registry'
import type { Params, Vec3 } from '@/parts/kernel/types'
import { SnapSession, canSnap } from './snap'

/**
 * Snapping decides whether a build comes together by being moved near the
 * right place or by being typed into the right place, so the rules are worth
 * pinning down: what may join what, and that a part actually lands on the
 * terminal rather than beside it.
 */

let n = 0
function put(doc: Doc, defId: string, pos: Vec3, params: Params = {}, rot: Vec3 = [0, 0, 0]): string {
  const def = requirePart(defId)
  const id = `s${n++}`
  doc.instances[id] = { id, defId, name: id, params: { ...defaultParams(def), ...params }, pos, rot }
  doc.order.push(id)
  return id
}

const port = (defId: string, portId: string, params: Params = {}) => {
  const def = requirePart(defId)
  const p = def.ports({ ...defaultParams(def), ...params }).find((x) => x.id === portId)
  if (!p) throw new Error(`${defId} has no port ${portId}`)
  return p
}

describe('what may join what', () => {
  it('lets a screw shank into a tapped extrusion end', () => {
    expect(canSnap(port('screw-bhcs', 'shank'), port('extrusion-tslot', 'end-a-00'))).toBe(true)
  })

  it('lets a T-nut into an extrusion slot', () => {
    const nut = port('tnut-2020', 'slot')
    const slot = requirePart('extrusion-tslot')
      .ports(defaultParams(requirePart('extrusion-tslot')))
      .find((p) => p.mate?.type === 'tslot')
    expect(slot).toBeDefined()
    expect(canSnap(nut, slot!)).toBe(true)
  })

  it('refuses a flat face against a threaded hole', () => {
    expect(canSnap(port('panel-sheet', 'top'), port('tnut-2020', 'thread'))).toBe(false)
  })

  it('refuses an electrical lead against a mechanical mount', () => {
    expect(canSnap(port('led-5mm', 'a'), port('mcu-board', 'mount0'))).toBe(false)
  })

  it('refuses sizes from different families', () => {
    const m3 = { id: 'a', label: 'a', kind: 'mechanical' as const, pos: [0, 0, 0] as Vec3, dir: [0, 1, 0] as Vec3, mate: { type: 'stud' as const, size: 3 } }
    const m10 = { ...m3, mate: { type: 'hole' as const, size: 10 } }
    const m3hole = { ...m3, mate: { type: 'hole' as const, size: 3.2 } }
    expect(canSnap(m3, m10)).toBe(false)
    expect(canSnap(m3, m3hole)).toBe(true)
  })
})

describe('snapping a part into place', () => {
  it('pulls a resistor lead into a breadboard hole', () => {
    const doc = emptyDoc()
    put(doc, 'breadboard', [0, 0, 0], { size: '830' })
    // Standing above the board and a few millimetres off a column.
    const res = put(doc, 'resistor-axial', [3.1, 11.4, 8.2], { value: 220 })

    const session = new SnapSession(doc, [res])
    const hit = session.solve(new THREE.Vector3(0, 0, 0))

    expect(hit).not.toBeNull()
    expect(hit!.kind).toBe('electrical')
    expect(hit!.targetInstance).not.toBe(res)
    // Applying the offset puts the lead exactly on the hole.
    expect(hit!.offset.length()).toBeLessThan(9)
    expect(hit!.offset.length()).toBeGreaterThan(0)
  })

  it('leaves a part alone when nothing is within reach', () => {
    const doc = emptyDoc()
    put(doc, 'breadboard', [0, 0, 0], { size: '830' })
    const res = put(doc, 'resistor-axial', [400, 60, 400], { value: 220 })
    const session = new SnapSession(doc, [res])
    expect(session.solve(new THREE.Vector3(0, 0, 0))).toBeNull()
  })

  it('never snaps a part to itself', () => {
    const doc = emptyDoc()
    const bb = put(doc, 'breadboard', [0, 0, 0], { size: '830' })
    const session = new SnapSession(doc, [bb])
    const hit = session.solve(new THREE.Vector3(0, 0, 0))
    expect(hit).toBeNull()
  })

  it('joins a bracket to an extrusion as a mechanical mate', () => {
    const doc = emptyDoc()
    const ext = put(doc, 'extrusion-tslot', [0, 0, 0], { size: '2020', length: 300 })
    const screw = put(doc, 'screw-bhcs', [-152, 10, 10], { thread: 'M5', length: 12 }, [0, 0, 90])

    const session = new SnapSession(doc, [screw])
    const hit = session.solve(new THREE.Vector3(0, 0, 0), 14)
    expect(hit).not.toBeNull()
    expect(hit!.kind).toBe('mechanical')
    expect(hit!.targetInstance).toBe(ext)
  })

  it('tracks the drag, so the snap follows where the part is going', () => {
    const doc = emptyDoc()
    put(doc, 'breadboard', [0, 0, 0], { size: '830' })
    const res = put(doc, 'resistor-axial', [3.1, 11.4, 200], { value: 220 })
    const session = new SnapSession(doc, [res])

    expect(session.solve(new THREE.Vector3(0, 0, 0))).toBeNull()
    // Dragged back over the board, the same session now finds a hole.
    const hit = session.solve(new THREE.Vector3(0, 0, -192))
    expect(hit).not.toBeNull()
  })
})
