import type { PartDef, Port, Solid, Vec2, Vec3 } from '../kernel/types'
import { registerParts } from '../kernel/registry'
import { circle, num, roundRect, str } from './_helpers'

/**
 * Fasteners, bearings and the fittings that join stock together.
 *
 * Sizes are the ISO ones, so an M5 is 5 mm across the thread and 8 mm across
 * the flats of its nut, and a part placed from here fits a hole drilled from
 * a drawing without being checked twice.
 */

const DARK = { color: '#0A0C0F', rough: 0.9, density: 0.01 }
const CHROME = { color: '#C9CED5', metal: 1, rough: 0.16, density: 7.85, name: 'Hard chrome' }

const THREADS = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10']
const threadOpts = (list = THREADS) => list.map((t) => ({ value: t, label: t }))
const mOf = (p: Record<string, unknown>, d = 'M5'): number => parseFloat(String(p.thread ?? d).slice(1)) || 5

const FINISHES = [
  { value: 'steel-zinc', label: 'Zinc plated' },
  { value: 'stainless-304', label: 'Stainless A2' },
  { value: 'steel', label: 'Black oxide' },
]
const finishMat = (p: Record<string, unknown>): string | object =>
  p.finish === 'steel' ? { color: '#2A2D31', metal: 0.9, rough: 0.45, density: 7.85, name: 'Black oxide steel' } : String(p.finish ?? 'steel-zinc')

/** Across-flats for an ISO hex, mm. */
const AF: Record<number, number> = { 3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13, 10: 16, 12: 18 }
/** Radius to the corners of a hex with the given across-flats. */
const hexR = (af: number): number => af / 2 / Math.cos(Math.PI / 6)

/* ================================================================== */
/* Screws and bolts                                                    */
/* ================================================================== */

const countersunk: PartDef = {
  id: 'screw-countersunk',
  name: 'Countersunk screw',
  category: 'fastener',
  blurb: 'Sits flush in a countersunk hole',
  tags: ['countersunk', 'csk', 'flat head', 'screw', 'm3', 'm4', 'm5', 'fastener', 'din 7991'],
  doc: { price: 0.06, description: 'A 90° countersunk socket screw, DIN 7991. The head is inside the part rather than on it, so a panel fixed with these stays flat.' },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M4', group: 'Fit', options: threadOpts() },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 12, min: 4, max: 80, step: 1, group: 'Fit' },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'stainless-304', group: 'Fit', options: FINISHES },
  ],
  solids: (p) => {
    const d = mOf(p, 'M4')
    const len = num(p, 'length', 12)
    const headR = d
    const headH = d * 0.6
    return [
      { kind: 'lathe', mat: finishMat(p) as never, seg: 24, points: [[0, 0], [headR, 0], [d / 2, -headH], [d / 2, -len], [d * 0.38, -len - d * 0.12], [0, -len - d * 0.12]] },
      { kind: 'cyl', mat: DARK, r: d * 0.32, h: headH * 0.8, seg: 6, at: [0, -headH * 0.38, 0], noCollide: true },
    ]
  },
  ports: (p) => [
    { id: 'shank', label: 'Shank', kind: 'mechanical', pos: [0, -num(p, 'length', 12) / 2, 0], dir: [0, -1, 0], mate: { type: 'stud', size: mOf(p, 'M4') } },
  ],
  readouts: (p) => [
    { label: 'Countersink', value: `90°, ${(mOf(p, 'M4') * 2).toFixed(1)} mm across` },
    { label: 'Hex key', value: `${({ 3: 2, 4: 2.5, 5: 3, 6: 4, 8: 5, 10: 6 } as Record<number, number>)[mOf(p, 'M4')] ?? 3} mm` },
  ],
}

const hexBolt: PartDef = {
  id: 'bolt-hex',
  name: 'Hex bolt',
  category: 'fastener',
  blurb: 'Hex head, part-threaded shank',
  tags: ['hex bolt', 'bolt', 'hex head', 'set screw', 'm6', 'm8', 'm10', 'fastener', 'iso 4014'],
  doc: { price: 0.2, description: 'A hex-head bolt, ISO 4014. The plain part of the shank is what takes a shear load; the thread is only there to hold the nut.' },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M8', group: 'Fit', options: threadOpts(['M5', 'M6', 'M8', 'M10', 'M12']) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 40, min: 10, max: 160, step: 5, group: 'Fit' },
    { key: 'grade', label: 'Grade', type: 'enum', default: '8.8', group: 'Fit', options: [{ value: '8.8', label: '8.8, zinc' }, { value: '10.9', label: '10.9, black' }, { value: 'A2', label: 'Stainless A2-70' }] },
  ],
  solids: (p) => {
    const d = mOf(p, 'M8')
    const len = num(p, 'length', 40)
    const grade = str(p, 'grade', '8.8')
    const mat = grade === 'A2' ? 'stainless-304' : grade === '10.9' ? { color: '#2A2D31', metal: 0.9, rough: 0.45, density: 7.85 } : 'steel-zinc'
    const af = AF[d] ?? d * 1.6
    const headH = d * 0.65
    const thread = Math.min(len, 2 * d + 6)
    const out: Solid[] = [
      { kind: 'cyl', mat: mat as never, r: hexR(af), h: headH, seg: 6, at: [0, headH / 2, 0], chamfer: d * 0.08 },
      { kind: 'cyl', mat: mat as never, r: d / 2, h: len - thread, at: [0, -(len - thread) / 2, 0], seg: 20 },
      { kind: 'cyl', mat: mat as never, r: d * 0.42, h: thread, at: [0, -len + thread / 2, 0], seg: 20 },
    ]
    const pitch = d <= 6 ? d * 0.17 : d * 0.15
    const rings = Math.min(Math.floor(thread / pitch), 40)
    for (let i = 0; i < rings; i++) {
      out.push({ kind: 'cyl', mat: mat as never, r: d / 2, h: pitch * 0.5, at: [0, -len + (i + 0.5) * pitch, 0], seg: 18, chamfer: pitch * 0.18, noCollide: true })
    }
    return out
  },
  ports: (p) => [
    { id: 'shank', label: 'Shank', kind: 'mechanical', pos: [0, -num(p, 'length', 40) / 2, 0], dir: [0, -1, 0], mate: { type: 'stud', size: mOf(p, 'M8') } },
  ],
  readouts: (p) => {
    const d = mOf(p, 'M8')
    const grade = str(p, 'grade', '8.8')
    const uts = grade === '10.9' ? 1040 : grade === 'A2' ? 700 : 800
    const area = (Math.PI / 4) * Math.pow(d * 0.85, 2)
    return [
      { label: 'Spanner', value: `${AF[d] ?? Math.round(d * 1.6)} mm` },
      { label: 'Breaking load', value: `${((area * uts) / 1000).toFixed(1)} kN` },
      { label: 'Torque', value: `${Math.round(0.2 * d * area * uts * 0.7 / 1000)} Nm` },
    ]
  },
}

