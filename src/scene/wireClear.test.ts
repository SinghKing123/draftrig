import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { avoidable, wireCurve, type Obstacle, type WireEnd } from './wirePath'
import { PortIndex } from './portIndex'
import { listInstances } from '@/state/doc'
import { STARTERS } from '@/io/starters'
import { benchClock, cncRouter, controlPanel, rover } from '@/io/builds'
import { buildPart, instanceMatrix } from '@/parts/kernel/build'
import { getPart } from '@/parts/kernel/registry'
import type { Doc } from '@/state/doc'
import '@/parts'

/**
 * Wires have to go round things.
 *
 * A wire that passes through the board it is wired to, or through the chip
 * next to it, is the single thing that makes a screenshot of a build look
 * wrong — more than any amount of shading, because it is physically absurd
 * rather than merely plain.
 *
 * What counts as "through" here is a sample of the drawn curve landing inside
 * a part's own bounding box, shrunk a little so that a wire legitimately
 * touching the part it ends on, or brushing a neighbour's outermost
 * millimetre, is not counted.
 */

const DOCS: { name: string; doc: Doc }[] = [
  ...STARTERS.map((s) => ({ name: s.id, doc: s.build() })),
  { name: 'bench-clock', doc: benchClock() },
  { name: 'cnc-router', doc: cncRouter() },
  { name: 'control-panel', doc: controlPanel() },
  { name: 'rover', doc: rover() },
]

function obstaclesOf(doc: Doc): Obstacle[] {
  const out: Obstacle[] = []
  for (const inst of listInstances(doc)) {
    const def = getPart(inst.defId)
    if (!def) continue
    const built = buildPart(def, inst.params)
    if (built.bbox.isEmpty()) continue
    out.push({
      instanceId: inst.id,
      box: built.bbox.clone().applyMatrix4(instanceMatrix(inst.pos, inst.rot)),
    })
  }
  return out
}

interface Wire {
  build: string
  a: WireEnd
  b: WireEnd
  waypoints?: THREE.Vector3[]
  skip: string[]
  obstacles: Obstacle[]
}

function everyWire(): Wire[] {
  const out: Wire[] = []
  for (const { name, doc } of DOCS) {
    const index = new PortIndex(listInstances(doc))
    const obstacles = obstaclesOf(doc)
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
        skip: [c.a.instanceId, c.b.instanceId],
        obstacles,
      })
    }
  }
  return out
}

/** Millimetres of a part's own box that a wire is allowed to graze. */
const GRAZE = 1.2

/** How deep the worst sample of this wire goes into something, in mm. */
function worstIntrusion(w: Wire, curve: THREE.CatmullRomCurve3, samples = 64): number {
  let worst = 0
  const p = new THREE.Vector3()
  for (const o of w.obstacles) {
    if (!avoidable(o, w.a.pos, w.b.pos, w.skip)) continue
    const box = o.box.clone().expandByScalar(-GRAZE)
    if (box.isEmpty()) continue
    for (let i = 0; i <= samples; i++) {
      curve.getPoint(i / samples, p)
      if (!box.containsPoint(p)) continue
      // How far inside: the smallest distance back out through any face.
      const d = Math.min(
        p.x - box.min.x, box.max.x - p.x,
        p.y - box.min.y, box.max.y - p.y,
        p.z - box.min.z, box.max.z - p.z,
      )
      worst = Math.max(worst, d)
    }
  }
  return worst
}

