import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import '@/parts'
import { useDoc } from '@/state/doc'
import { buildPart, defaultParams, instanceMatrix } from '@/parts/kernel/build'
import { requirePart } from '@/parts/kernel/registry'
import { nearestSnap, readLength, snapPoints, useRuler } from './rulerState'

/**
 * The ruler's arithmetic.
 *
 * The gesture needs a browser, but everything that decides whether a
 * measurement is right does not: which points it will snap to, which
 * one it picks for a given pointer, and how the figure reads.
 */

const place = (defId: string, at: [number, number, number]) => {
  const id = useDoc.getState().addPart(defId, at, defaultParams(requirePart(defId)))
  if (!id) throw new Error(`could not place ${defId}`)
  return id
}

beforeEach(() => {
  useDoc.getState().newDoc()
  useRuler.getState().setOn(false)
})

describe('what the ruler will snap to', () => {
  it('offers the corners of the part, in world space', () => {
    const id = place('projector', [500, 0, -250])
    const inst = useDoc.getState().doc.instances[id]
    const box = buildPart(requirePart('projector'), inst.params).bbox
      .clone()
      .applyMatrix4(instanceMatrix(inst.pos, inst.rot))

    const points = snapPoints(id)
    expect(points.length).toBeGreaterThanOrEqual(27)

    // Every one of the eight corners is on offer, at its real position.
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const corner = new THREE.Vector3(x, y, z)
          const hit = points.some((p) => p.distanceTo(corner) < 1e-6)
          expect(hit, `corner ${x},${y},${z} is not offered`).toBe(true)
        }
      }
    }
  })

  it('offers the terminals too, so you can measure to a socket', () => {
    const id = place('outlet-mains', [0, 1200, 0])
    const def = requirePart('outlet-mains')
    const inst = useDoc.getState().doc.instances[id]
    const m = instanceMatrix(inst.pos, inst.rot)
    const points = snapPoints(id)
    for (const port of def.ports({ ...defaultParams(def), ...inst.params })) {
      const at = new THREE.Vector3(...port.pos).applyMatrix4(m)
      expect(points.some((p) => p.distanceTo(at) < 1e-6), `port ${port.id} missing`).toBe(true)
    }
  })

  it('gives nothing for a part that is not there', () => {
    expect(snapPoints('no-such-instance')).toEqual([])
  })
})

describe('choosing the nearest point to the pointer', () => {
  const camera = new THREE.PerspectiveCamera(50, 4 / 3, 1, 100000)
  const size = { width: 1200, height: 900 }

  const screenOf = (p: THREE.Vector3) => {
    const v = p.clone().project(camera)
    return new THREE.Vector2(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height)
  }

  beforeEach(() => {
    camera.position.set(0, 800, 2200)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld(true)
    camera.updateProjectionMatrix()
  })

  it('takes the candidate under the pointer', () => {
    const want = new THREE.Vector3(300, 0, 0)
    const candidates = [new THREE.Vector3(-600, 0, 0), want, new THREE.Vector3(900, 0, 0)]
    const got = nearestSnap(candidates, screenOf(want), camera, size)
    expect(got).not.toBeNull()
    expect(got!.distanceTo(want)).toBeLessThan(1e-6)
  })

  it('refuses a candidate that is not close enough on screen', () => {
    const far = new THREE.Vector3(900, 0, 0)
    const pointer = screenOf(new THREE.Vector3(-900, 0, 0))
    expect(nearestSnap([far], pointer, camera, size)).toBeNull()
  })

  it('ignores what is behind the camera', () => {
    const behind = new THREE.Vector3(0, 800, 9000)
    expect(nearestSnap([behind], screenOf(behind), camera, size)).toBeNull()
  })
})

describe('taking points', () => {
  const A = new THREE.Vector3(0, 0, 0)
  const B = new THREE.Vector3(1000, 0, 0)
  const C = new THREE.Vector3(0, 500, 0)

  it('fills the first point, then the second', () => {
    const r = useRuler.getState()
    r.setOn(true)
    r.place(A)
    expect(useRuler.getState().from).not.toBeNull()
    expect(useRuler.getState().to).toBeNull()
    useRuler.getState().place(B)
    expect(useRuler.getState().to!.x).toBe(1000)
  })

  it('starts the next measurement on the third point', () => {
    const r = useRuler.getState()
    r.setOn(true)
    r.place(A)
    useRuler.getState().place(B)
    useRuler.getState().place(C)
    expect(useRuler.getState().from!.y).toBe(500)
    expect(useRuler.getState().to).toBeNull()
  })

  it('forgets the span when it is put away', () => {
    const r = useRuler.getState()
    r.setOn(true)
    r.place(A)
    useRuler.getState().place(B)
    useRuler.getState().setOn(false)
    expect(useRuler.getState().from).toBeNull()
    expect(useRuler.getState().to).toBeNull()
  })
})

describe('how the figure reads', () => {
  it('uses metres once it is a room-sized distance', () => {
    expect(readLength(1000)).toBe('1.000 m')
    expect(readLength(3820)).toBe('3.820 m')
    expect(readLength(12000)).toBe('12.00 m')
  })

  it('uses millimetres below that, with the precision the size deserves', () => {
    expect(readLength(600)).toBe('600 mm')
    expect(readLength(18.5)).toBe('18.5 mm')
    expect(readLength(2.54)).toBe('2.54 mm')
  })
})