const woodScrew: PartDef = {
  id: 'screw-wood',
  name: 'Wood screw',
  category: 'fastener',
  blurb: 'Pozi head, coarse thread and a point',
  tags: ['wood screw', 'screw', 'pozi', 'chipboard screw', 'timber', 'fastener', 'plywood'],
  doc: { price: 0.04, description: 'A countersunk chipboard screw with a coarse single-start thread. It cuts its own thread, so the pilot hole in hardwood wants to be about the core diameter.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: '4x40', group: 'Fit', options: ['3.5x20', '4x30', '4x40', '5x50', '5x70', '6x90'].map((v) => ({ value: v, label: v.replace('x', ' x ') + ' mm' })) },
  ],
  solids: (p) => {
    const [d, len] = str(p, 'size', '4x40').split('x').map(Number)
    const core = d * 0.62
    const mat = { color: '#C9A227', metal: 1, rough: 0.35, density: 7.85, name: 'Yellow zinc' }
    const threadLen = len * 0.6
    const path: Vec3[] = []
    const pitch = d * 0.45
    for (let i = 0; i <= (threadLen / pitch) * 10; i++) {
      const t = i / 10
      const y = -len + d * 0.9 + t * pitch
      const taper = Math.min(1, (y + len) / (d * 1.8))
      const r = (core / 2 + (d - core) / 4) * Math.max(taper, 0.3)
      path.push([r * Math.cos(t * Math.PI * 2), y, r * Math.sin(t * Math.PI * 2)])
    }
    return [
      { kind: 'lathe', mat, seg: 22, points: [[0, 0], [d, 0], [core / 2, -d * 0.62], [core / 2, -len + d * 1.2], [0.2, -len], [0, -len]] },
      { kind: 'tube', mat, r: (d - core) / 4, seg: 5, path },
      { kind: 'box', mat: DARK, size: [d * 1.1, d * 0.4, d * 0.22], at: [0, -d * 0.15, 0], noCollide: true },
      { kind: 'box', mat: DARK, size: [d * 0.22, d * 0.4, d * 1.1], at: [0, -d * 0.15, 0], noCollide: true },
    ]
  },
  ports: (p) => {
    const [d, len] = str(p, 'size', '4x40').split('x').map(Number)
    return [{ id: 'shank', label: 'Shank', kind: 'mechanical', pos: [0, -len / 2, 0], dir: [0, -1, 0], mate: { type: 'stud', size: d } }]
  },
  readouts: (p) => {
    const [d, len] = str(p, 'size', '4x40').split('x').map(Number)
    return [
      { label: 'Pilot hole', value: `${(d * 0.62).toFixed(1)} mm in hardwood` },
      { label: 'Clearance hole', value: `${(d + 0.5).toFixed(1)} mm in the top piece` },
      { label: 'Into the second piece', value: `At least ${Math.round(len * 0.6)} mm` },
    ]
  },
}

/* ================================================================== */
/* Nuts and washers                                                    */
/* ================================================================== */

