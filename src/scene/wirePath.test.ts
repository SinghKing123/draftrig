import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { overshoot, wireCurve, wirePoints, type WireEnd } from './wirePath'
import { PortIndex } from './portIndex'
import { listInstances } from '@/state/doc'
import { STARTERS } from '@/io/starters'
import { benchClock, cncRouter, controlPanel, rover } from '@/io/builds'
import '@/parts'

/**
 * Wires have to stay where they were put.
 *
 * The complaint that started this was that wires sometimes "go through" things
 * — the board, a display — instead of running from one terminal to the other.
 * Both halves of that are measurable: a wire that leaves the line between its
 * two pins is overshooting, and a wire that dips below the pins it connects is
 * inside whatever they are seated in.
 */

const end = (pos: [number, number, number], dir: [number, number, number]): WireEnd => ({
  pos: new THREE.Vector3(...pos),
  dir: new THREE.Vector3(...dir).normalize(),
})

/** Every wire in every build that ships, with both ends resolved. */
function everyWire(): { build: string; a: WireEnd; b: WireEnd; waypoints?: THREE.Vector3[] }[] {
  const out: { build: string; a: WireEnd; b: WireEnd; waypoints?: THREE.Vector3[] }[] = []
  const docs = [
    ...STARTERS.map((s) => ({ name: s.id, doc: s.build() })),
    { name: 'bench-clock', doc: benchClock() },
    { name: 'cnc-router', doc: cncRouter() },
    { name: 'control-panel', doc: controlPanel() },
    { name: 'rover', doc: rover() },
  ]
  for (const { name, doc } of docs) {
    const index = new PortIndex(listInstances(doc))
    for (const id of doc.connectionOrder) {
      const c = doc.connections[id]
      if (!c) continue
      const a = index.get(c.a.instanceId, c.a.portId)
      const b = index.get(c.b.instanceId, c.b.portId)
      if (!a || !b) continue
      out.push({
        build: name,
        a: { pos: a.pos, dir: a.dir },
        b: { pos: b.pos, dir: b.dir },
        waypoints: c.waypoints?.map((w) => new THREE.Vector3(...w)),
      })
    }
  }
  return out
}

describe('wire path', () => {
  it('has wires to measure', () => {
    const wires = everyWire()
    expect(wires.length).toBeGreaterThan(60)
  })

  it('never reaches past either terminal', () => {
    /*
     * A tenth of a millimetre. Not zero, because the curve is sampled and a
     * spline that touches its endpoint tangentially can read a hair beyond it,
     * but far below anything a person could see: the pins it would be reaching
     * into are 2.54 mm apart.
     */
    const worst = { build: '', by: 0 }
    for (const w of everyWire()) {
      const by = overshoot(wireCurve(w.a, w.b, w.waypoints), w.a.pos, w.b.pos)
      if (by > worst.by) Object.assign(worst, { build: w.build, by })
    }
    expect(`${worst.build} ${worst.by.toFixed(2)}mm`).toBe(`${worst.build} ${worst.by.toFixed(2)}mm`)
    expect(worst.by).toBeLessThan(0.1)
  })

  it('arches above the terminals rather than dipping below them', () => {
    /*
     * Through-hole terminals point down and sit under the board. A wire
     * between two of them that goes lower than both is inside the board.
     */
    let worstDip = 0
    for (const w of everyWire()) {
      if (w.waypoints?.length) continue // routed by hand; the person chose it
      const floor = Math.min(w.a.pos.y, w.b.pos.y)
      const curve = wireCurve(w.a, w.b)
      for (let i = 0; i <= 60; i++) {
        worstDip = Math.max(worstDip, floor - curve.getPoint(i / 60).y)
      }
    }
    expect(worstDip).toBeLessThan(0.5)
  })

  it('does not launch backwards out of a terminal facing away from the run', () => {
    // Two pins facing directly apart: the old path pushed both ends outward
    // and the curve had to turn around to get back.
    const pts = wirePoints(end([0, 0, 0], [-1, 0, 0]), end([20, 0, 0], [1, 0, 0]))
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-0.001)
      expect(p.x).toBeLessThanOrEqual(20.001)
    }
  })

  it('leaves a terminal along its normal when that normal points down the wire', () => {
    const pts = wirePoints(end([0, 0, 0], [1, 0, 0]), end([40, 0, 0], [-1, 0, 0]))
    // Second point is the launch, and it has moved along +x.
    expect(pts[1].x).toBeGreaterThan(0.5)
    expect(pts[1].x).toBeLessThan(40)
  })

  it('keeps hand-placed waypoints exactly', () => {
    const w = new THREE.Vector3(5, 9, -3)
    const pts = wirePoints(end([0, 0, 0], [0, 1, 0]), end([20, 0, 0], [0, 1, 0]), [w])
    expect(pts.some((p) => p.distanceTo(w) < 1e-9)).toBe(true)
  })

  it('draws a short hop between adjacent holes as a straight line', () => {
    // 2.54 mm: one breadboard pitch. An arch here is a loop.
    const pts = wirePoints(end([0, 0, 0], [0, -1, 0]), end([2.54, 0, 0], [0, -1, 0]))
    expect(pts).toHaveLength(2)
  })
})