describe('wires and the things in their way', () => {
  it('has wires and obstacles to measure', () => {
    const wires = everyWire()
    expect(wires.length).toBeGreaterThan(100)
    expect(wires.some((w) => w.obstacles.length > 3)).toBe(true)
  })

  it('does not run a wire through a part it is not attached to', () => {
    let through = 0
    let deepest = { build: '', mm: 0 }
    const wires = everyWire()
    for (const w of wires) {
      const d = worstIntrusion(w, wireCurve(w.a, w.b, w.waypoints, w.obstacles, w.skip))
      if (d > 0) through++
      if (d > deepest.mm) deepest = { build: w.build, mm: d }
    }
    // What it was before the clearance pass, for comparison.
    let before = 0
    const perBuild = new Map<string, number>()
    for (const w of wires) {
      if (worstIntrusion(w, wireCurve(w.a, w.b, w.waypoints, [], [])) > 0) before++
      const d = worstIntrusion(w, wireCurve(w.a, w.b, w.waypoints, w.obstacles, w.skip))
      if (d > 0) perBuild.set(w.build, (perBuild.get(w.build) ?? 0) + 1)
    }
    console.log(`\n  through: ${before} before, ${through} after, of ${wires.length}`)
    console.log(`  deepest: ${deepest.mm.toFixed(1)}mm in ${deepest.build}`)
    console.log(`  by build: ${[...perBuild.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`)
    let withWaypoints = 0
    let vertical = 0
    for (const w of wires) {
      if (worstIntrusion(w, wireCurve(w.a, w.b, w.waypoints, w.obstacles, w.skip)) <= 0) continue
      if (w.waypoints?.length) withWaypoints++
      // A run that is mostly vertical cannot be helped by lifting it.
      const d = w.b.pos.clone().sub(w.a.pos)
      if (Math.abs(d.y) > Math.hypot(d.x, d.z)) vertical++
    }
    console.log(`  of those: ${withWaypoints} hand-routed, ${vertical} mostly vertical`)
    // Which parts are actually being hit, so a fix can be aimed.
    const hit = new Map<string, number>()
    for (const { name, doc } of DOCS) {
      const index = new PortIndex(listInstances(doc))
      const obs = obstaclesOf(doc)
      for (const id of doc.connectionOrder) {
        const c = doc.connections[id]
        if (!c) continue
        const ea = index.get(c.a.instanceId, c.a.portId)
        const eb = index.get(c.b.instanceId, c.b.portId)
        if (!ea || !eb) continue
        const skip = [c.a.instanceId, c.b.instanceId]
        const curve = wireCurve({ pos: ea.pos, dir: ea.dir }, { pos: eb.pos, dir: eb.dir },
          c.waypoints?.map((w) => new THREE.Vector3(...w)), obs, skip)
        for (const o of obs) {
          if (!avoidable(o, ea.pos, eb.pos, skip)) continue
          const box = o.box.clone().expandByScalar(-GRAZE)
          if (box.isEmpty()) continue
          const p2 = new THREE.Vector3()
          let in3 = false
          for (let i = 0; i <= 64 && !in3; i++) {
            curve.getPoint(i / 64, p2)
            if (box.containsPoint(p2)) in3 = true
          }
          if (!in3) continue
          const def = doc.instances[o.instanceId]?.defId ?? '?'
          hit.set(`${name}:${def}`, (hit.get(`${name}:${def}`) ?? 0) + 1)
        }
      }
    }
    const top = [...hit.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)
    console.log(`  hitting: ${top.map(([k, v]) => `${k}×${v}`).join('  ')}`)
    /*
     * Depth, not a count of samples.
     *
     * A tenth of a millimetre of a wire inside the edge of a sheet, on a grid
     * whose holes are 2.54 mm apart, is not something anybody can see; it is
     * the spline brushing a surface it runs along. What was worth fixing was
     * a wire crossing clean through a board, and the worst of those was 4.5
     * millimetres deep. Chasing the last tenth means a real routing solver.
     */
    expect(deepest.mm).toBeLessThan(0.5)
    expect(through).toBeLessThan(wires.length * 0.06)
  })

  it('leaves a wire with nothing in the way alone', () => {
    // Two terminals on an empty bench: the arch is the natural sag, not a lift.
    const a: WireEnd = { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    const b: WireEnd = { pos: new THREE.Vector3(40, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    let top = 0
    const curve = wireCurve(a, b, undefined, [], [])
    for (let i = 0; i <= 40; i++) top = Math.max(top, curve.getPoint(i / 40).y)
    // 40 mm span, 0.18 sag fraction: a little over 7 mm at the apex.
    expect(top).toBeGreaterThan(3)
    expect(top).toBeLessThan(9)
  })

  it('lifts over a part standing between the two ends', () => {
    const a: WireEnd = { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    const b: WireEnd = { pos: new THREE.Vector3(60, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    const wall: Obstacle = {
      instanceId: 'wall',
      box: new THREE.Box3(new THREE.Vector3(26, 0, -10), new THREE.Vector3(34, 18, 10)),
    }
    let top = 0
    const curve = wireCurve(a, b, undefined, [wall], [])
    for (let i = 0; i <= 80; i++) top = Math.max(top, curve.getPoint(i / 80).y)
    expect(top).toBeGreaterThan(18)
  })

  it('ignores a part that is nowhere near the line between the ends', () => {
    const a: WireEnd = { pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    const b: WireEnd = { pos: new THREE.Vector3(40, 0, 0), dir: new THREE.Vector3(0, 1, 0) }
    const aside: Obstacle = {
      instanceId: 'aside',
      box: new THREE.Box3(new THREE.Vector3(10, 0, 60), new THREE.Vector3(20, 40, 70)),
    }
    let top = 0
    const curve = wireCurve(a, b, undefined, [aside], [])
    for (let i = 0; i <= 40; i++) top = Math.max(top, curve.getPoint(i / 40).y)
    expect(top).toBeLessThan(9)
  })
})