const nylocNut: PartDef = {
  id: 'nut-nyloc',
  name: 'Lock nut',
  category: 'fastener',
  blurb: 'Nylon insert that stops it vibrating loose',
  tags: ['nyloc', 'lock nut', 'nylon insert', 'nut', 'self locking', 'm5', 'm8', 'fastener'],
  doc: { price: 0.05, description: 'A hex nut with a nylon ring at the top that the thread has to cut into. It holds against vibration, and it is meant to be used once.' },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M5', group: 'Fit', options: threadOpts() },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Fit', options: FINISHES },
  ],
  solids: (p) => {
    const d = mOf(p)
    const af = AF[d] ?? d * 1.6
    const h = d * 0.8
    const ring = d * 0.4
    return [
      { kind: 'cyl', mat: finishMat(p) as never, r: hexR(af), h, seg: 6, at: [0, h / 2, 0], chamfer: d * 0.08 },
      { kind: 'cyl', mat: finishMat(p) as never, r: af * 0.48, h: ring, at: [0, h + ring / 2, 0], seg: 24 },
      { kind: 'cyl', mat: { color: '#2F6FE0', rough: 0.6, density: 1.14, name: 'Nylon' }, r: af * 0.42, h: 0.6, at: [0, h + ring + 0.1, 0], seg: 24, noCollide: true },
      { kind: 'cyl', mat: DARK, r: d / 2, h: h + ring + 0.4, at: [0, (h + ring) / 2, 0], seg: 18, noCollide: true },
    ]
  },
  ports: (p) => [
    { id: 'thread', label: `${String(p.thread ?? 'M5')} thread`, kind: 'mechanical', pos: [0, mOf(p) * 1.2, 0], dir: [0, 1, 0], mate: { type: 'thread', size: mOf(p) } },
    { id: 'face', label: 'Bearing face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
}

const wingNut: PartDef = {
  id: 'nut-wing',
  name: 'Wing nut',
  category: 'fastener',
  blurb: 'Done up by hand, no spanner',
  tags: ['wing nut', 'butterfly nut', 'thumb nut', 'nut', 'hand tighten', 'fastener'],
  doc: { price: 0.12, description: 'A nut with two wings to turn it by hand, for anything that gets taken apart often.' },
  params: [
    { key: 'thread', label: 'Thread', type: 'enum', default: 'M6', group: 'Fit', options: threadOpts() },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Fit', options: FINISHES },
  ],
  solids: (p) => {
    const d = mOf(p, 'M6')
    const mat = finishMat(p) as never
    return [
      { kind: 'cyl', mat, r: d * 0.95, r2: d * 0.75, h: d * 1.2, at: [0, d * 0.6, 0], seg: 22 },
      { kind: 'cyl', mat: DARK, r: d / 2, h: d * 1.3, at: [0, d * 0.6, 0], seg: 16, noCollide: true },
      ...([-1, 1] as const).map((s): Solid => ({
        kind: 'extrude', mat,
        profile: { outline: [[0, 0], [d * 2.2, d * 0.4], [d * 2.4, d * 1.6], [d * 1.6, d * 2.2], [0, d * 1.2]] as Vec2[] },
        depth: d * 0.35, bevel: d * 0.08, rot: [0, s > 0 ? 0 : 180, 0], at: [s * d * 0.6, 0, 0],
      })),
    ]
  },
  ports: (p) => [
    { id: 'thread', label: 'Thread', kind: 'mechanical', pos: [0, mOf(p, 'M6') * 1.2, 0], dir: [0, 1, 0], mate: { type: 'thread', size: mOf(p, 'M6') } },
    { id: 'face', label: 'Bearing face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
}

const springWasher: PartDef = {
  id: 'washer-spring',
  name: 'Split lock washer',
  category: 'fastener',
  blurb: 'A cut ring set to a slight helix',
  tags: ['spring washer', 'split washer', 'lock washer', 'grower', 'washer', 'fastener'],
  doc: { price: 0.02, description: 'A split ring with its ends offset, meant to bite into the nut and the part under it.' },
  params: [
    { key: 'thread', label: 'For', type: 'enum', default: 'M5', group: 'Fit', options: threadOpts() },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Fit', options: FINISHES },
  ],
  solids: (p) => {
    const d = mOf(p)
    const wire = d * 0.3
    const R = d / 2 + wire * 0.9
    const path: Vec3[] = []
    for (let a = 14; a <= 346; a += 12) path.push([R * Math.cos((a * Math.PI) / 180), wire / 2 + (a / 360) * wire * 0.8, R * Math.sin((a * Math.PI) / 180)])
    return [{ kind: 'tube', mat: finishMat(p) as never, r: wire / 2, seg: 8, path }]
  },
  ports: (p) => [
    { id: 'bore', label: 'Bore', kind: 'mechanical', pos: [0, mOf(p) * 0.3, 0], dir: [0, 1, 0], mate: { type: 'hole', size: mOf(p) + 0.2 } },
    { id: 'face', label: 'Face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
}

const popRivet: PartDef = {
  id: 'rivet-pop',
  name: 'Pop rivet',
  category: 'fastener',
  blurb: 'Set from one side, for sheet you cannot reach behind',
  tags: ['pop rivet', 'blind rivet', 'rivet', 'sheet metal', 'fastener', 'aluminium'],
  doc: { price: 0.03, description: 'An aluminium blind rivet. The mandrel is pulled until it snaps, which swells the body behind the sheet. Grip range decides which length to use.' },
  params: [
    { key: 'dia', label: 'Diameter', type: 'enum', default: '4', group: 'Fit', options: ['3.2', '4', '4.8'].map((v) => ({ value: v, label: `${v} mm` })) },
    { key: 'grip', label: 'Grip', type: 'number', unit: 'mm', default: 4, min: 1, max: 12, step: 0.5, group: 'Fit' },
    { key: 'set', label: 'Set', type: 'bool', default: false, group: 'Fit' },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'dia', '4'))
    const grip = num(p, 'grip', 4)
    const body = grip + d * 1.4
    const set = p.set === true
    const out: Solid[] = [
      { kind: 'lathe', mat: 'alu-6063', seg: 22, points: [[0, d * 0.35], [d, 0.2], [d, 0], [d / 2, 0], [d / 2, set ? -grip : -body], [set ? d * 0.8 : d * 0.45, set ? -grip - d * 0.5 : -body], [0, set ? -grip - d * 0.5 : -body]] },
      { kind: 'cyl', mat: DARK, r: d * 0.22, h: 1, at: [0, d * 0.33, 0], seg: 12, noCollide: true },
    ]
    if (!set) out.push({ kind: 'cyl', mat: 'steel', r: d * 0.22, h: 26, at: [0, 13, 0], seg: 12 })
    return out
  },
  ports: (p) => [
    { id: 'body', label: 'Body', kind: 'mechanical', pos: [0, -num(p, 'grip', 4) / 2, 0], dir: [0, -1, 0], mate: { type: 'stud', size: parseFloat(str(p, 'dia', '4')) } },
  ],
  readouts: (p) => [
    { label: 'Drill', value: `${(parseFloat(str(p, 'dia', '4')) + 0.1).toFixed(1)} mm` },
    { label: 'Grip range', value: `${num(p, 'grip', 4)} mm of sheet` },
  ],
}

/* ================================================================== */
/* Brackets and plates                                                 */
/* ================================================================== */

const lBracket: PartDef = {
  id: 'bracket-l',
  name: 'Angle bracket',
  category: 'fastener',
  blurb: 'Pressed L bracket with a hole in each leg',
  tags: ['angle bracket', 'l bracket', 'corner bracket', 'bracket', 'shelf bracket', 'right angle'],
  doc: { price: 0.4, description: 'A pressed steel right-angle bracket. It resists the joint opening far better than closing, so it goes on the inside of a corner.' },
  params: [
    { key: 'leg', label: 'Leg', type: 'number', unit: 'mm', default: 40, min: 20, max: 120, step: 5, group: 'Bracket' },
    { key: 'width', label: 'Width', type: 'number', unit: 'mm', default: 20, min: 10, max: 60, step: 5, group: 'Bracket' },
    { key: 'thick', label: 'Thickness', type: 'number', unit: 'mm', default: 2, min: 1, max: 6, step: 0.5, group: 'Bracket' },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'steel-zinc', group: 'Bracket', options: FINISHES },
  ],
  solids: (p) => {
    const L = num(p, 'leg', 40)
    const W = num(p, 'width', 20)
    const t = num(p, 'thick', 2)
    const mat = finishMat(p) as never
    return [
      { kind: 'extrude', mat, profile: { outline: [[0, 0], [L, 0], [L, t], [t, t], [t, L], [0, L]] as Vec2[] }, depth: W, at: [0, 0, 0] },
      { kind: 'cyl', mat: DARK, r: Math.min(W * 0.2, 3), h: t + 0.4, at: [L * 0.62, t / 2, 0], seg: 14, noCollide: true },
      { kind: 'cyl', mat: DARK, r: Math.min(W * 0.2, 3), h: t + 0.4, rot: [0, 0, 90], at: [t / 2, L * 0.62, 0], seg: 14, noCollide: true },
    ]
  },
  ports: (p) => {
    const L = num(p, 'leg', 40)
    const t = num(p, 'thick', 2)
    const hole = Math.min(num(p, 'width', 20) * 0.4, 6) + 0.4
    return [
      { id: 'a', label: 'Floor leg hole', kind: 'mechanical', pos: [L * 0.62, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: hole } },
      { id: 'b', label: 'Wall leg hole', kind: 'mechanical', pos: [0, L * 0.62, 0], dir: [-1, 0, 0], mate: { type: 'hole', size: hole } },
      { id: 'inside', label: 'Inside corner', kind: 'mechanical', pos: [t, t, 0], dir: [1, 1, 0], mate: { type: 'face' } },
    ]
  },
}

const joiningPlate: PartDef = {
  id: 'plate-joining-2020',
  name: 'Joining plate',
  category: 'fastener',
  blurb: 'Flat plate that ties 2020 extrusion together, L, T or straight',
  tags: ['joining plate', 'corner plate', 'gusset', '2020', 'extrusion', 'l plate', 't plate', 'bracket'],
  doc: { price: 1.5, description: 'A flat aluminium plate drilled on a 20 mm grid, laid over a joint in 2020 profile and bolted through into T-nuts. Stiffer than an inside bracket and nothing sticks out of the frame.' },
  params: [
    { key: 'shape', label: 'Shape', type: 'enum', default: 'l', group: 'Plate', options: [{ value: 'straight', label: 'Straight, 5 hole' }, { value: 'l', label: 'L, 5 hole' }, { value: 't', label: 'T, 5 hole' }] },
    { key: 'finish', label: 'Finish', type: 'enum', default: 'alu-anod-black', group: 'Plate', options: [{ value: 'alu-anod-black', label: 'Black anodised' }, { value: 'alu-6063', label: 'Silver' }] },
  ],
  solids: (p) => {
    const shape = str(p, 'shape', 'l')
    const mat = str(p, 'finish', 'alu-anod-black')
    const T = 4
    const bar = (cx: number, cz: number, w: number, d: number, holes: [number, number][]): Solid => ({
      kind: 'extrude', mat,
      profile: { outline: roundRect(w, d, 3, cx, -cz, 3), holes: holes.map(([x, z]) => circle(2.7, x, -z, 14)) },
      depth: T, rot: [-90, 0, 0], at: [0, T / 2, 0],
    })
    if (shape === 'straight') return [bar(0, 0, 100, 20, [-40, -20, 0, 20, 40].map((x) => [x, 0]))]
    if (shape === 't') return [bar(0, 0, 60, 20, [[-20, 0], [0, 0], [20, 0]]), bar(0, 20, 20, 60, [[0, 20], [0, 40]])]
    return [bar(20, 0, 60, 20, [[0, 0], [20, 0], [40, 0]]), bar(0, 20, 20, 60, [[0, 20], [0, 40]])]
  },
  ports: (p) => {
    const shape = str(p, 'shape', 'l')
    const pts: [number, number][] = shape === 'straight' ? [-40, -20, 0, 20, 40].map((x) => [x, 0]) : shape === 't' ? [[-20, 0], [0, 0], [20, 0], [0, 20], [0, 40]] : [[0, 0], [20, 0], [40, 0], [0, 20], [0, 40]]
    return [
      ...pts.map(([x, z], i): Port => ({ id: `hole${i}`, label: 'M5 hole', kind: 'mechanical', pos: [x, 0, z], dir: [0, -1, 0], mate: { type: 'hole', size: 5.4 }, groupId: 'holes' })),
      { id: 'face', label: 'Plate face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    ]
  },
}

/* ================================================================== */
/* Bearings and rods                                                   */
/* ================================================================== */

const pillowBlock: PartDef = {
  id: 'bearing-pillow-block',
  name: 'Pillow block bearing',
  category: 'motion',
  blurb: 'A bearing in a bolt-down housing',
  tags: ['pillow block', 'kp08', 'bearing block', 'flange bearing', 'shaft support', 'leadscrew'],
  doc: { price: 2.5, description: 'A self-aligning bearing insert in a zinc housing with two bolt holes. Grub screws in the inner ring lock it to the shaft.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'KP08', group: 'Bearing', options: [{ value: 'KP08', label: 'KP08, 8 mm' }, { value: 'KP000', label: 'KP000, 10 mm' }, { value: 'KP001', label: 'KP001, 12 mm' }] },
  ],
  solids: (p) => {
    const bore = { KP08: 8, KP000: 10, KP001: 12 }[str(p, 'size', 'KP08') as 'KP08'] ?? 8
    const k = bore / 8
    const L = 55 * k
    const H = 29 * k
    const R = 14 * k
    const zinc = { color: '#9EA3AA', metal: 0.8, rough: 0.5, density: 6.6, name: 'Zinc alloy' }
    return [
      { kind: 'box', mat: zinc, size: [L, 5 * k, 13 * k], at: [0, 2.5 * k, 0], bevel: 1 },
      { kind: 'box', mat: zinc, size: [26 * k, H - R, 13 * k], at: [0, (H - R) / 2, 0], bevel: 1 },
      { kind: 'cyl', mat: zinc, r: R, h: 13 * k, rot: [90, 0, 0], at: [0, H - R, 0], seg: 28 },
      { kind: 'cyl', mat: 'steel', r: bore / 2 + 2.5, h: 15 * k, rot: [90, 0, 0], at: [0, H - R, 0], seg: 24 },
      { kind: 'cyl', mat: DARK, r: bore / 2, h: 16 * k, rot: [90, 0, 0], at: [0, H - R, 0], seg: 18, noCollide: true },
      { kind: 'cyl', mat: 'brass', r: 1.5, h: 4, at: [0, H + 1, 0], seg: 10 },
      ...([-1, 1] as const).map((s): Solid => ({ kind: 'cyl', mat: DARK, r: 2.6 * k, h: 5.4 * k, at: [s * 21 * k, 2.5 * k, 0], seg: 12, noCollide: true })),
    ]
  },
  ports: (p) => {
    const bore = { KP08: 8, KP000: 10, KP001: 12 }[str(p, 'size', 'KP08') as 'KP08'] ?? 8
    const k = bore / 8
    return [
      { id: 'bore', label: `${bore} mm bore`, kind: 'mechanical', pos: [0, 15 * k, 7 * k], dir: [0, 0, 1], mate: { type: 'hole', size: bore } },
      ...([-1, 1] as const).map((s, i): Port => ({ id: `mount${i}`, label: 'Bolt hole', kind: 'mechanical', pos: [s * 21 * k, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 5.2 * k }, groupId: 'mounts' })),
    ]
  },
}

const linearBearing: PartDef = {
  id: 'bearing-linear',
  name: 'Linear bearing',
  category: 'motion',
  blurb: 'Recirculating balls that slide along a round rod',
  tags: ['linear bearing', 'lm8uu', 'lm10uu', 'bushing', 'smooth rod', '3d printer', 'slide'],
  doc: { price: 0.8, description: 'A ball bushing for a hardened round rod. It carries load well and moment poorly, which is why they are always used two to a rod.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'LM8UU', group: 'Bearing', options: [{ value: 'LM6UU', label: 'LM6UU' }, { value: 'LM8UU', label: 'LM8UU' }, { value: 'LM10UU', label: 'LM10UU' }, { value: 'LM12UU', label: 'LM12UU' }] },
  ],
  solids: (p) => {
    const dims: Record<string, [number, number, number]> = { LM6UU: [6, 12, 19], LM8UU: [8, 15, 24], LM10UU: [10, 19, 29], LM12UU: [12, 21, 30] }
    const [d, D, L] = dims[str(p, 'size', 'LM8UU')] ?? dims.LM8UU
    return [
      { kind: 'cyl', mat: 'steel', r: D / 2, h: L, rot: [0, 0, 90], at: [0, D / 2, 0], seg: 28, chamfer: 0.5 },
      ...([-1, 1] as const).map((s): Solid => ({ kind: 'cyl', mat: DARK, r: D / 2 + 0.05, h: 1.1, rot: [0, 0, 90], at: [s * L * 0.3, D / 2, 0], seg: 28, noCollide: true })),
      ...([-1, 1] as const).map((s): Solid => ({ kind: 'cyl', mat: 'abs-black', r: D / 2 - 1.2, h: 1, rot: [0, 0, 90], at: [s * (L / 2 + 0.3), D / 2, 0], seg: 24, noCollide: true })),
      { kind: 'cyl', mat: DARK, r: d / 2, h: L + 1, rot: [0, 0, 90], at: [0, D / 2, 0], seg: 18, noCollide: true },
    ]
  },
  ports: (p) => {
    const dims: Record<string, [number, number, number]> = { LM6UU: [6, 12, 19], LM8UU: [8, 15, 24], LM10UU: [10, 19, 29], LM12UU: [12, 21, 30] }
    const [d, D, L] = dims[str(p, 'size', 'LM8UU')] ?? dims.LM8UU
    return [
      { id: 'bore', label: `${d} mm bore`, kind: 'mechanical', pos: [L / 2, D / 2, 0], dir: [1, 0, 0], mate: { type: 'hole', size: d } },
      { id: 'outer', label: 'Outer diameter', kind: 'mechanical', pos: [0, D, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    ]
  },
}

const smoothRod: PartDef = {
  id: 'rod-smooth',
  name: 'Smooth rod',
  category: 'motion',
  blurb: 'Hardened, ground and chromed, for linear bearings to run on',
  tags: ['smooth rod', 'linear rod', 'linear shaft', 'guide rod', '8mm rod', 'chrome rod', '3d printer'],
  doc: { price: 5, description: 'A case-hardened ground shaft with a chrome finish. Its deflection under load goes with the fourth power of the diameter, so going from 8 to 10 mm makes it more than twice as stiff.' },
  params: [
    { key: 'dia', label: 'Diameter', type: 'enum', default: '8', group: 'Rod', options: ['6', '8', '10', '12', '16'].map((d) => ({ value: d, label: `${d} mm` })) },
    { key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 400, min: 50, max: 1500, step: 10, group: 'Rod' },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'dia', '8'))
    const L = num(p, 'length', 400)
    return [{ kind: 'cyl', mat: CHROME, r: d / 2, h: L, rot: [0, 0, 90], at: [0, d / 2, 0], seg: 22, chamfer: 0.5 }]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'dia', '8'))
    const L = num(p, 'length', 400)
    return [
      { id: 'end-a', label: 'End A', kind: 'mechanical', pos: [-L / 2, d / 2, 0], dir: [-1, 0, 0], mate: { type: 'stud', size: d } },
      { id: 'end-b', label: 'End B', kind: 'mechanical', pos: [L / 2, d / 2, 0], dir: [1, 0, 0], mate: { type: 'stud', size: d } },
    ]
  },
  readouts: (p) => {
    const d = parseFloat(str(p, 'dia', '8'))
    const L = num(p, 'length', 400)
    const I = (Math.PI / 64) * Math.pow(d, 4)
    const sag = (10 * Math.pow(L, 3)) / (48 * 210000 * I)
    return [
      { label: 'Sag, 1 kg at the middle', value: `${sag.toFixed(3)} mm, supported at the ends` },
      { label: 'Hardness', value: '60 HRC' },
    ]
  },
}

const rodSupport: PartDef = {
  id: 'rod-support',
  name: 'Rod support',
  category: 'motion',
  blurb: 'Clamps the end of a smooth rod to a flat surface',
  tags: ['rod support', 'sk8', 'shaft support', 'rod holder', 'rod clamp', 'linear'],
  doc: { price: 1.5, description: 'An SK-style end support: a slotted aluminium block with a clamp screw, and two bolt holes in its foot.' },
  params: [
    { key: 'size', label: 'Size', type: 'enum', default: 'SK8', group: 'Support', options: [{ value: 'SK8', label: 'SK8' }, { value: 'SK10', label: 'SK10' }, { value: 'SK12', label: 'SK12' }] },
  ],
  solids: (p) => {
    const d = parseFloat(str(p, 'size', 'SK8').slice(2))
    const k = d / 8
    const W = 42 * k
    const H = 33 * k
    const cy = 20 * k
    const T = 14 * k
    return [
      {
        kind: 'extrude', mat: 'alu-6063',
        profile: {
          outline: [[-W / 2, 0], [W / 2, 0], [W / 2, 6 * k], [10 * k, 6 * k], [10 * k, H], [-10 * k, H], [-10 * k, 6 * k], [-W / 2, 6 * k]] as Vec2[],
          holes: [circle(d / 2, 0, cy, 20)],
        },
        depth: T, at: [0, 0, 0],
      },
      { kind: 'box', mat: DARK, size: [1, H - cy, T + 0.2], at: [0, cy + (H - cy) / 2, 0], noCollide: true },
      { kind: 'cyl', mat: 'steel', r: 2.5 * k, h: 22 * k, rot: [0, 0, 90], at: [0, H - 5 * k, 0], seg: 12 },
      ...([-1, 1] as const).map((s): Solid => ({ kind: 'cyl', mat: DARK, r: 2.7 * k, h: 6.4 * k, at: [s * 16 * k, 3 * k, 0], seg: 12, noCollide: true })),
    ]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'size', 'SK8').slice(2))
    const k = d / 8
    return [
      { id: 'rod', label: `${d} mm rod`, kind: 'mechanical', pos: [0, 20 * k, 7 * k], dir: [0, 0, 1], mate: { type: 'hole', size: d } },
      ...([-1, 1] as const).map((s, i): Port => ({ id: `mount${i}`, label: 'M5 hole', kind: 'mechanical', pos: [s * 16 * k, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 5.4 * k }, groupId: 'mounts' })),
    ]
  },
}

const shaftCollar: PartDef = {
  id: 'shaft-collar',
  name: 'Shaft collar',
  category: 'motion',
  blurb: 'Locks a position on a shaft',
  tags: ['shaft collar', 'collar', 'set collar', 'clamp collar', 'stop', 'shaft'],
  doc: { price: 1, description: 'A split clamp collar. It grips all the way round rather than at one grub screw, so it does not mark the shaft or walk under vibration.' },
  params: [{ key: 'bore', label: 'Bore', type: 'enum', default: '8', group: 'Collar', options: ['5', '6', '8', '10', '12'].map((b) => ({ value: b, label: `${b} mm` })) }],
  solids: (p) => {
    const d = parseFloat(str(p, 'bore', '8'))
    const D = d * 2 + 6
    const W = Math.max(8, d)
    return [
      { kind: 'lathe', mat: 'alu-anod-black', seg: 28, points: [[d / 2, -W / 2], [D / 2, -W / 2], [D / 2, W / 2], [d / 2, W / 2], [d / 2, -W / 2]], rot: [0, 0, 90], at: [0, D / 2, 0] },
      { kind: 'box', mat: DARK, size: [W + 0.2, D / 2, 1], at: [0, D * 0.75, 0], noCollide: true },
      { kind: 'cyl', mat: 'steel', r: Math.max(1.4, d * 0.18), h: D * 0.9, at: [0, D * 0.75, 0], rot: [90, 0, 0], seg: 12 },
    ]
  },
  ports: (p) => {
    const d = parseFloat(str(p, 'bore', '8'))
    return [{ id: 'bore', label: `${d} mm bore`, kind: 'mechanical', pos: [Math.max(8, d) / 2, d + 3, 0], dir: [1, 0, 0], mate: { type: 'hole', size: d } }]
  },
}

/* ================================================================== */
/* Motion hardware                                                     */
/* ================================================================== */

const gasSpring: PartDef = {
  id: 'gas-spring',
  name: 'Gas spring',
  category: 'motion',
  blurb: 'Holds a lid up, rated by the force it pushes with',
  tags: ['gas spring', 'gas strut', 'lid stay', 'damper', 'actuator', 'lift support'],
  doc: { price: 8, description: 'A nitrogen-charged strut. The force is nearly constant over the stroke and rises a little as it compresses, so a lid is sized to the force at the end it spends most time at.' },
  params: [
    { key: 'stroke', label: 'Stroke', type: 'number', unit: 'mm', default: 100, min: 30, max: 300, step: 10, group: 'Spring' },
    { key: 'force', label: 'Force', type: 'number', unit: 'N', default: 150, min: 30, max: 1200, step: 10, group: 'Spring' },
    { key: 'compressed', label: 'Compressed', type: 'number', unit: '%', default: 0, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const S = num(p, 'stroke', 100)
    const f = num(p, 'compressed', 0) / 100
    const body = S + 40
    const rod = S * (1 - f) + 12
    const y = 12
    const x0 = -(body + rod) / 2
    const eye = (x: number): Solid => ({ kind: 'torus', mat: 'steel-zinc', r: 5, tube: 2.4, rot: [90, 0, 0], at: [x, y, 0], seg: 18 })
    return [
      { kind: 'cyl', mat: 'abs-black', r: 9, h: body, rot: [0, 0, 90], at: [x0 + body / 2, y, 0], seg: 22, chamfer: 1.5 },
      { kind: 'cyl', mat: CHROME, r: 4, h: rod, rot: [0, 0, 90], at: [x0 + body + rod / 2, y, 0], seg: 16 },
      eye(x0 - 7),
      eye(x0 + body + rod + 7),
    ]
  },
  ports: (p) => {
    const S = num(p, 'stroke', 100)
    const rod = S * (1 - num(p, 'compressed', 0) / 100) + 12
    const body = S + 40
    const x0 = -(body + rod) / 2
    return [
      { id: 'eye-a', label: 'Body eye', kind: 'mechanical', pos: [x0 - 7, 12, 0], dir: [0, 0, 1], mate: { type: 'hole', size: 8.2 } },
      { id: 'eye-b', label: 'Rod eye', kind: 'mechanical', pos: [x0 + body + rod + 7, 12, 0], dir: [0, 0, 1], mate: { type: 'hole', size: 8.2 } },
    ]
  },
  readouts: (p) => {
    const F = num(p, 'force', 150)
    const f = num(p, 'compressed', 0) / 100
    return [
      { label: 'Extended length', value: `${Math.round(num(p, 'stroke', 100) * 2 + 66)} mm between eyes` },
      { label: 'Force now', value: `${Math.round(F * (1 + 0.3 * f))} N` },
      { label: 'Holds up', value: `${((F * (1 + 0.3 * f)) / 9.81).toFixed(1)} kg at the strut` },
    ]
  },
}

const drawerSlide: PartDef = {
  id: 'drawer-slide',
  name: 'Drawer slide',
  category: 'motion',
  blurb: 'Three-part ball bearing runner, full extension',
  tags: ['drawer slide', 'drawer runner', 'telescopic slide', 'ball bearing slide', 'rail', 'server rail'],
  doc: { price: 9, description: 'A pair of these carries a drawer. The middle member is what gets full extension: the drawer comes all the way out, which a two-part slide cannot do.' },
  params: [
    { key: 'length', label: 'Closed length', type: 'number', unit: 'mm', default: 350, min: 200, max: 700, step: 50, group: 'Slide' },
    { key: 'extension', label: 'Pulled out', type: 'number', unit: '%', default: 40, min: 0, max: 100, step: 1, group: 'Control' },
  ],
  solids: (p) => {
    const L = num(p, 'length', 350)
    const e = num(p, 'extension', 40) / 100
    const H = 45
    const member = (dx: number, h: number, z: number, mat: string | object): Solid[] => [
      { kind: 'box', mat: mat as never, size: [L, h, 1.2], at: [dx, H / 2, z] },
      { kind: 'box', mat: mat as never, size: [L, 1.2, 4], at: [dx, H / 2 + h / 2, z + 2] },
      { kind: 'box', mat: mat as never, size: [L, 1.2, 4], at: [dx, H / 2 - h / 2, z + 2] },
    ]
    return [
      ...member(0, H, 0, 'steel-zinc'),
      ...member((L * e) / 2, H - 6, 4, 'steel'),
      ...member(L * e, H - 12, 8, 'steel-zinc'),
      { kind: 'box', mat: 'abs-black', size: [14, 8, 4], at: [L * e + L / 2 - 20, H / 2, 11], bevel: 1 },
    ]
  },
  ports: (p) => {
    const L = num(p, 'length', 350)
    const e = num(p, 'extension', 40) / 100
    return [
      { id: 'cabinet', label: 'Cabinet side', kind: 'mechanical', pos: [0, 22.5, -0.6], dir: [0, 0, -1], mate: { type: 'face' } },
      { id: 'drawer', label: 'Drawer side', kind: 'mechanical', pos: [L * e, 22.5, 9], dir: [0, 0, 1], mate: { type: 'face' } },
    ]
  },
  readouts: (p) => [
    { label: 'Travel', value: `${num(p, 'length', 350)} mm` },
    { label: 'Load', value: '45 kg a pair' },
    { label: 'Side clearance', value: '12.7 mm each side' },
  ],
}

/* ================================================================== */
/* Odds and ends                                                       */
/* ================================================================== */

const rubberFoot: PartDef = {
  id: 'rubber-foot',
  name: 'Rubber foot',
  category: 'fastener',
  blurb: 'Screw-on bumper that stops a box walking',
  tags: ['rubber foot', 'bumper', 'foot', 'enclosure foot', 'feet', 'anti vibration'],
  doc: { price: 0.2, description: 'A domed rubber foot with a recessed screw. Four of them decouple an enclosure from whatever it stands on.' },
  params: [{ key: 'dia', label: 'Diameter', type: 'number', unit: 'mm', default: 20, min: 10, max: 50, step: 1, group: 'Foot' }],
  solids: (p) => {
    const d = num(p, 'dia', 20)
    const h = d * 0.45
    return [
      { kind: 'lathe', mat: 'rubber', seg: 24, points: [[0, 0], [d * 0.42, 0], [d / 2, h * 0.35], [d * 0.44, h * 0.85], [d * 0.28, h], [0, h]] },
      { kind: 'cyl', mat: DARK, r: d * 0.16, h: h * 0.5, at: [0, h * 0.78, 0], seg: 14, noCollide: true },
    ]
  },
  ports: (p) => [
    { id: 'top', label: 'Mounting face', kind: 'mechanical', pos: [0, num(p, 'dia', 20) * 0.45, 0], dir: [0, 1, 0], mate: { type: 'face' } },
    { id: 'floor', label: 'Floor face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
}

const knob: PartDef = {
  id: 'knob',
  name: 'Control knob',
  category: 'electromech',
  blurb: 'Knurled aluminium or a skirted pointer, on a 6 mm shaft',
  tags: ['knob', 'control knob', 'pot knob', 'dial', 'encoder knob', 'aluminium knob'],
  doc: { price: 1.5, description: 'A knob for a 6 mm potentiometer or encoder shaft, held by a grub screw.' },
  params: [
    { key: 'style', label: 'Style', type: 'enum', default: 'knurled', group: 'Knob', options: [{ value: 'knurled', label: 'Knurled aluminium' }, { value: 'skirt', label: 'Skirted, with pointer' }] },
    { key: 'dia', label: 'Diameter', type: 'number', unit: 'mm', default: 22, min: 10, max: 50, step: 1, group: 'Knob' },
  ],
  solids: (p) => {
    const d = num(p, 'dia', 22)
    const out: Solid[] = []
    if (str(p, 'style', 'knurled') === 'knurled') {
      out.push({ kind: 'cyl', mat: 'alu-6063', r: d / 2, h: d * 0.7, at: [0, d * 0.35, 0], seg: 30, chamfer: 1 })
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2
        out.push({ kind: 'box', mat: { color: '#9EA3AA', metal: 1, rough: 0.5, density: 2.7 }, size: [0.8, d * 0.5, 0.6], at: [Math.cos(a) * (d / 2), d * 0.32, Math.sin(a) * (d / 2)], rot: [0, (-a * 180) / Math.PI, 0], noCollide: true })
      }
      out.push({ kind: 'box', mat: DARK, size: [1.2, 0.4, d * 0.4], at: [0, d * 0.7 + 0.1, -d * 0.2], noCollide: true })
    } else {
      out.push({ kind: 'cyl', mat: 'abs-black', r: d / 2, h: 3, at: [0, 1.5, 0], seg: 32, chamfer: 0.6 })
      out.push({ kind: 'cyl', mat: 'abs-black', r: d * 0.34, r2: d * 0.3, h: d * 0.6, at: [0, 3 + d * 0.3, 0], seg: 28, chamfer: 1 })
      out.push({ kind: 'box', mat: { color: '#E6E9ED', rough: 0.6, density: 0.01 }, size: [1.2, 0.5, d * 0.3], at: [0, 3.1, -d * 0.36], noCollide: true })
    }
    return out
  },
  ports: () => [{ id: 'bore', label: '6 mm shaft', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'hole', size: 6 } }],
}

const dinRail: PartDef = {
  id: 'din-rail',
  name: 'DIN rail',
  category: 'structural',
  blurb: 'TS35 top-hat rail for breakers, terminals and modules',
  tags: ['din rail', 'ts35', 'top hat rail', 'rail', 'control panel', 'enclosure', 'terminal'],
  doc: { price: 3, description: 'The 35 mm top-hat rail every control cabinet is built on. Anything with a DIN clip snaps on and slides along it.' },
  params: [{ key: 'length', label: 'Length', type: 'number', unit: 'mm', default: 300, min: 50, max: 2000, step: 10, group: 'Rail' }],
  solids: (p) => {
    const L = num(p, 'length', 300)
    // The hat, as a (z, y) profile, turned to run along X.
    const hat: [number, number][] = [
      [-17.5, 6.5], [-12.5, 6.5], [-12.5, 0], [12.5, 0], [12.5, 6.5], [17.5, 6.5],
      [17.5, 7.5], [11.5, 7.5], [11.5, 1], [-11.5, 1], [-11.5, 7.5], [-17.5, 7.5],
    ]
    const out: Solid[] = [
      { kind: 'extrude', mat: 'steel-zinc', profile: { outline: hat.map(([z, y]) => [-z, y] as Vec2) }, depth: L, rot: [0, 90, 0], at: [0, 0, 0] },
    ]
    for (let x = -L / 2 + 12.5; x < L / 2 - 6; x += 25) {
      out.push({ kind: 'box', mat: DARK, size: [15, 1.2, 5.2], at: [x, 0.5, 0], noCollide: true })
    }
    return out
  },
  ports: (p) => [
    { id: 'rail', label: 'Top hat', kind: 'mechanical', pos: [0, 7.5, 0], dir: [0, 1, 0], mate: { type: 'rail', size: 35 } },
    { id: 'back', label: 'Back face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
    { id: 'end-a', label: 'End', kind: 'mechanical', pos: [-num(p, 'length', 300) / 2, 4, 0], dir: [-1, 0, 0], mate: { type: 'face' } },
  ],
}

const magnet: PartDef = {
  id: 'magnet-disc',
  name: 'Disc magnet',
  category: 'fastener',
  blurb: 'Neodymium, nickel plated',
  tags: ['magnet', 'neodymium', 'ndfeb', 'disc magnet', 'n52', 'rare earth', 'catch'],
  doc: { price: 0.3, description: 'A sintered neodymium disc. Pull force falls off steeply with the gap: a millimetre of paint roughly halves it on a small magnet.' },
  params: [
    { key: 'dia', label: 'Diameter', type: 'number', unit: 'mm', default: 10, min: 3, max: 40, step: 1, group: 'Magnet' },
    { key: 'thick', label: 'Thickness', type: 'number', unit: 'mm', default: 3, min: 1, max: 20, step: 0.5, group: 'Magnet' },
    { key: 'grade', label: 'Grade', type: 'enum', default: 'N42', group: 'Magnet', options: ['N35', 'N42', 'N52'].map((g) => ({ value: g, label: g })) },
  ],
  solids: (p) => {
    const d = num(p, 'dia', 10)
    const t = num(p, 'thick', 3)
    return [
      { kind: 'cyl', mat: 'nickel', r: d / 2, h: t, at: [0, t / 2, 0], seg: 28, chamfer: Math.min(0.3, t * 0.1) },
      { kind: 'cyl', mat: { color: '#C4262C', rough: 0.6, density: 0.01 }, r: Math.min(1.2, d * 0.1), h: 0.05, at: [d * 0.3, t + 0.03, 0], seg: 10, noCollide: true },
    ]
  },
  ports: (p) => [
    { id: 'north', label: 'North face', kind: 'mechanical', pos: [0, num(p, 'thick', 3), 0], dir: [0, 1, 0], mate: { type: 'face' } },
    { id: 'south', label: 'South face', kind: 'mechanical', pos: [0, 0, 0], dir: [0, -1, 0], mate: { type: 'face' } },
  ],
  readouts: (p) => {
    const d = num(p, 'dia', 10)
    const t = num(p, 'thick', 3)
    const br = { N35: 1.18, N42: 1.3, N52: 1.44 }[str(p, 'grade', 'N42') as 'N42'] ?? 1.3
    // Rough contact pull against thick steel, from Br and face area, limited by thickness.
    const area = (Math.PI * d * d) / 4e6
    const k = Math.min(1, t / (d * 0.5))
    const pull = ((br * br * area) / (2 * 4e-7 * Math.PI)) * k * 0.35
    return [
      { label: 'Pull on steel', value: `About ${(pull / 9.81).toFixed(1)} kg in contact` },
      { label: 'At a 1 mm gap', value: `About ${((pull / 9.81) * Math.exp(-2 / Math.max(d * 0.25, 1))).toFixed(1)} kg` },
      { label: 'Max temperature', value: '80 °C' },
    ]
  },
}

registerParts([
  countersunk, hexBolt, woodScrew, nylocNut, wingNut, springWasher, popRivet,
  lBracket, joiningPlate, pillowBlock, linearBearing, smoothRod, rodSupport, shaftCollar,
  gasSpring, drawerSlide, rubberFoot, knob, dinRail, magnet,
])

